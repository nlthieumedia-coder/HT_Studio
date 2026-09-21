import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageDirectory = resolve(scriptDirectory, '..');
const source = resolve(packageDirectory, 'src', 'db', 'migrations');
const destination = resolve(packageDirectory, 'dist', 'db', 'migrations');

if (!existsSync(source)) {
  throw new Error(`Migration source directory does not exist: ${source}`);
}

mkdirSync(destination, { recursive: true });
cpSync(source, destination, { recursive: true, force: true });
