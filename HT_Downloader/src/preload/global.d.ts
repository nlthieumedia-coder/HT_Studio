import type { DownloadProgress, DownloadRequest } from '../shared/types';
import type { DownloadResponse, ScanResponse } from './preload';
declare global {
  interface Window { htDownloader: {
    scanUrl(url: string, options?: { maxVideos?: number }): Promise<ScanResponse>;
    chooseDirectory(): Promise<string | undefined>;
    download(request: DownloadRequest): Promise<DownloadResponse>;
    cancelDownload(id: string): Promise<boolean>;
    openFile(file: string): Promise<boolean>;
    openFolder(file: string): Promise<boolean>;
    onDownloadProgress(listener: (progress: DownloadProgress) => void): () => void;
  } }
}
export {};
