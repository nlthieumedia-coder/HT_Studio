import { BrowserWindow, dialog, Menu } from 'electron';
import { join } from 'node:path';

function installVietnameseMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Tệp', submenu: [{ role: 'quit', label: 'Thoát' }] },
    { label: 'Chỉnh sửa', submenu: [
      { role: 'undo', label: 'Hoàn tác' }, { role: 'redo', label: 'Làm lại' }, { type: 'separator' },
      { role: 'cut', label: 'Cắt' }, { role: 'copy', label: 'Sao chép' }, { role: 'paste', label: 'Dán' },
      { role: 'selectAll', label: 'Chọn tất cả' },
    ] },
    { label: 'Hiển thị', submenu: [
      { role: 'reload', label: 'Tải lại' }, { role: 'forceReload', label: 'Buộc tải lại' }, { type: 'separator' },
      { role: 'resetZoom', label: 'Cỡ mặc định' }, { role: 'zoomIn', label: 'Phóng to' }, { role: 'zoomOut', label: 'Thu nhỏ' },
      { role: 'togglefullscreen', label: 'Toàn màn hình' },
    ] },
    { label: 'Cửa sổ', submenu: [{ role: 'minimize', label: 'Thu nhỏ' }, { role: 'close', label: 'Đóng' }] },
    { label: 'Trợ giúp', submenu: [{ label: 'Giới thiệu HT Craw Video', click: () => void dialog.showMessageBox({ type: 'info', title: 'Giới thiệu', message: 'HT Craw Video', detail: 'Công cụ tìm kiếm và phân tích video hoàn toàn cục bộ.' }) }] },
  ]));
}

export function createMainWindow() {
  installVietnameseMenu();
  const win = new BrowserWindow({ width: 1440, height: 900, minWidth: 1100, minHeight: 700, backgroundColor: '#0d1520', show: false, webPreferences: { preload: join(__dirname, '../../preload/index.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true } });
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('did-fail-load', (_event, code, description, url) => { void dialog.showMessageBox(win, { type: 'error', title: 'Không thể tải giao diện', message: `Không thể tải giao diện (mã ${code})`, detail: `${description}\n${url}` }); });
  const dev = process.env.VITE_DEV_SERVER_URL;
  if (dev) void win.loadURL(dev); else void win.loadFile(join(__dirname, '../../renderer/index.html'));
  return win;
}
