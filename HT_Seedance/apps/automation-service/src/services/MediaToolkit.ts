import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

export interface MediaProbe {
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  fileSize: number;
  checksumSha256: string;
}

export interface MediaToolDiagnostics {
  ffmpeg: { path: string; available: boolean; version: string | null; error: string | null };
  ffprobe: { path: string; available: boolean; version: string | null; error: string | null };
}

const runVersion = (binary: string) => {
  const result = spawnSync(binary, ['-version'], { encoding: 'utf8' });
  if (result.error)
    return { path: binary, available: false, version: null, error: result.error.message };
  if (result.status !== 0)
    return { path: binary, available: false, version: null, error: result.stderr || 'Command failed.' };
  return {
    path: binary,
    available: true,
    version: result.stdout.split(/\r?\n/)[0] ?? null,
    error: null,
  };
};

export const mediaToolDiagnostics = (): MediaToolDiagnostics => ({
  ffmpeg: runVersion(process.env.HT_DOLA_FFMPEG_PATH || 'ffmpeg'),
  ffprobe: runVersion(process.env.HT_DOLA_FFPROBE_PATH || 'ffprobe'),
});

export const sha256File = (filePath: string): string => {
  const hash = createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
};

const parseFps = (value: string | undefined): number | null => {
  if (!value || value === '0/0') return null;
  const [rawNumerator, rawDenominator] = value.split('/');
  const numerator = Number(rawNumerator);
  const denominator = Number(rawDenominator ?? 1);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  return numerator / denominator;
};

export const probeMediaFile = (filePath: string): MediaProbe => {
  if (!fs.existsSync(filePath)) throw new Error('Media file does not exist.');
  const fileSize = fs.statSync(filePath).size;
  const checksumSha256 = sha256File(filePath);
  const empty = {
    durationSeconds: null,
    width: null,
    height: null,
    fps: null,
    videoCodec: null,
    audioCodec: null,
    fileSize,
    checksumSha256,
  };
  const ffprobe = process.env.HT_DOLA_FFPROBE_PATH || 'ffprobe';
  const result = spawnSync(
    ffprobe,
    [
      '-v',
      'error',
      '-show_entries',
      'format=duration:stream=codec_type,codec_name,width,height,avg_frame_rate',
      '-of',
      'json',
      filePath,
    ],
    { encoding: 'utf8' },
  );
  if (result.error || result.status !== 0 || !result.stdout) return empty;
  try {
    const data = JSON.parse(result.stdout) as {
      format?: { duration?: string };
      streams?: Array<{
        codec_type?: string;
        codec_name?: string;
        width?: number;
        height?: number;
        avg_frame_rate?: string;
      }>;
    };
    const video = data.streams?.find((stream) => stream.codec_type === 'video');
    const audio = data.streams?.find((stream) => stream.codec_type === 'audio');
    const duration = Number(data.format?.duration);
    return {
      durationSeconds: Number.isFinite(duration) ? duration : null,
      width: video?.width ?? null,
      height: video?.height ?? null,
      fps: parseFps(video?.avg_frame_rate),
      videoCodec: video?.codec_name ?? null,
      audioCodec: audio?.codec_name ?? null,
      fileSize,
      checksumSha256,
    };
  } catch {
    return empty;
  }
};

export const faststartMp4 = (source: string, target: string): boolean => {
  const ffmpeg = process.env.HT_DOLA_FFMPEG_PATH || 'ffmpeg';
  const result = spawnSync(
    ffmpeg,
    ['-y', '-i', source, '-c', 'copy', '-movflags', '+faststart', target],
    { encoding: 'utf8' },
  );
  return !result.error && result.status === 0;
};
