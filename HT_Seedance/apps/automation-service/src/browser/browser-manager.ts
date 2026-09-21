import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
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
  isLocked(id: string) { return this.locks.has(id) || fs.existsSync(this.lockPath(id)); }
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
    this.profilePath(profileId);
    this.locks.acquire(profileId);
    try {
      const context = await chromium.launchPersistentContext(this.profilePath(profileId), { headless: mode === 'background' });
      const instance = { profileId, context, mode, startedAt: new Date().toISOString() };
      this.contexts.set(profileId, instance);
      logger.info({ profileId, mode }, 'Launched persistent Chromium profile');
      return instance;
    } catch (error) { this.locks.release(profileId); throw error; }
  }
  async closeProfile(profileId: string) {
    const instance = this.contexts.get(profileId);
    if (instance) { await instance.context.close(); this.contexts.delete(profileId); }
    this.locks.release(profileId);
    logger.info({ profileId }, 'Closed browser profile');
  }
  isProfileRunning(profileId: string) { return this.contexts.has(profileId) || this.locks.isLocked(profileId); }
  get openCount() { return this.contexts.size; }
  async closeAll() { for (const id of [...this.contexts.keys()]) await this.closeProfile(id); }
}

export const browserManager = new BrowserManager();
