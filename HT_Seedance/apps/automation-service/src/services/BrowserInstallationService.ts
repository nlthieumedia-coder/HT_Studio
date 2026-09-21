import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { appConfig } from '../config/app-config.js';
import { chromium } from 'playwright';
import { logger } from '../logging/logger.js';

const require = createRequire(import.meta.url);

export interface BrowserInstallationStatus {
  ok: boolean;
  executablePath: string;
  browsersDir: string;
  installed: boolean;
  attemptedInstall: boolean;
  error?: string;
}

export const getChromiumInstallationStatus = (): BrowserInstallationStatus => {
  const executablePath = chromium.executablePath();
  return {
    ok: fs.existsSync(executablePath),
    executablePath,
    browsersDir: appConfig.browsersDir,
    installed: fs.existsSync(executablePath),
    attemptedInstall: false,
  };
};

export const ensureChromiumInstalled = (): BrowserInstallationStatus => {
  const current = getChromiumInstallationStatus();
  if (current.ok) return current;

  try {
    const cli = require.resolve('playwright/cli');
    logger.warn({ browsersDir: appConfig.browsersDir }, 'Chromium is missing; installing Playwright Chromium browser.');
    const result = spawnSync(process.execPath, [cli, 'install', 'chromium'], {
      cwd: process.cwd(),
      env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: appConfig.browsersDir },
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 10 * 60 * 1000,
    });
    if (result.status !== 0) {
      const error = [result.stderr, result.stdout].filter(Boolean).join('\n').trim();
      logger.error({ error }, 'Playwright Chromium installation failed.');
      return { ...getChromiumInstallationStatus(), attemptedInstall: true, error };
    }
    return { ...getChromiumInstallationStatus(), attemptedInstall: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ error: message }, 'Playwright Chromium installation check failed.');
    return { ...getChromiumInstallationStatus(), attemptedInstall: true, error: message };
  }
};
