import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { SqliteDatabase } from '../db/database.js';
import { appConfig } from '../config/app-config.js';
import { browserManager } from '../browser/browser-manager.js';
import { MaintenanceLock, maintenanceCoordinator } from './MaintenanceService.js';
import { logger } from '../logging/logger.js';
export const BackupManifestSchema = z.object({
  formatVersion: z.literal(1),
  appVersion: z.string(),
  schemaVersion: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  backupType: z.enum(['DATA', 'FULL', 'PRE_UPDATE', 'PRE_RESTORE', 'PRE_MIGRATION']),
  components: z.object({
    database: z.literal(true),
    settings: z.literal(true),
    projectMetadata: z.literal(true),
    profiles: z.boolean(),
    outputs: z.boolean(),
    logs: z.boolean(),
  }),
  files: z.record(
    z.object({ sha256: z.string().regex(/^[a-f0-9]{64}$/), size: z.number().int().nonnegative() }),
  ),
  counts: z.object({
    projects: z.number().int().nonnegative(),
    jobs: z.number().int().nonnegative(),
    accounts: z.number().int().nonnegative(),
    outputs: z.number().int().nonnegative(),
  }),
  sensitiveSessionData: z.boolean(),
});
export type BackupManifest = z.infer<typeof BackupManifestSchema>;
export type BackupType = BackupManifest['backupType'];
export interface BackupOptions {
  destination: string;
  type?: BackupType;
  includeProfiles?: boolean;
  includeOutputs?: boolean;
  includeLogs?: boolean;
  notes?: string;
}
const APP_VERSION = '1.0.0';
const sha = (file: string) => {
  const hash = createHash('sha256');
  hash.update(fs.readFileSync(file));
  return hash.digest('hex');
};
const bytes = (root: string): number => {
  if (!fs.existsSync(root)) return 0;
  const stat = fs.statSync(root);
  if (stat.isFile()) return stat.size;
  return fs.readdirSync(root).reduce((sum, name) => sum + bytes(path.join(root, name)), 0);
};
const safeRelative = (value: string) => {
  if (path.isAbsolute(value) || value.split(/[\\/]/).includes('..'))
    throw new Error('BACKUP_PATH_TRAVERSAL');
  return value.replaceAll('\\', '/');
};
const copyTree = (
  source: string,
  target: string,
  exclude: (relative: string) => boolean,
  base = source,
) => {
  if (!fs.existsSync(source)) return;
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name),
      relative = path.relative(base, from);
    if (exclude(relative)) continue;
    const to = path.join(target, relative);
    if (entry.isDirectory()) {
      fs.mkdirSync(to, { recursive: true });
      copyTree(from, target, exclude, base);
    } else {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
    }
  }
};
export class BackupService {
  constructor(
    private readonly db: SqliteDatabase,
    private readonly dataDir = appConfig.dataDir,
    private readonly lock = new MaintenanceLock(path.join(dataDir, '.maintenance.lock')),
  ) {}
  estimate(options: Omit<BackupOptions, 'destination'>) {
    return {
      database: bytes(path.join(this.dataDir, 'ht_dola_studio.db')),
      profiles: options.includeProfiles ? bytes(path.join(this.dataDir, 'profiles')) : 0,
      outputs: options.includeOutputs ? bytes(path.join(this.dataDir, 'projects')) : 0,
      logs: options.includeLogs ? bytes(path.join(this.dataDir, 'logs')) : 0,
    };
  }
  async create(options: BackupOptions) {
    const type = options.type ?? 'DATA',
      id = randomUUID(),
      stamp = new Date()
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}Z$/, ''),
      name = `HT_Dola_Studio_Backup_${stamp}_${id.slice(0, 8)}.htbackup`,
      final = path.join(path.resolve(options.destination), name),
      temp = fs.mkdtempSync(path.join(os.tmpdir(), 'htds-backup-')),
      createdAt = new Date().toISOString();
    fs.mkdirSync(options.destination, { recursive: true });
    const estimate = Object.values(this.estimate(options)).reduce((sum, value) => sum + value, 0);
    const disk = fs.statfsSync(path.resolve(options.destination));
    const available = disk.bavail * disk.bsize;
    if (available < Math.max(estimate * 1.1, 10 * 1024 * 1024)) {
      fs.rmSync(temp, { recursive: true, force: true });
      throw new Error('DISK_SPACE_INSUFFICIENT');
    }
    this.lock.acquire(options.type === 'PRE_UPDATE' ? 'UPDATE' : 'BACKUP');
    maintenanceCoordinator.enter('BACKUP');
    try {
      this.record(id, final, type, 'CREATING', createdAt, 0, options.notes);
      logger.info({ event: 'backup_started', backup_type: type }, 'Backup started.');
      if (fs.existsSync(final)) throw new Error('Backup destination already exists.');
      fs.mkdirSync(path.join(temp, 'database'), { recursive: true });
      await this.db.backup(path.join(temp, 'database', 'ht_dola_studio.db'));
      this.writeJson(
        temp,
        'config/settings.json',
        Object.fromEntries(
          (
            this.db.prepare('SELECT key,value_json FROM settings').all() as Array<{
              key: string;
              value_json: string;
            }>
          ).map((row) => [row.key, JSON.parse(row.value_json)]),
        ),
      );
      this.writeJson(
        temp,
        'projects/projects.json',
        this.db.prepare('SELECT * FROM projects').all(),
      );
      this.writeJson(
        temp,
        'metadata/accounts.json',
        this.db.prepare('SELECT * FROM accounts').all(),
      );
      this.writeJson(
        temp,
        'metadata/browser_profiles.json',
        this.db.prepare('SELECT * FROM browser_profiles').all(),
      );
      if (options.includeProfiles) {
        const running = (
          this.db.prepare('SELECT id FROM browser_profiles').all() as { id: string }[]
        ).filter((row) => browserManager.isProfileRunning(row.id));
        if (running.length) throw new Error('PROFILE_ACTIVE');
        copyTree(
          path.join(this.dataDir, 'profiles'),
          path.join(temp, 'optional/profiles'),
          (relative) => /Cache|Code Cache|GPUCache|\.lock$/i.test(relative),
        );
      }
      if (options.includeOutputs)
        copyTree(
          path.join(this.dataDir, 'projects'),
          path.join(temp, 'optional/outputs'),
          (relative) => relative.endsWith('.part'),
        );
      if (options.includeLogs)
        copyTree(
          path.join(this.dataDir, 'logs'),
          path.join(temp, 'logs'),
          (relative) => relative.includes('.auth_token') || /provider-diagnostics/i.test(relative),
        );
      const files: BackupManifest['files'] = {};
      for (const file of this.files(temp)) {
        const relative = safeRelative(path.relative(temp, file));
        files[relative] = { sha256: sha(file), size: fs.statSync(file).size };
      }
      const schema = (
          this.db
            .prepare('SELECT COALESCE(MAX(version),0) version FROM schema_migrations')
            .get() as { version: number }
        ).version,
        counts = {
          projects: this.count('projects'),
          jobs: this.count('jobs'),
          accounts: this.count('accounts'),
          outputs: this.count('outputs'),
        };
      const manifest: BackupManifest = {
        formatVersion: 1,
        appVersion: APP_VERSION,
        schemaVersion: schema,
        createdAt,
        backupType: type,
        components: {
          database: true,
          settings: true,
          projectMetadata: true,
          profiles: Boolean(options.includeProfiles),
          outputs: Boolean(options.includeOutputs),
          logs: Boolean(options.includeLogs),
        },
        files,
        counts,
        sensitiveSessionData: Boolean(options.includeProfiles),
      };
      this.writeJson(temp, 'manifest.json', manifest);
      fs.renameSync(temp, final);
      this.record(id, final, type, 'VERIFYING', createdAt, bytes(final), options.notes);
      const verified = this.verify(final);
      this.record(
        id,
        final,
        type,
        verified.valid ? 'COMPLETED' : 'CORRUPTED',
        createdAt,
        bytes(final),
        verified.valid ? options.notes : verified.errors.join('; '),
        verified.valid ? new Date().toISOString() : undefined,
      );
      if (!verified.valid)
        throw new Error(`Backup verification failed: ${verified.errors.join(', ')}`);
      logger.info(
        { event: 'backup_completed', backup_type: type, bytes: bytes(final) },
        'Backup completed.',
      );
      return { id, path: final, manifest, size: bytes(final) };
    } catch (error) {
      this.record(
        id,
        final,
        type,
        'FAILED',
        createdAt,
        fs.existsSync(final) ? bytes(final) : 0,
        error instanceof Error ? error.message : String(error),
      );
      fs.rmSync(temp, { recursive: true, force: true });
      logger.error({ event: 'backup_failed', error }, 'Backup failed.');
      throw error;
    } finally {
      maintenanceCoordinator.leave();
      this.lock.release();
    }
  }
  verify(packagePath: string) {
    const errors: string[] = [];
    try {
      if (!fs.statSync(packagePath).isDirectory())
        throw new Error('Backup package is not a directory.');
      const manifest = BackupManifestSchema.parse(
        JSON.parse(fs.readFileSync(path.join(packagePath, 'manifest.json'), 'utf8')),
      );
      const entries = Object.entries(manifest.files);
      if (entries.length > 100_000) throw new Error('BACKUP_FILE_LIMIT_EXCEEDED');
      if (entries.reduce((sum, [, value]) => sum + value.size, 0) > 1024 ** 4)
        throw new Error('BACKUP_SIZE_LIMIT_EXCEEDED');
      if (!manifest.files['database/ht_dola_studio.db']) errors.push('DATABASE_MISSING');
      for (const [relative, expected] of Object.entries(manifest.files)) {
        safeRelative(relative);
        const file = path.resolve(packagePath, relative);
        if (!file.startsWith(`${path.resolve(packagePath)}${path.sep}`))
          errors.push('PATH_TRAVERSAL');
        else if (!fs.existsSync(file)) errors.push(`MISSING:${relative}`);
        else if (fs.statSync(file).size !== expected.size || sha(file) !== expected.sha256)
          errors.push(`CHECKSUM_MISMATCH:${relative}`);
      }
      return { valid: errors.length === 0, errors, manifest };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      return { valid: false, errors };
    }
  }
  enforceRetention(directory: string, keep = 5) {
    const candidates = fs.existsSync(directory)
      ? fs
          .readdirSync(directory)
          .filter((name) => name.endsWith('.htbackup'))
          .map((name) => path.join(directory, name))
          .filter((file) => this.verify(file).valid)
          .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
      : [];
    for (const old of candidates.slice(Math.max(1, keep)))
      fs.rmSync(old, { recursive: true, force: true });
    return candidates.slice(0, Math.max(1, keep));
  }
  shouldRunAutomatic(
    lastBackup: string | null,
    frequency: 'DAILY' | 'EVERY_3_DAYS' | 'WEEKLY',
    now = new Date(),
  ) {
    if (!lastBackup) return true;
    const days = { DAILY: 1, EVERY_3_DAYS: 3, WEEKLY: 7 }[frequency];
    return now.getTime() - new Date(lastBackup).getTime() >= days * 86400000;
  }
  private record(
    id: string,
    file: string,
    type: BackupType,
    status: string,
    created: string,
    size: number,
    notes?: string,
    verified?: string,
  ) {
    this.db
      .prepare(
        'INSERT INTO backups (id,file_path,backup_type,app_version,schema_version,size,status,created_at,verified_at,notes) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET size=excluded.size,status=excluded.status,verified_at=excluded.verified_at,notes=excluded.notes',
      )
      .run(
        id,
        file,
        type,
        APP_VERSION,
        (
          this.db
            .prepare('SELECT COALESCE(MAX(version),0) version FROM schema_migrations')
            .get() as { version: number }
        ).version,
        size,
        status,
        created,
        verified ?? null,
        notes ?? null,
      );
  }
  private writeJson(root: string, relative: string, value: unknown) {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value, null, 2));
  }
  private count(table: 'projects' | 'jobs' | 'accounts' | 'outputs') {
    return (this.db.prepare(`SELECT COUNT(*) count FROM ${table}`).get() as { count: number })
      .count;
  }
  private files(root: string): string[] {
    const found: string[] = [];
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      const file = path.join(root, entry.name);
      if (entry.isDirectory()) found.push(...this.files(file));
      else found.push(file);
    }
    return found;
  }
}
