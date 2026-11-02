import { randomUUID } from 'node:crypto';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { DownloadProgress, DownloadRequest, DownloadResult } from '../../shared/types';
import { BinaryManager } from '../media/binary-manager';
import { AppError } from '../utils/app-error';
import { logger } from '../utils/logger';
import { moveWithoutOverwrite } from './file-utils';
import { redditYtDlpArgs } from '../scanner/reddit';

interface ActiveDownload { child: ChildProcessWithoutNullStreams; temporaryDirectory: string; cancelled: boolean }
type ProgressListener = (progress: DownloadProgress) => void;

export class DownloadManager {
  private readonly active = new Map<string, ActiveDownload>();
  private readonly completed = new Set<string>();
  constructor(private readonly binaries: BinaryManager) {}

  async download(request: DownloadRequest, onProgress: ProgressListener): Promise<DownloadResult> {
    validateRequest(request);
    const downloadId = randomUUID(); const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'ht-downloader-'));
    const ytDlp = await this.binaries.resolve('yt-dlp'); const ffmpeg = await this.binaries.resolve('ffmpeg').catch(() => { throw new AppError('FFMPEG_MISSING', 'FFmpeg is not installed.'); });
    const dashHeight = request.selectedFormatId.match(/^dash:.*:(\d+)$/)?.[1];
    const format = dashHeight ? `bestvideo[height=${dashHeight}]+bestaudio/best[height=${dashHeight}]`
      : /^(direct|hls|sniffed):/.test(request.selectedFormatId) ? 'bestvideo+bestaudio/best'
      : request.selectedHasAudio ? `${request.selectedFormatId}/best` : `${request.selectedFormatId}+bestaudio/best`;
    // Keep the temporary path ASCII-only. yt-dlp console encoding on Windows can
    // differ from UTF-8 and corrupt a printed path containing Vietnamese text.
    const output = path.join(temporaryDirectory, 'media.%(ext)s');
    const refererArgs = request.referer ? ['--referer', request.referer] : [];
    const customHeaderArgs: string[] = [];
    if (request.httpHeaders) {
      for (const [key, val] of Object.entries(request.httpHeaders)) {
        if (key.toLowerCase() !== 'referer' && val) {
          customHeaderArgs.push('--add-header', `${key}: ${val}`);
        }
      }
    }
    const cookieArgs = request.cookieFile ? ['--cookies', request.cookieFile] : [];
    const args = ['--newline', '--no-playlist', '--no-overwrites', '--no-part', '--ffmpeg-location', path.dirname(ffmpeg), ...cookieArgs, ...refererArgs, ...customHeaderArgs, ...redditYtDlpArgs(request.sourceUrl), '-f', format, '--merge-output-format', 'mp4', '--progress-template', 'download:%(progress.downloaded_bytes)s|%(progress.total_bytes,progress.total_bytes_estimate)s|%(progress.speed)s|%(progress.eta)s|%(progress._percent_str)s', '-o', output, '--', request.sourceUrl];
    logger.info('DOWNLOAD_STARTED', { downloadId, videoId: request.videoId });
    onProgress({ downloadId, videoId: request.videoId, percent: 0, status: 'starting' });

    return new Promise((resolve, reject) => {
      const child = spawn(ytDlp, args, { windowsHide: true, shell: false });
      const task: ActiveDownload = { child, temporaryDirectory, cancelled: false }; this.active.set(downloadId, task);
      let stderr = '';
      const processLine = (line: string): void => {
        if (line.startsWith('download:')) onProgress(parseProgress(downloadId, request.videoId, line));
        else if (/merg/i.test(line)) { logger.info('MERGE_STARTED', { downloadId }); onProgress({ downloadId, videoId: request.videoId, percent: 100, status: 'merging' }); }
      };
      const readStdout = lineReader(processLine); const readStderr = lineReader(processLine);
      child.stdout.on('data', chunk => readStdout(chunk.toString()));
      child.stderr.on('data', chunk => { const value = chunk.toString(); stderr += value; readStderr(value); });
      child.once('error', async error => { this.active.delete(downloadId); await rm(temporaryDirectory, { recursive: true, force: true }); reject(new AppError('DOWNLOAD_FAILED', 'Could not start the download.', error.message)); });
      child.once('close', async code => {
        this.active.delete(downloadId);
        if (task.cancelled) { await rm(temporaryDirectory, { recursive: true, force: true }); onProgress({ downloadId, videoId: request.videoId, percent: 0, status: 'cancelled' }); return reject(new AppError('DOWNLOAD_CANCELLED', 'Download cancelled.')); }
        if (code !== 0) { await rm(temporaryDirectory, { recursive: true, force: true }); logger.error('DOWNLOAD_FAILED', { downloadId, code }); onProgress({ downloadId, videoId: request.videoId, percent: 0, status: 'error', message: /merg/i.test(stderr) ? 'Could not merge audio and video.' : 'Download failed.' }); return reject(new AppError(/merg/i.test(stderr) ? 'MERGE_FAILED' : 'DOWNLOAD_FAILED', /merg/i.test(stderr) ? 'Could not merge audio and video.' : 'Download failed.', stderr.slice(-1000))); }
        try {
          // Enumerating the directory preserves the real Unicode filename and is
          // more reliable than decoding yt-dlp's platform-dependent stdout.
          const file = await findOutputFile(temporaryDirectory);
          const destination = await moveWithoutOverwrite(file, request.outputDirectory, request.title);
          await rm(temporaryDirectory, { recursive: true, force: true }); this.completed.add(path.resolve(destination));
          logger.info('DOWNLOAD_COMPLETE', { downloadId }); onProgress({ downloadId, videoId: request.videoId, percent: 100, status: 'complete', filePath: destination }); resolve({ downloadId, filePath: destination });
        } catch (error) { await rm(temporaryDirectory, { recursive: true, force: true }); onProgress({ downloadId, videoId: request.videoId, percent: 100, status: 'error', message: 'Downloaded data could not be saved.' }); reject(new AppError('DOWNLOAD_FAILED', 'Downloaded data could not be saved.', error instanceof Error ? error.message : String(error))); }
      });
    });
  }

  async cancel(downloadId: string): Promise<boolean> {
    const task = this.active.get(downloadId); if (!task) return false; task.cancelled = true;
    if (process.platform === 'win32' && task.child.pid) spawn('taskkill', ['/pid', String(task.child.pid), '/t', '/f'], { windowsHide: true }); else task.child.kill('SIGTERM');
    return true;
  }
  isCompletedFile(file: string): boolean { return this.completed.has(path.resolve(file)); }
}

