import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import Database from 'better-sqlite3';
import { openDatabase, type SqliteDatabase } from '../db/database.js';
import { BackupService, type BackupManifest } from './BackupService.js';
import { MaintenanceLock, maintenanceCoordinator } from './MaintenanceService.js';
import { browserManager } from '../browser/browser-manager.js';
import { logger } from '../logging/logger.js';

export type BackupCompatibility =
  'COMPATIBLE' | 'MIGRATION_REQUIRED' | 'NEWER_THAN_APPLICATION' | 'INVALID';
export class RestoreService {
  constructor(
    private readonly currentDb: SqliteDatabase,
    private readonly currentDbPath: string,
    private readonly dataDir = path.dirname(currentDbPath),
    private readonly lock = new MaintenanceLock(path.join(dataDir, '.maintenance.lock')),
  ) {}
  preview(packagePath: string) {
    const result = new BackupService(this.currentDb, this.dataDir).verify(packagePath);
    if (!result.valid || !result.manifest)
      return { compatibility: 'INVALID' as const, errors: result.errors };
    const currentSchema = (
      this.currentDb
        .prepare('SELECT COALESCE(MAX(version),0) version FROM schema_migrations')
        .get() as { version: number }
    ).version;
    const manifest = result.manifest;
    const compatibility: BackupCompatibility =
      manifest.schemaVersion > currentSchema
        ? 'NEWER_THAN_APPLICATION'
        : manifest.schemaVersion < currentSchema
          ? 'MIGRATION_REQUIRED'
          : 'COMPATIBLE';
    return {
      compatibility,
      backupCreatedAt: manifest.createdAt,
      appVersion: manifest.appVersion,
      schemaVersion: manifest.schemaVersion,
      projects: manifest.counts.projects,
      jobs: manifest.counts.jobs,
      accounts: manifest.counts.accounts,
      outputs: manifest.counts.outputs,
      profilesIncluded: manifest.components.profiles,
      size: Object.values(manifest.files).reduce((sum, file) => sum + file.size, 0),
      sensitiveSessionData: manifest.sensitiveSessionData,
    };
  }
  async restore(
    packagePath: string,
    options: {
      confirmation: boolean;
      safetyDestination: string;
      beforeSwitch: () => Promise<unknown> | unknown;
      injectFailure?: 'AFTER_STAGE' | 'AFTER_SWITCH';
    },
  ) {
    if (!options.confirmation) throw new Error('RESTORE_CONFIRMATION_REQUIRED');
    const preview = this.preview(packagePath);
    if (preview.compatibility === 'INVALID') throw new Error('BACKUP_INVALID');
    if (preview.compatibility === 'NEWER_THAN_APPLICATION')
      throw new Error('BACKUP_NEWER_THAN_APPLICATION');
    await new BackupService(this.currentDb, this.dataDir).create({
      destination: options.safetyDestination,
      type: 'PRE_RESTORE',
      notes: 'Automatic safety backup before restore',
    });
    this.lock.acquire('RESTORE');
    maintenanceCoordinator.enter('RESTORE');
    logger.info({ event: 'restore_started' }, 'Restore started.');
    const stagingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'htds-restore-')),
      stagedDb = path.join(stagingRoot, 'ht_dola_studio.db'),
      rollback = `${this.currentDbPath}.pre-restore`;
    const manifest = readBackupManifest(packagePath);
    const requiredBytes = Object.values(manifest.files).reduce((sum, file) => sum + file.size, 0);
    const disk = fs.statfsSync(this.dataDir);
    if (disk.bavail * disk.bsize < Math.max(requiredBytes * 2.1, 10 * 1024 * 1024)) {
      fs.rmSync(stagingRoot, { recursive: true, force: true });
      maintenanceCoordinator.leave();
      this.lock.release();
      throw new Error('RESTORE_DISK_SPACE_INSUFFICIENT');
    }
    const swaps: Array<{ target: string; rollback: string }> = [];
    try {
      fs.copyFileSync(path.join(packagePath, 'database', 'ht_dola_studio.db'), stagedDb);
      for (const component of [
        { enabled: manifest.components.profiles, source: 'optional/profiles', target: 'profiles' },
        { enabled: manifest.components.outputs, source: 'optional/outputs', target: 'projects' },
      ]) {
        const source = path.join(packagePath, component.source);
        if (component.enabled && fs.existsSync(source))
          fs.cpSync(source, path.join(stagingRoot, component.target), { recursive: true });
      }
      const staged = openDatabase(stagedDb),
        quick = String(staged.pragma('quick_check', { simple: true })),
        foreign = staged.pragma('foreign_key_check') as unknown[];
      if (quick !== 'ok' || foreign.length) throw new Error('STAGED_DATABASE_INVALID');
      staged.close();
      if (options.injectFailure === 'AFTER_STAGE') throw new Error('INJECTED_RESTORE_FAILURE');
      await options.beforeSwitch();
      await browserManager.closeAll();
      if (fs.existsSync(rollback)) fs.rmSync(rollback, { force: true });
      fs.renameSync(this.currentDbPath, rollback);
      try {
        fs.renameSync(stagedDb, this.currentDbPath);
        for (const directory of ['profiles', 'projects']) {
          const stagedDirectory = path.join(stagingRoot, directory);
          if (!fs.existsSync(stagedDirectory)) continue;
          const target = path.join(this.dataDir, directory),
            directoryRollback = `${target}.pre-restore`;
          if (fs.existsSync(directoryRollback))
            fs.rmSync(directoryRollback, { recursive: true, force: true });
          if (fs.existsSync(target)) fs.renameSync(target, directoryRollback);
          fs.renameSync(stagedDirectory, target);
          swaps.push({ target, rollback: directoryRollback });
        }
        if (options.injectFailure === 'AFTER_SWITCH') throw new Error('INJECTED_RESTORE_FAILURE');
        const check = new Database(this.currentDbPath, { readonly: true }),
          valid = String(check.pragma('quick_check', { simple: true })) === 'ok';
        check.close();
        if (!valid) throw new Error('RESTORED_DATABASE_INVALID');
        for (const swap of swaps) fs.rmSync(swap.rollback, { recursive: true, force: true });
        fs.rmSync(rollback, { force: true });
        logger.info({ event: 'restore_completed' }, 'Restore completed.');
        return { restored: true, preview };
      } catch (error) {
        for (const swap of swaps.reverse()) {
          if (fs.existsSync(swap.target)) fs.rmSync(swap.target, { recursive: true, force: true });
          if (fs.existsSync(swap.rollback)) fs.renameSync(swap.rollback, swap.target);
        }
        if (fs.existsSync(this.currentDbPath)) fs.rmSync(this.currentDbPath, { force: true });
        if (fs.existsSync(rollback)) fs.renameSync(rollback, this.currentDbPath);
        throw error;
      }
    } catch (error) {
      logger.error(
        { event: 'restore_failed', error },
        'Restore failed and current data was preserved.',
      );
      throw error;
    } finally {
      fs.rmSync(stagingRoot, { recursive: true, force: true });
      maintenanceCoordinator.leave();
      this.lock.release();
    }
  }
}
export const readBackupManifest = (packagePath: string): BackupManifest =>
  JSON.parse(fs.readFileSync(path.join(packagePath, 'manifest.json'), 'utf8')) as BackupManifest;
