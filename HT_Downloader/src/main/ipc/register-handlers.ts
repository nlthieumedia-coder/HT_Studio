import { dialog, ipcMain, shell } from 'electron';
import { IPC_CHANNELS } from './channels';
import { serializeError } from '../utils/app-error';
import type { ScanService } from '../scanner/scan-service';
import type { DownloadManager } from '../downloader/download-manager';
import type { DownloadRequest } from '../../shared/types';
import path from 'node:path';

import type { TikTokAuth } from '../auth/tiktok-auth';
import type { LicenseService } from '../license/license-service';
import fs from 'node:fs';

export function registerIpcHandlers(scanner: ScanService, downloads: DownloadManager, tiktokAuth: TikTokAuth, license: LicenseService): void {
  const allowedDirectories = new Set<string>();
  ipcMain.handle(IPC_CHANNELS.scanUrl, async (_event, input: unknown, options?: { maxVideos?: number }) => {
    if (typeof input !== 'string') return { ok: false as const, error: { code: 'INVALID_URL' as const, message: 'URL must be a string.' } };
    try {
      const cookieFile = fs.existsSync(tiktokAuth.getCookiesFilePath()) ? tiktokAuth.getCookiesFilePath() : undefined;
      return { ok: true as const, data: await scanner.scanUrl(input, { ...options, cookieFile }) };
    }
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
    const cookieFile = request.cookieFile ?? (fs.existsSync(tiktokAuth.getCookiesFilePath()) ? tiktokAuth.getCookiesFilePath() : undefined);
    try { return { ok: true as const, data: await downloads.download({ ...request, cookieFile }, progress => event.sender.send(IPC_CHANNELS.downloadProgress, progress)) }; }
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
  ipcMain.handle(IPC_CHANNELS.openExternal, async (_event, value: unknown) => {
    if (typeof value !== 'string') return false;
    try {
      const url = new URL(value);
      const allowedHosts = new Set(['zalo.me', 'chat.zalo.me', 't.me', 'telegram.me']);
      if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname.toLowerCase())) return false;
      await shell.openExternal(url.toString());
      return true;
    } catch {
      return false;
    }
  });
  ipcMain.handle(IPC_CHANNELS.tiktokLogin, async () => {
    return await tiktokAuth.openLoginWindow();
  });
  ipcMain.handle(IPC_CHANNELS.tiktokStatus, async () => {
    return await tiktokAuth.getLoginStatus();
  });
  ipcMain.handle(IPC_CHANNELS.tiktokLogout, async () => {
    return await tiktokAuth.logout();
  });
  ipcMain.handle(IPC_CHANNELS.licenseCheck, async () => await license.check());
  ipcMain.handle(IPC_CHANNELS.licenseActivate, async (_event, key: unknown) => {
    if (typeof key !== 'string') return { ok: false, hwid: 'UNKNOWN', error: 'Mã bản quyền không hợp lệ.' };
    return await license.activate(key);
  });
  ipcMain.handle(IPC_CHANNELS.licenseDeactivate, async () => await license.deactivate());
}
