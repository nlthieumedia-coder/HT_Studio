const { spawn, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectDir = path.resolve(__dirname, '..');
const electronPath = require('electron');
const watchedFiles = [
  path.join(projectDir, 'main.cjs'),
  path.join(projectDir, 'preload.js'),
];

let electronProcess = null;
let restartTimer = null;
let closing = false;

function startElectron() {
  electronProcess = spawn(electronPath, ['main.cjs'], {
    cwd: projectDir,
    stdio: 'inherit',
    env: { ...process.env, ELECTRON_START_URL: 'http://localhost:5173' },
  });
  electronProcess.once('exit', () => {
    electronProcess = null;
    if (!closing) console.log('[DEV] Electron đã đóng. Sửa main.cjs/preload.js hoặc nhấn Ctrl+C để kết thúc.');
  });
}

function stopElectron() {
  return new Promise((resolve) => {
    if (!electronProcess || electronProcess.exitCode !== null) return resolve();
    const pid = electronProcess.pid;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    electronProcess.once('exit', finish);
    if (process.platform === 'win32') {
      execFile('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, () => {
        const poll = setInterval(() => {
          try {
            process.kill(pid, 0);
          } catch (_) {
            clearInterval(poll);
            finish();
          }
        }, 100);
        setTimeout(() => {
          clearInterval(poll);
          finish();
        }, 5000);
      });
    } else {
      electronProcess.kill('SIGTERM');
      setTimeout(finish, 1500);
    }
  });
}

async function restartElectron(fileName) {
  console.log(`[DEV] Phát hiện thay đổi ${fileName}. Đang khởi động lại Electron...`);
  await stopElectron();
  if (!closing) startElectron();
}

for (const filePath of watchedFiles) {
  fs.watch(filePath, () => {
    clearTimeout(restartTimer);
    restartTimer = setTimeout(() => restartElectron(path.basename(filePath)), 400);
  });
}

async function shutdown() {
  if (closing) return;
  closing = true;
  clearTimeout(restartTimer);
  await stopElectron();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
startElectron();
