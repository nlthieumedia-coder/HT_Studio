import { spawn } from 'node:child_process';
import type { YtDlpEntry } from './ytdlp-types';
import { BinaryManager } from '../media/binary-manager';
import { AppError } from '../utils/app-error';
import { redditYtDlpArgs } from './reddit';

export class YtDlpAnalyzer {
  constructor(private readonly binaries: BinaryManager) {}

  async analyze(url: string, options?: { playlistEnd?: number }): Promise<YtDlpEntry> {
    const executable = await this.binaries.resolve('yt-dlp');
    const playlistEnd = options?.playlistEnd ?? 10;
    return new Promise((resolve, reject) => {
      const child = spawn(executable, ['--dump-single-json', '--no-download', '--no-warnings', '--playlist-end', String(playlistEnd), ...redditYtDlpArgs(url), '--', url], { windowsHide: true, shell: false });
      const stdout: Buffer[] = []; const stderr: Buffer[] = [];
      const timer = setTimeout(() => {
        child.kill();
        reject(new AppError('SCAN_FAILED', 'Phân tích liên kết vượt quá thời gian cho phép (Timeout).'));
      }, 25000);

      child.stdout.on('data', chunk => stdout.push(Buffer.from(chunk)));
      child.stderr.on('data', chunk => stderr.push(Buffer.from(chunk)));
      child.once('error', error => { clearTimeout(timer); reject(new AppError('SCAN_FAILED', 'Could not start yt-dlp.', error.message)); });
      child.once('close', code => {
        clearTimeout(timer);
        const errorText = Buffer.concat(stderr).toString('utf8').trim();
        if (code !== 0) return reject(classifyYtDlpError(errorText));
        try { resolve(JSON.parse(Buffer.concat(stdout).toString('utf8')) as YtDlpEntry); }
        catch (error) { reject(new AppError('SCAN_FAILED', 'yt-dlp returned invalid data.', error instanceof Error ? error.message : String(error))); }
      });
    });
  }
}

function classifyYtDlpError(message: string): AppError {
  const value = message.toLowerCase();
  if (/drm|widevine|fairplay|playready/.test(value)) return new AppError('DRM_PROTECTED', 'DRM protected content is not supported.');
  if (/login|sign in|cookies/.test(value)) return new AppError('LOGIN_REQUIRED', 'Login may be required.');
  if (/unsupported url/.test(value)) return new AppError('YTDLP_UNSUPPORTED', 'yt-dlp does not support this URL.');
  if (/unable to download|http error|connection|timed out/.test(value)) return new AppError('NETWORK_ERROR', 'Could not access the page.', message);
  return new AppError('SCAN_FAILED', 'The video could not be analyzed.', message);
}
