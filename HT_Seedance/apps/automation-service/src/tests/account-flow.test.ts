import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase, type SqliteDatabase } from '../db/database.js';
import { AccountService } from '../services/AccountService.js';
import { AccountRepository } from '../db/repositories/AccountRepository.js';
import { BrowserProfileRepository } from '../db/repositories/BrowserProfileRepository.js';
import { ProfileLock } from '../browser/browser-manager.js';
const dbs: SqliteDatabase[] = [],
  dirs: string[] = [];
afterEach(() => {
  dbs.splice(0).forEach((db) => db.close());
  dirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});
const setup = (state: 'AUTHENTICATED' | 'LOGIN_REQUIRED' | 'UNKNOWN' | 'ERROR' = 'UNKNOWN') => {
  const db = openDatabase(':memory:');
  dbs.push(db);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'account-flow-'));
  dirs.push(root);
  let running = false;
  const browser = {
    isProfileRunning: () => running,
    launchProfile: async () => {
      running = true;
    },
  };
  return { db, root, browser, service: new AccountService(db, root, browser, async () => state) };
};
describe('account and browser profile flow', () => {
  it('atomically creates and links a persistent profile', () => {
    const x = setup(),
      account = x.service.create({ displayName: 'QA_DOLA_01', provider: 'Dola', enabled: true });
    assert.equal(account.sessionStatus, 'UNKNOWN');
    assert.ok(account.browserProfileId);
    const profile = new BrowserProfileRepository(x.db).getById(account.browserProfileId!);
    assert.ok(profile && fs.statSync(profile.profileDirectory).isDirectory());
    assert.equal(profile!.profileDirectory, path.join(x.root, profile!.id));
  });
  it('rolls back records and files when account insert fails', () => {
    const x = setup();
    x.db.exec(
      `CREATE TRIGGER fail_account BEFORE INSERT ON accounts BEGIN SELECT RAISE(ABORT,'forced'); END;`,
    );
    assert.throws(() =>
      x.service.create({ displayName: 'broken', provider: 'dola', enabled: true }),
    );
    assert.equal(new AccountRepository(x.db).list({ limit: 10, offset: 0 }).total, 0);
    assert.equal(new BrowserProfileRepository(x.db).list().length, 0);
    assert.equal(fs.readdirSync(x.root).length, 0);
  });
  it('opens visibly once and returns a stable running error', async () => {
    const x = setup(),
      account = x.service.create({ displayName: 'open', provider: 'dola', enabled: true });
    await x.service.openProfile(account.id);
    await assert.rejects(
      x.service.openProfile(account.id),
      (error: unknown) => (error as {code?:string}).code === 'PROFILE_ALREADY_RUNNING',
    );
  });
  it('updates session status and timestamp without submitting', async () => {
    const x = setup('LOGIN_REQUIRED'),
      account = x.service.create({ displayName: 'session', provider: 'dola', enabled: true }),
      updated = await x.service.checkSession(account.id);
    assert.equal(updated.sessionStatus, 'LOGIN_REQUIRED');
    assert.ok(updated.lastSessionCheck);
  });
  it('removes metadata but retains profile directory and record', () => {
    const x = setup(),
      account = x.service.create({ displayName: 'keep', provider: 'dola', enabled: true }),
      profileId = account.browserProfileId!;
    const directory = new BrowserProfileRepository(x.db).getById(profileId)!.profileDirectory;
    x.service.deleteMetadata(account.id);
    assert.ok(fs.existsSync(directory));
    assert.ok(new BrowserProfileRepository(x.db).getById(profileId));
  });
  it('enforces the disposable profile lock lifecycle', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'profile-lock-'));
    dirs.push(root);
    const first = new ProfileLock(root),
      second = new ProfileLock(root);
    first.acquire('profile');
    assert.throws(() => second.acquire('profile'));
    first.release('profile');
    assert.doesNotThrow(() => second.acquire('profile'));
    second.release('profile');
  });
});
