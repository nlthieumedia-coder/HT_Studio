import path from 'node:path';
import { app, BrowserWindow } from 'electron';
import { registerIpcHandlers } from './ipc/register-handlers';
import { BinaryManager } from './media/binary-manager';
import { ScanService } from './scanner/scan-service';
import { YtDlpAnalyzer } from './scanner/ytdlp-analyzer';
import { DownloadManager } from './downloader/download-manager';
import { TikTokAuth } from './auth/tiktok-auth';
import { LicenseService } from './license/license-service';

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1160, height: 780, minWidth: 760, minHeight: 620,
    backgroundColor: '#181818',
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#12171e', symbolColor: '#dce2ea', height: 42 },
    icon: app.isPackaged ? path.join(process.resourcesPath, 'branding', 'logo_icon.png') : path.join(app.getAppPath(), '..', 'Logo', 'logo_icon.png'),
    webPreferences: { preload: path.join(__dirname, '../preload/preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  window.maximize();
  void window.loadFile(path.join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.htstudio.downloader');
  const binaries = new BinaryManager();
  const tiktokAuth = new TikTokAuth(app.getPath('userData'));
  const license = new LicenseService(app.getPath('userData'));
  registerIpcHandlers(new ScanService(new YtDlpAnalyzer(binaries)), new DownloadManager(binaries), tiktokAuth, license);
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
