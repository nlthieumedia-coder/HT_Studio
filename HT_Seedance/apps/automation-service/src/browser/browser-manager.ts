import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { appConfig } from '../config/app-config.js';
import { type BrowserContext, chromium } from 'playwright';
import { logger } from '../logging/logger.js';

export type BrowserMode = 'visible' | 'background';
export interface BrowserInstance { profileId: string; context: BrowserContext; mode: BrowserMode; startedAt: string }

export class ProfileLock {
  private readonly locks = new Map<string, string>();
  constructor(private readonly profilesDir = appConfig.profilesDir) {}
  private lockPath(id: string) { return path.join(this.profilesDir, id, '.ht-dola.lock'); }
  acquire(id: string) {
    const target = this.lockPath(id);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (fs.existsSync(target)) {
      try {
        const saved = JSON.parse(fs.readFileSync(target, 'utf8')) as { pid: number };
        try { process.kill(saved.pid, 0); throw new Error('Profile is already running.'); }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ESRCH') fs.rmSync(target, { force: true });
          else throw error;
        }
      } catch (error) {
        if (error instanceof Error && error.message === 'Profile is already running.') throw error;
        fs.rmSync(target, { force: true });
      }
    }
    const token = crypto.randomUUID();
    fs.writeFileSync(target, JSON.stringify({ pid: process.pid, token, createdAt: new Date().toISOString() }), { encoding: 'utf8', flag: 'wx' });
    this.locks.set(id, token);
  }
  release(id: string) { this.locks.delete(id); fs.rmSync(this.lockPath(id), { force: true }); }
  isLocked(id: string) {
    if (this.locks.has(id)) return true;
    const target = this.lockPath(id);
    if (!fs.existsSync(target)) return false;
    try {
      const saved = JSON.parse(fs.readFileSync(target, 'utf8')) as { pid: number };
      process.kill(saved.pid, 0);
      return true;
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code === 'ESRCH' ||
        error instanceof SyntaxError
      ) {
        fs.rmSync(target, { force: true });
        return false;
      }
      return true;
    }
  }
}

export class BrowserManager {
  private contexts = new Map<string, BrowserInstance>();
  private locks: ProfileLock;
  constructor(private readonly profilesDir = appConfig.profilesDir) { this.locks = new ProfileLock(profilesDir); }
  private profilePath(id: string) {
    const target = path.resolve(this.profilesDir, id);
    if (path.dirname(target) !== path.resolve(this.profilesDir)) throw new Error('Invalid profile path.');
    return target;
  }
  async launchProfile(profileId: string, mode: BrowserMode = 'visible'): Promise<BrowserInstance> {
    const existing = this.contexts.get(profileId);
    if (existing) return existing;
    const pPath = this.profilePath(profileId);
    this.locks.acquire(profileId);
    try {
      const storageStateFile = path.join(pPath, 'storage-state.json');
      const hasStorageState = fs.existsSync(storageStateFile);
      const localChromium = path.resolve(appConfig.dataDir, 'browsers', 'chromium-1243', 'chrome-win64', 'chrome.exe');
      const threeBigChromium = path.join(process.env.LOCALAPPDATA ?? '', 'Programs', '3 BIG Studio', '_internal', 'patchright', 'driver', 'package', '.local-browsers', 'chromium-1234', 'chrome-win', 'chrome.exe');
      const systemChrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
      const executablePath = [localChromium, threeBigChromium, systemChrome].find((candidate) => fs.existsSync(candidate));
      const extensionPath = fileURLToPath(new URL('./dola30-extension', import.meta.url));
      const extensionEnabled = mode === 'visible' && fs.existsSync(path.join(extensionPath, 'manifest.json'));

      const context = await chromium.launchPersistentContext(pPath, {
        headless: mode === 'background',
        ...(executablePath ? { executablePath } : {}),
        ...(hasStorageState ? { storageState: storageStateFile } : {}),
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
          '--disable-infobars',
          ...(extensionEnabled
            ? [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
            : []),
        ],
        ignoreDefaultArgs: ['--enable-automation'],
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      });
      const instance = { profileId, context, mode, startedAt: new Date().toISOString() };
      this.contexts.set(profileId, instance);
      context.once('close', () => {
        if (this.contexts.get(profileId)?.context === context) {
          this.contexts.delete(profileId);
          this.locks.release(profileId);
          logger.info({ profileId }, 'Released browser profile after context closed');
        }
      });
      logger.info({ profileId, mode, native30sExtension: extensionEnabled }, 'Launched persistent Chromium profile');
      return instance;
    } catch (error) { this.locks.release(profileId); throw error; }
  }
  async closeProfile(profileId: string) {
    const instance = this.contexts.get(profileId);
    if (instance) {
      try {
        const storageStateFile = path.join(this.profilePath(profileId), 'storage-state.json');
        await instance.context.storageState({ path: storageStateFile }).catch(() => {});
      } catch {}
      await instance.context.close().catch(() => {});
      this.contexts.delete(profileId);
    }
    this.locks.release(profileId);
    logger.info({ profileId }, 'Closed browser profile');
  }
  isProfileRunning(profileId: string) { return this.contexts.has(profileId) || this.locks.isLocked(profileId); }
  get openCount() { return this.contexts.size; }
  async closeAll() { for (const id of [...this.contexts.keys()]) await this.closeProfile(id); }
}

export const browserManager = new BrowserManager();
