import { dialog, ipcMain, shell } from 'electron';
import { IPC_CHANNELS } from './channels';
import { serializeError } from '../utils/app-error';
import type { ScanService } from '../scanner/scan-service';
import type { DownloadManager } from '../downloader/download-manager';
import type { DownloadRequest } from '../../shared/types';
import path from 'node:path';

export function registerIpcHandlers(scanner: ScanService, downloads: DownloadManager): void {
  const allowedDirectories = new Set<string>();
  ipcMain.handle(IPC_CHANNELS.scanUrl, async (_event, input: unknown, options?: { maxVideos?: number }) => {
    if (typeof input !== 'string') return { ok: false as const, error: { code: 'INVALID_URL' as const, message: 'URL must be a string.' } };
    try { return { ok: true as const, data: await scanner.scanUrl(input, options) }; }
    catch (error) { return { ok: false as const, error: serializeError(error) }; }
  });
  ipcMain.handle(IPC_CHANNELS.chooseDirectory, async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
    if (result.canceled) return undefined;
    const directory = path.resolve(result.filePaths[0]); allowedDirectories.add(directory); return directory;
  });
  ipcMain.handle(IPC_CHANNELS.download, async (event, request: DownloadRequest) => {
    if (!request || typeof request.outputDirectory !== 'string' || !path.isAbsolute(request.outputDirectory)) return { ok: false as const, error: { code: 'INVALID_OUTPUT' as const, message: 'Choose a valid output folder.' } };
    allowedDirectories.add(path.resolve(request.outputDirectory));
    try { return { ok: true as const, data: await downloads.download(request, progress => event.sender.send(IPC_CHANNELS.downloadProgress, progress)) }; }
    catch (error) { return { ok: false as const, error: serializeError(error) }; }
  });
  ipcMain.handle(IPC_CHANNELS.cancelDownload, (_event, id: unknown) => typeof id === 'string' ? downloads.cancel(id) : false);
  ipcMain.handle(IPC_CHANNELS.openFile, async (_event, file: unknown) => {
    if (typeof file !== 'string' || !downloads.isCompletedFile(file)) return false;
    return (await shell.openPath(file)) === '';
  });
  ipcMain.handle(IPC_CHANNELS.openFolder, (_event, file: unknown) => {
    if (typeof file !== 'string' || !downloads.isCompletedFile(file)) return false;
    shell.showItemInFolder(file); return true;
  });
}
