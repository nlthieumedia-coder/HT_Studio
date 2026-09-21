import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serviceRoot = path.join(root, 'apps', 'automation-service');
const tauriRoot = path.join(root, 'apps', 'desktop', 'src-tauri');
const resourcesRoot = path.join(tauriRoot, 'resources');
const serviceResource = path.join(resourcesRoot, 'automation-service');
const nodeResource = path.join(resourcesRoot, 'node');
const deployTemp = path.join(serviceRoot, '.sidecar-deploy');
const rootDeployTemp = path.join(root, '.sidecar-deploy');
const sharedRoot = path.join(root, 'packages', 'shared');
const legacyWrongServiceResource = path.join(
  root,
  'apps',
  'automation-service',
  'apps',
  'desktop',
  'src-tauri',
  'resources',
  'automation-service',
);
const quoteWindowsArg = (value) => {
  const text = String(value);
  return /[\s&()^|<>"]/.test(text) ? `"${text.replaceAll('"', '\\"')}"` : text;
};
const execPnpm = (args, cwd = root) => {
  if (process.platform === 'win32') {
    execFileSync(
      process.env.ComSpec || 'cmd.exe',
      ['/d', '/c', ['pnpm', ...args.map(quoteWindowsArg)].join(' ')],
      { cwd, stdio: 'inherit' },
    );
    return;
  }
  execFileSync('pnpm', args, { cwd, stdio: 'inherit' });
};
const execNpm = (args, cwd) => {
  if (process.platform === 'win32') {
    execFileSync(
      process.env.ComSpec || 'cmd.exe',
      ['/d', '/c', ['npm', ...args.map(quoteWindowsArg)].join(' ')],
      { cwd, stdio: 'inherit' },
    );
    return;
  }
  execFileSync('npm', args, { cwd, stdio: 'inherit' });
};

const removeDir = (target) => {
  if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
};

const readJson = (target) => JSON.parse(fs.readFileSync(target, 'utf8'));
const writeJson = (target, value) => {
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

console.log('Building automation service...');
execPnpm(['--filter', '@ht-dola/automation-service', 'build']);

console.log('Preparing Tauri production resources...');
removeDir(serviceResource);
removeDir(nodeResource);
removeDir(deployTemp);
removeDir(rootDeployTemp);
removeDir(legacyWrongServiceResource);
fs.mkdirSync(resourcesRoot, { recursive: true });
fs.mkdirSync(nodeResource, { recursive: true });

console.log('Packaging production service runtime...');
fs.mkdirSync(serviceResource, { recursive: true });
fs.cpSync(path.join(serviceRoot, 'dist'), path.join(serviceResource, 'dist'), { recursive: true });
removeDir(path.join(serviceResource, 'dist', 'tests'));

const servicePackage = readJson(path.join(serviceRoot, 'package.json'));
const runtimeDependencies = Object.fromEntries(
  Object.entries(servicePackage.dependencies ?? {}).filter(([, version]) => !String(version).startsWith('workspace:')),
);
writeJson(path.join(serviceResource, 'package.json'), {
  name: servicePackage.name,
  version: servicePackage.version,
  private: true,
  type: servicePackage.type,
  main: servicePackage.main,
  dependencies: runtimeDependencies,
});

console.log('Installing production service dependencies...');
execNpm(['install', '--omit=dev', '--no-audit', '--no-fund'], serviceResource);

const sharedPackage = readJson(path.join(sharedRoot, 'package.json'));
const sharedTarget = path.join(serviceResource, 'node_modules', '@ht-dola', 'shared');
fs.mkdirSync(sharedTarget, { recursive: true });
fs.cpSync(path.join(sharedRoot, 'dist'), path.join(sharedTarget, 'dist'), { recursive: true });
writeJson(path.join(sharedTarget, 'package.json'), {
  name: sharedPackage.name,
  version: sharedPackage.version,
  private: true,
  type: sharedPackage.type,
  main: sharedPackage.main,
});

const nodeSource = process.execPath;
const nodeTarget = path.join(nodeResource, process.platform === 'win32' ? 'node.exe' : 'node');
fs.copyFileSync(nodeSource, nodeTarget);

const manifest = {
  generatedAt: new Date().toISOString(),
  service: '@ht-dola/automation-service',
  serviceEntry: 'automation-service/dist/index.js',
  nodeRuntime: `node/${path.basename(nodeTarget)}`,
  dataLocation: '%APPDATA%/HT_Dola_Studio/data',
  browserLocation: '%APPDATA%/HT_Dola_Studio/browsers',
};
fs.writeFileSync(path.join(resourcesRoot, 'production-manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

console.log(`Prepared automation service resource: ${serviceResource}`);
console.log(`Prepared Node runtime resource: ${nodeTarget}`);
