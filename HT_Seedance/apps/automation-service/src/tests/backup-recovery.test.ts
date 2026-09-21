import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { JobState } from '@ht-dola/shared';
import { openDatabase, type SqliteDatabase } from '../db/database.js';
import { ProjectRepository, JobRepository } from '../db/repositories/index.js';
import { BackupService } from '../services/BackupService.js';
import { RestoreService } from '../services/RestoreService.js';
import { MaintenanceLock, maintenanceCoordinator } from '../services/MaintenanceService.js';
import { PathRelinkService } from '../services/PathRelinkService.js';
import { DatabaseRecoveryService } from '../services/DatabaseRecoveryService.js';
import { ProductionQueueService } from '../services/ProductionQueueService.js';
const roots: string[] = [],
  databases: SqliteDatabase[] = [];
const context = (name: string) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `backup-${name}-`));
  roots.push(root);
  const dbPath = path.join(root, 'ht_dola_studio.db'),
    db = openDatabase(dbPath);
  databases.push(db);
  const project = new ProjectRepository(db).create({ name, description: '' });
  return { root, dbPath, db, project };
};
afterEach(() => {
  maintenanceCoordinator.leave();
  for (const db of databases.splice(0)) if (db.open) db.close();
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});
const job = (projectId: string, scene: number, inputMedia: Record<string, string> = {}) => ({
  projectId,
  sceneNumber: scene,
  provider: 'mock',
  prompt: `Prompt ${scene}`,
  inputMedia,
  durationSeconds: 5,
  aspectRatio: '16:9' as const,
  resolution: '720p',
  status: JobState.QUEUED,
  priority: 0,
  maxAttempts: 3,
});
describe('Phase 19 backup and disaster recovery', () => {
  it('creates a consistent WAL backup with manifest, checksums, and 1,000 jobs', async () => {
    const c = context('wal'),
      jobs = new JobRepository(c.db);
    jobs.createMany(Array.from({ length: 1000 }, (_, i) => job(c.project.id, i + 1)));
    c.db
      .prepare("INSERT INTO settings VALUES ('theme','\"dark\"',?)")
      .run(new Date().toISOString());
    const destination = path.join(c.root, 'backups'),
      service = new BackupService(c.db, c.root),
      created = await service.create({ destination });
    assert.equal(service.verify(created.path).valid, true);
    const snapshot = openDatabase(path.join(created.path, 'database', 'ht_dola_studio.db'));
    assert.equal(new JobRepository(snapshot).list({ limit: 1, offset: 0 }).total, 1000);
    assert.equal(String(snapshot.pragma('quick_check', { simple: true })), 'ok');
    snapshot.close();
  });
  it('detects tamper, corrupted package, traversal, and newer schema', async () => {
    const c = context('security'),
      destination = path.join(c.root, 'backups'),
      service = new BackupService(c.db, c.root),
      created = await service.create({ destination });
    fs.appendFileSync(path.join(created.path, 'database', 'ht_dola_studio.db'), 'tamper');
    assert.equal(service.verify(created.path).valid, false);
    const created2 = await service.create({ destination });
    const manifestFile = path.join(created2.path, 'manifest.json'),
      manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    manifest.schemaVersion = 999;
    fs.writeFileSync(manifestFile, JSON.stringify(manifest));
    assert.equal(
      new RestoreService(c.db, c.dbPath, c.root).preview(created2.path).compatibility,
      'NEWER_THAN_APPLICATION',
    );
    manifest.files['../../evil'] = { sha256: '0'.repeat(64), size: 0 };
    fs.writeFileSync(manifestFile, JSON.stringify(manifest));
    assert.equal(service.verify(created2.path).valid, false);
  });
  it('restores through staging and rolls back injected failure', async () => {
    const c = context('restore'),
      jobs = new JobRepository(c.db);
    jobs.create(job(c.project.id, 1));
    const backups = path.join(c.root, 'backups'),
      created = await new BackupService(c.db, c.root).create({ destination: backups });
    jobs.create(job(c.project.id, 2));
    const restore = new RestoreService(c.db, c.dbPath, c.root);
    await restore.restore(created.path, {
      confirmation: true,
      safetyDestination: path.join(c.root, 'safety'),
      beforeSwitch: () => c.db.close(),
    });
    const restored = openDatabase(c.dbPath);
    databases.push(restored);
    assert.equal(new JobRepository(restored).list({ limit: 10, offset: 0 }).total, 1);
    restored.close();
    const live = openDatabase(c.dbPath);
    databases.push(live);
    const second = await new BackupService(live, c.root).create({
      destination: path.join(c.root, 'second'),
    });
    new JobRepository(live).create(job(c.project.id, 2));
    const rollback = new RestoreService(live, c.dbPath, c.root);
    await assert.rejects(
      () =>
        rollback.restore(second.path, {
          confirmation: true,
          safetyDestination: path.join(c.root, 'rollback-safety'),
          beforeSwitch: () => live.close(),
          injectFailure: 'AFTER_SWITCH',
        }),
      /INJECTED/,
    );
    const checked = openDatabase(c.dbPath);
    databases.push(checked);
    assert.equal(new JobRepository(checked).list({ limit: 10, offset: 0 }).total, 2);
  });
  it('optionally backs up disposable profiles and applies retention/scheduling', async () => {
    const c = context('profiles'),
      profile = path.join(c.root, 'profiles', 'p1');
    fs.mkdirSync(profile, { recursive: true });
    fs.writeFileSync(path.join(profile, 'Cookies'), 'fixture-session');
    const service = new BackupService(c.db, c.root),
      destination = path.join(c.root, 'backups');
    for (let i = 0; i < 4; i++)
      await service.create({ destination, type: 'FULL', includeProfiles: true });
    assert.ok(
      fs.existsSync(
        path.join(
          fs.readdirSync(destination).map((name) => path.join(destination, name))[0]!,
          'optional',
          'profiles',
          'p1',
          'Cookies',
        ),
      ),
    );
    assert.equal(service.enforceRetention(destination, 3).length, 3);
    assert.equal(service.shouldRunAutomatic(null, 'WEEKLY'), true);
    assert.equal(service.shouldRunAutomatic(new Date().toISOString(), 'DAILY'), false);
    const packagePath = fs
      .readdirSync(destination)
      .map((name) => path.join(destination, name))
      .find((candidate) => service.verify(candidate).valid)!;
    fs.writeFileSync(path.join(profile, 'Cookies'), 'changed-after-backup');
    await new RestoreService(c.db, c.dbPath, c.root).restore(packagePath, {
      confirmation: true,
      safetyDestination: path.join(c.root, 'safety'),
      beforeSwitch: () => c.db.close(),
    });
    assert.equal(fs.readFileSync(path.join(profile, 'Cookies'), 'utf8'), 'fixture-session');
  });
  it('relinks only controlled path prefixes and reports missing media', () => {
    const c = context('relink'),
      jobs = new JobRepository(c.db);
    jobs.create(job(c.project.id, 1, { image: 'D:\\OLD\\images\\001.png' }));
    jobs.create(job(c.project.id, 2, { image: 'D:\\OLD\\images\\002.png' }));
    const service = new PathRelinkService(c.db);
    assert.equal(service.preview('D:\\OLD', 'E:\\NEW').jobs, 2);
    service.commit('D:\\OLD', 'E:\\NEW');
    assert.equal(
      new JobRepository(c.db)
        .getById(jobs.list({ limit: 1, offset: 0 }).items[0]!.id)
        ?.inputMedia.image?.startsWith('E:\\NEW'),
      true,
    );
    assert.equal(service.missingMedia().images, 2);
  });
  it('detects corruption, preserves evidence, and blocks queue during maintenance', () => {
    const c = context('recovery'),
      queue = new ProductionQueueService(c.db);
    new JobRepository(c.db).create(job(c.project.id, 1));
    maintenanceCoordinator.enter('RECOVERY');
    assert.throws(
      () => queue.queue(new JobRepository(c.db).list({ limit: 1, offset: 0 }).items[0]!.id),
      /frozen/,
    );
    maintenanceCoordinator.leave();
    c.db.close();
    fs.writeFileSync(c.dbPath, 'not a sqlite database');
    const recovery = new DatabaseRecoveryService(c.dbPath, path.join(c.root, 'recovery'));
    assert.equal(recovery.quickCheck().safe, false);
    assert.ok(fs.existsSync(recovery.preserveCorruptedCopy()));
  });
  it('recovers stale maintenance locks and keeps active lock exclusive', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maintenance-'));
    roots.push(root);
    const file = path.join(root, '.lock'),
      first = new MaintenanceLock(file),
      second = new MaintenanceLock(file);
    first.acquire('BACKUP');
    assert.throws(() => second.acquire('RESTORE'));
    first.release();
    fs.writeFileSync(file, JSON.stringify({ pid: 99999999, operation: 'UPDATE' }));
    assert.doesNotThrow(() => second.acquire('RECOVERY'));
    second.release();
  });
});
