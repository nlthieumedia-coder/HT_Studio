import type { DownloadProgress, DownloadRequest, LicenseActivationResult, LicenseStatus } from '../shared/types';
import type { DownloadResponse, ScanResponse } from './preload';
declare global {
  interface Window { htDownloader: {
    scanUrl(url: string, options?: { maxVideos?: number }): Promise<ScanResponse>;
    chooseDirectory(): Promise<string | undefined>;
    download(request: DownloadRequest): Promise<DownloadResponse>;
    cancelDownload(id: string): Promise<boolean>;
    openFile(file: string): Promise<boolean>;
    openFolder(file: string): Promise<boolean>;
    openExternal(url: string): Promise<boolean>;
    tiktokLogin(): Promise<{ success: boolean }>;
    tiktokStatus(): Promise<{ loggedIn: boolean }>;
    tiktokLogout(): Promise<boolean>;
    licenseCheck(): Promise<LicenseStatus>;
    licenseActivate(key: string): Promise<LicenseActivationResult>;
    licenseDeactivate(): Promise<boolean>;
    onDownloadProgress(listener: (progress: DownloadProgress) => void): () => void;
  } }
}
export {};
