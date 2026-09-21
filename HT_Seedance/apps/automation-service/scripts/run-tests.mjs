import path from 'node:path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const browsers = path.resolve(process.cwd(), '..', '..', 'data', 'browsers');
const tests = fs.readdirSync(path.resolve(process.cwd(), 'dist', 'tests')).filter((file) => file.endsWith('.test.js')).map((file) => path.join('dist', 'tests', file));
const result = spawnSync(process.execPath, ['--test', ...tests], {
  cwd: process.cwd(),
  env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: browsers },
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