function validateRequest(request: DownloadRequest): void {
  if (!request.videoId || !request.selectedFormatId || !request.title || !path.isAbsolute(request.outputDirectory)) throw new AppError('INVALID_OUTPUT', 'Choose a valid output folder.');
  let url: URL; try { url = new URL(request.sourceUrl); } catch { throw new AppError('INVALID_URL', 'The media URL is invalid.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new AppError('INVALID_URL', 'Only HTTP and HTTPS media URLs are supported.');
  if (request.referer) { try { const referer = new URL(request.referer); if (!['http:', 'https:'].includes(referer.protocol)) throw new Error(); } catch { throw new AppError('INVALID_URL', 'The media referrer is invalid.'); } }
}
function lineReader(onLine: (line: string) => void): (chunk: string) => void { let buffer = ''; return chunk => { buffer += chunk; const lines = buffer.split(/\r?\n/); buffer = lines.pop() ?? ''; lines.forEach(onLine); }; }
function parseNumber(value: string): number | undefined { const number = Number(value.trim()); return Number.isFinite(number) ? number : undefined; }
function parseProgress(downloadId: string, videoId: string, line: string): DownloadProgress {
  const [downloaded, total, speed, eta, percent] = line.slice('download:'.length).split('|');
  return { downloadId, videoId, downloadedBytes: parseNumber(downloaded), totalBytes: parseNumber(total), speed: speed && speed !== 'NA' ? speed : undefined, eta: eta && eta !== 'NA' ? eta : undefined, percent: Math.max(0, Math.min(100, parseFloat(percent) || 0)), status: 'downloading' };
}
async function findOutputFile(directory: string): Promise<string> {
  const files = await readdir(directory); for (const file of files) { const candidate = path.join(directory, file); if ((await stat(candidate)).isFile()) return candidate; }
  throw new Error('No output file was produced.');
}
