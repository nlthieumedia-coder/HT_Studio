import { contextBridge, ipcRenderer } from 'electron';
import type { DownloadProgress, DownloadRequest, DownloadResult, ScanResult, SerializedAppError } from '../shared/types';

// A sandboxed preload cannot require local CommonJS modules. Keep this whitelist
// self-contained and ensure it mirrors src/main/ipc/channels.ts.
const IPC_CHANNELS = {
  scanUrl: 'scanner:scan-url', chooseDirectory: 'dialog:choose-directory', download: 'download:start',
  cancelDownload: 'download:cancel', downloadProgress: 'download:progress', openFile: 'shell:open-file', openFolder: 'shell:open-folder'
} as const;

export type ScanResponse = { ok: true; data: ScanResult } | { ok: false; error: SerializedAppError };
export type DownloadResponse = { ok: true; data: DownloadResult } | { ok: false; error: SerializedAppError };
contextBridge.exposeInMainWorld('htDownloader', {
  scanUrl: (url: string, options?: { maxVideos?: number }): Promise<ScanResponse> => ipcRenderer.invoke(IPC_CHANNELS.scanUrl, url, options) as Promise<ScanResponse>,
  chooseDirectory: (): Promise<string | undefined> => ipcRenderer.invoke(IPC_CHANNELS.chooseDirectory) as Promise<string | undefined>,
  download: (request: DownloadRequest): Promise<DownloadResponse> => ipcRenderer.invoke(IPC_CHANNELS.download, request) as Promise<DownloadResponse>,
  cancelDownload: (id: string): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.cancelDownload, id) as Promise<boolean>,
  openFile: (file: string): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.openFile, file) as Promise<boolean>,
  openFolder: (file: string): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.openFolder, file) as Promise<boolean>,
  onDownloadProgress: (listener: (progress: DownloadProgress) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: DownloadProgress): void => listener(progress);
    ipcRenderer.on(IPC_CHANNELS.downloadProgress, handler); return () => ipcRenderer.removeListener(IPC_CHANNELS.downloadProgress, handler);
  }
});
