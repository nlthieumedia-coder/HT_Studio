import { spawn, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageDirectory = resolve(scriptDirectory, '..');
const typeScriptCli = resolve(packageDirectory, 'node_modules', 'typescript', 'bin', 'tsc');

const initialBuild = spawnSync(process.execPath, [typeScriptCli, '-b'], {
  cwd: packageDirectory,
  stdio: 'inherit',
});

if (initialBuild.status !== 0) {
  process.exit(initialBuild.status ?? 1);
}

await import('./copy-static.mjs');

const compiler = spawn(process.execPath, [typeScriptCli, '-w', '--preserveWatchOutput'], {
  cwd: packageDirectory,
  stdio: 'inherit',
});
const service = spawn(process.execPath, ['--watch', 'dist/index.js'], {
  cwd: packageDirectory,
  stdio: 'inherit',
});

let shuttingDown = false;
const shutdown = (exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  compiler.kill();
  service.kill();
  process.exitCode = exitCode;
};

compiler.on('exit', (code) => {
  if (!shuttingDown && code !== 0) shutdown(code ?? 1);
});
service.on('exit', (code) => {
  if (!shuttingDown && code !== 0) shutdown(code ?? 1);
});
process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());
