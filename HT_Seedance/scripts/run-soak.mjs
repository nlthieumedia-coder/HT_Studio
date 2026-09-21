import { spawnSync } from 'node:child_process';

const value = process.argv.find((arg) => arg.startsWith('--duration='))?.split('=')[1] ?? '30m';
const units = { s: 1000, m: 60_000, h: 3_600_000 };
const match = /^(\d+)(s|m|h)$/.exec(value);
if (!match) throw new Error('Use --duration=30m, 2h, or 6h.');
const duration = Number(match[1]) * units[match[2]];
const deadline = Date.now() + duration;
let cycles = 0;
while (Date.now() < deadline) {
  const pnpmCli = process.env.npm_execpath;
  if (!pnpmCli) throw new Error('pnpm CLI path is unavailable; run this script through pnpm.');
  const executable = pnpmCli.toLowerCase().endsWith('.exe') ? pnpmCli : process.execPath;
  const args = pnpmCli.toLowerCase().endsWith('.exe')
    ? ['--filter', '@ht-dola/automation-service', 'test:performance']
    : [pnpmCli, '--filter', '@ht-dola/automation-service', 'test:performance'];
  const result = spawnSync(executable, args, {
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  cycles += 1;
}
console.info(`Soak completed: ${cycles} cycles in ${value}.`);
