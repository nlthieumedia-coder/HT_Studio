export type SourceType = 'ytdlp' | 'direct' | 'hls' | 'dash' | 'embedded';

export interface VideoFormat {
  id: string;
  qualityLabel: string;
  width?: number;
  height?: number;
  fps?: number;
  extension?: string;
  videoCodec?: string;
  audioCodec?: string;
  fileSize?: number;
  hasVideo: boolean;
  hasAudio: boolean;
  formatId?: string;
  sourceUrl?: string;
  protocol?: string;
}

export interface VideoItem {
  id: string;
  title: string;
  thumbnail?: string;
  duration?: number;
  timestamp?: number;
  uploadDate?: string;
  sourceType: SourceType;
  formats: VideoFormat[];
  sourceUrl: string;
}

export interface ScanResult {
  pageUrl: string;
  pageTitle?: string;
  videos: VideoItem[];
}

export interface DownloadRequest {
  videoId: string;
  sourceUrl: string;
  selectedFormatId: string;
  selectedHasAudio?: boolean;
  outputDirectory: string;
  title: string;
}

export interface DownloadProgress {
  downloadId: string;
  videoId: string;
  percent: number;
  downloadedBytes?: number;
  totalBytes?: number;
  speed?: string;
  eta?: string;
  status: 'starting' | 'downloading' | 'merging' | 'complete' | 'error' | 'cancelled';
  message?: string;
  filePath?: string;
}

export interface DownloadResult { downloadId: string; filePath: string }

export type AppErrorCode =
  | 'INVALID_URL' | 'YTDLP_MISSING' | 'YTDLP_UNSUPPORTED' | 'PAGE_INACCESSIBLE'
  | 'NETWORK_ERROR' | 'NO_VIDEO' | 'LOGIN_REQUIRED' | 'DRM_PROTECTED' | 'SCAN_FAILED'
  | 'FFMPEG_MISSING' | 'DOWNLOAD_FAILED' | 'DOWNLOAD_CANCELLED' | 'MERGE_FAILED' | 'INVALID_OUTPUT' | 'NOT_FOUND';

export interface SerializedAppError { code: AppErrorCode; message: string; details?: string }
