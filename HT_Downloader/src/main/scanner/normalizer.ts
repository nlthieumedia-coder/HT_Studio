import { createHash } from 'node:crypto';
import type { VideoFormat, VideoItem } from '../../shared/types';
import type { YtDlpEntry, YtDlpFormat } from './ytdlp-types';

const isPresent = (codec?: string): boolean => Boolean(codec && codec !== 'none');
const hash = (value: string): string => createHash('sha256').update(value).digest('hex').slice(0, 16);

function inferredHeight(format: YtDlpFormat): number | undefined {
  if (format.height) return format.height;
  const match = format.resolution?.match(/(?:\d+)x(\d+)/i);
  return match ? Number(match[1]) : undefined;
}

export function qualityLabel(format: YtDlpFormat): string {
  const height = inferredHeight(format) ?? (format.width ? Math.round(format.width * 9 / 16) : undefined);
  const base = height ? `${height}p` : isPresent(format.vcodec) ? 'Video' : 'Audio';
  return format.fps && format.fps > 30 ? `${base} • ${Math.round(format.fps)} FPS` : base;
}

function normalizeFormat(format: YtDlpFormat, index: number): VideoFormat | null {
  const hasVideo = isPresent(format.vcodec);
  const hasAudio = isPresent(format.acodec);
  if (!hasVideo) return null;
  const formatId = format.format_id ?? String(index);
  return {
    id: formatId, formatId, qualityLabel: qualityLabel(format), width: format.width,
    height: inferredHeight(format), fps: format.fps, extension: format.ext,
    videoCodec: format.vcodec, audioCodec: format.acodec, sourceUrl: format.url,
    protocol: format.protocol,
    fileSize: format.filesize ?? format.filesize_approx, hasVideo, hasAudio
  };
}

function flatten(entry: YtDlpEntry): YtDlpEntry[] {
  if (!entry.entries?.length) return [entry];
  return entry.entries.filter((item): item is YtDlpEntry => item !== null).flatMap(flatten);
}

export function normalizeYtDlp(root: YtDlpEntry, requestedUrl: string): VideoItem[] {
  return flatten(root).map((entry, entryIndex) => {
    const sourceUrl = entry.webpage_url ?? entry.original_url ?? requestedUrl;
    const identity = `${entry.extractor_key ?? entry.extractor ?? ''}:${entry.id ?? sourceUrl}:${entry.duration ?? ''}`;
    const formats = (entry.formats ?? []).map(normalizeFormat).filter((item): item is VideoFormat => item !== null);
    if (formats.length === 0) {
      formats.push({
        id: 'direct:best',
        formatId: 'direct:best',
        qualityLabel: 'HD Video',
        hasVideo: true,
        hasAudio: true,
        sourceUrl
      });
    }

    let timestamp: number | undefined = entry.timestamp;
    if (!timestamp && entry.upload_date && /^\d{8}$/.test(entry.upload_date)) {
      const year = parseInt(entry.upload_date.slice(0, 4), 10);
      const month = parseInt(entry.upload_date.slice(4, 6), 10) - 1;
      const day = parseInt(entry.upload_date.slice(6, 8), 10);
      timestamp = Math.floor(Date.UTC(year, month, day) / 1000);
    }

    return {
      id: hash(identity || `${sourceUrl}:${entryIndex}`),
      title: entry.title?.trim() || `Video ${entryIndex + 1}`,
      thumbnail: entry.thumbnail,
      duration: entry.duration,
      timestamp,
      uploadDate: entry.upload_date,
      sourceType: 'ytdlp' as const,
      sourceUrl,
      formats: deduplicateFormats(formats)
    };
  }).filter(video => video.formats.length > 0);
}

export function deduplicateFormats(formats: VideoFormat[]): VideoFormat[] {
  const best = new Map<string, VideoFormat>();
  for (const format of formats) {
    const key = `${format.height ?? 0}:${Math.round(format.fps ?? 0)}:${format.extension ?? ''}:${format.hasAudio}`;
    const current = best.get(key);
    if (!current || (format.fileSize ?? 0) > (current.fileSize ?? 0)) best.set(key, format);
  }
  return [...best.values()].sort((a, b) => (b.height ?? 0) - (a.height ?? 0) || (b.fps ?? 0) - (a.fps ?? 0));
}

export function deduplicateVideos(videos: VideoItem[]): VideoItem[] {
  const grouped = new Map<string, VideoItem>();
  for (const video of videos) {
    const key = `${video.sourceUrl}|${video.title.toLowerCase()}|${Math.round(video.duration ?? 0)}`;
    const existing = grouped.get(key);
    if (existing) existing.formats = deduplicateFormats([...existing.formats, ...video.formats]);
    else grouped.set(key, { ...video, formats: [...video.formats] });
  }
  const result = [...grouped.values()];
  if (result.some(v => typeof v.timestamp === 'number')) {
    result.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
  }
  return result;
}
