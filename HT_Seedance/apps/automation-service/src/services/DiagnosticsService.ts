import fs from 'node:fs';
import path from 'node:path';
import { appConfig } from '../config/app-config.js';
import type { SqliteDatabase } from '../db/database.js';
import { LogRepository } from '../db/repositories/LogRepository.js';
import { WorkerRepository } from '../db/repositories/WorkerRepository.js';
import { getMigrationStatus } from '../db/migrations.js';
import { mediaToolDiagnostics } from './MediaToolkit.js';
import { getChromiumInstallationStatus } from './BrowserInstallationService.js';

export class DiagnosticsService {
  constructor(private readonly database: SqliteDatabase) {}

  health() {
    const dbOk = Boolean(this.database.prepare('SELECT 1 value').get());
    const chromiumStatus = getChromiumInstallationStatus();
    const storage = [appConfig.dataDir, appConfig.logsDir, appConfig.projectsDir, appConfig.tempDir, appConfig.browsersDir].map((dir) => ({
      path: dir,
      exists: fs.existsSync(dir),
      writable: canWrite(dir),
    }));
    const workers = new WorkerRepository(this.database).list();
    const backup = this.database
      .prepare("SELECT verified_at AS verifiedAt,file_path AS filePath FROM backups WHERE status='COMPLETED' ORDER BY verified_at DESC LIMIT 1")
      .get() as { verifiedAt: string; filePath: string } | undefined;
    return {
      database: { ok: dbOk, schemaVersion: getMigrationStatus(this.database).at(-1)?.version ?? 0 },
      backend: { ok: true, version: '1.0.0', uptimeSeconds: Math.floor(process.uptime()) },
      playwright: { ok: chromiumStatus.ok, browsersDir: chromiumStatus.browsersDir },
      chromium: { ok: chromiumStatus.ok, path: chromiumStatus.executablePath },
      ffmpeg: mediaToolDiagnostics(),
      storage,
      workers: { ok: workers.every((worker) => worker.state !== 'ERROR'), items: workers },
      backup: {
        ok: Boolean(backup),
        lastVerifiedAt: backup?.verifiedAt ?? null,
        filePath: backup?.filePath ?? null,
      },
    };
  }

  exportPackage() {
    const now = new Date().toISOString().replaceAll(':', '-');
    const target = path.join(appConfig.logsDir, `diagnostics-${now}.json`);
    const logs = new LogRepository(this.database).list(200, 0).items.map((log) => sanitize(log));
    const payload = {
      exportedAt: new Date().toISOString(),
      application: { name: 'HT Dola Studio', version: '1.0.0' },
      configuration: {
        env: appConfig.env,
        host: appConfig.host,
        port: appConfig.port,
        dataDir: appConfig.dataDir,
        profilesDir: '[REDACTED]',
        projectsDir: appConfig.projectsDir,
        downloadsDir: appConfig.downloadsDir,
        logsDir: appConfig.logsDir,
        tempDir: appConfig.tempDir,
        browsersDir: appConfig.browsersDir,
        authToken: '[REDACTED]',
      },
      recentLogs: logs,
      databaseSchemaVersion: getMigrationStatus(this.database).at(-1)?.version ?? 0,
      workerStates: new WorkerRepository(this.database).list(),
      health: this.health(),
      excluded: ['browser profiles', 'cookies', 'auth tokens', 'passwords', 'browser storage'],
    };
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(payload, null, 2), 'utf8');
    return { path: target, bytes: fs.statSync(target).size };
  }
}

const canWrite = (dir: string) => {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, `.write-test-${process.pid}`);
    fs.writeFileSync(probe, 'ok');
    fs.rmSync(probe, { force: true });
    return true;
  } catch {
    return false;
  }
};

const sensitiveKey = /password|token|cookie|secret|storage/i;
const sanitize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        sensitiveKey.test(key) ? '[REDACTED]' : sanitize(nested),
      ]),
    );
  }
  return value;
};
