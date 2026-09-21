import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AccountCreateInput } from '@ht-dola/shared';
import type { SqliteDatabase } from '../db/database.js';
import { AccountRepository } from '../db/repositories/AccountRepository.js';
import { BrowserProfileRepository } from '../db/repositories/BrowserProfileRepository.js';
import { appConfig } from '../config/app-config.js';
import { browserManager } from '../browser/browser-manager.js';
import { AppError, NotFoundError } from '../api/errors.js';
import { DolaProvider } from '../providers/dola/dola-provider.js';
type SessionState = 'AUTHENTICATED' | 'LOGIN_REQUIRED' | 'UNKNOWN' | 'ERROR';
interface AccountBrowser {
  isProfileRunning(id: string): boolean;
  launchProfile(id: string, mode: 'visible'): Promise<unknown>;
}
export class AccountService {
  private accounts: AccountRepository;
  private profiles: BrowserProfileRepository;
  constructor(
    private db: SqliteDatabase,
    private profilesDir = appConfig.profilesDir,
    private browser: AccountBrowser = browserManager,
    private inspectSession: (provider: string, profileId: string) => Promise<SessionState> = async (
      provider,
      profileId,
    ) => (provider === 'dola' ? (await new DolaProvider().inspect(profileId)).state : 'UNKNOWN'),
  ) {
    this.accounts = new AccountRepository(db);
    this.profiles = new BrowserProfileRepository(db);
  }
  create(input: Omit<AccountCreateInput, 'browserProfileId'>) {
    const profileId = randomUUID(),
      profilePath = path.join(this.profilesDir, profileId);
    let made = false;
    try {
      return this.db.transaction(() => {
        if (fs.existsSync(profilePath))
          throw new AppError('PROFILE_PATH_FAILED', 'Profile path already exists.', 409);
        fs.mkdirSync(profilePath, { recursive: false });
        made = true;
        this.profiles.createWithId(profileId, {
          name: `${input.displayName} Profile`,
          profileDirectory: profilePath,
        });
        return this.accounts.create({
          ...input,
          provider: input.provider.toLowerCase(),
          browserProfileId: profileId,
        });
      })();
    } catch (error) {
      if (made) fs.rmSync(profilePath, { recursive: true, force: true });
      if (error instanceof AppError) throw error;
      throw new AppError(
        'ACCOUNT_CREATE_FAILED',
        'Account and browser profile could not be created.',
        500,
      );
    }
  }
  async openProfile(accountId: string) {
    const account = this.require(accountId);
    if (!account.browserProfileId)
      throw new AppError('PROFILE_CREATE_FAILED', 'Account has no browser profile.', 409);
    if (this.browser.isProfileRunning(account.browserProfileId))
      throw new AppError('PROFILE_ALREADY_RUNNING', 'Browser profile is already running.', 409);
    try {
      await this.browser.launchProfile(account.browserProfileId, 'visible');
      return { profileId: account.browserProfileId, running: true };
    } catch {
      throw new AppError('BROWSER_LAUNCH_FAILED', 'Browser profile could not be launched.', 500);
    }
  }
  async checkSession(accountId: string) {
    const account = this.require(accountId);
    if (!account.browserProfileId)
      throw new AppError('PROFILE_CREATE_FAILED', 'Account has no browser profile.', 409);
    try {
      const state = await this.inspectSession(account.provider, account.browserProfileId);
      const updated = this.accounts.updateSessionStatus(account.id, state);
      return updated!;
    } catch {
      const updated = this.accounts.updateSessionStatus(account.id, 'ERROR');
      if (updated) return updated;
      throw new AppError('SESSION_CHECK_FAILED', 'Session check failed.', 500);
    }
  }
  deleteMetadata(accountId: string) {
    const account = this.require(accountId);
    if (!this.accounts.delete(accountId)) throw new NotFoundError('Account not found.');
    return { removed: true, retainedProfileId: account.browserProfileId };
  }
  private require(id: string) {
    const account = this.accounts.getById(id);
    if (!account) throw new NotFoundError('Account not found.');
    return account;
  }
}
