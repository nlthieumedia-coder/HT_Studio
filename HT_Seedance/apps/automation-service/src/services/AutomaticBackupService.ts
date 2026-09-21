import path from 'node:path';
import type { SqliteDatabase } from '../db/database.js';
import { appConfig } from '../config/app-config.js';
import { BackupService } from './BackupService.js';
import { logger } from '../logging/logger.js';

interface AutomaticBackupSettings {
  enabled: boolean;
  destination: string;
  frequency: 'DAILY' | 'EVERY_3_DAYS' | 'WEEKLY';
  localTime: string;
  retention: 3 | 5 | 7 | 10 | 20;
}

const defaults: AutomaticBackupSettings = {
  enabled: false,
  destination: path.join(appConfig.dataDir, 'backups'),
  frequency: 'DAILY',
  localTime: '02:00',
  retention: 5,
};

export class AutomaticBackupService {
  private timer: NodeJS.Timeout | undefined;
  constructor(
    private readonly db: SqliteDatabase,
    private readonly now = () => new Date(),
  ) {}
  settings(): AutomaticBackupSettings {
    const row = this.db
      .prepare("SELECT value_json FROM settings WHERE key='automatic_backup'")
      .get() as { value_json: string } | undefined;
    if (!row) return defaults;
    try {
      return { ...defaults, ...JSON.parse(row.value_json) };
    } catch {
      return defaults;
    }
  }
  save(settings: AutomaticBackupSettings) {
    this.db
      .prepare(
        "INSERT INTO settings(key,value_json,updated_at) VALUES('automatic_backup',?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at",
      )
      .run(JSON.stringify(settings), new Date().toISOString());
    return settings;
  }
  async runIfDue() {
    const settings = this.settings();
    if (!settings.enabled) return { ran: false, reason: 'DISABLED' };
    const now = this.now(),
      [hour = 2, minute = 0] = settings.localTime.split(':').map(Number);
    if (now.getHours() < hour || (now.getHours() === hour && now.getMinutes() < minute))
      return { ran: false, reason: 'BEFORE_SCHEDULE' };
    const latest = this.db
      .prepare(
        "SELECT created_at FROM backups WHERE status='COMPLETED' AND backup_type='DATA' ORDER BY created_at DESC LIMIT 1",
      )
      .get() as { created_at: string } | undefined;
    const backup = new BackupService(this.db);
    if (!backup.shouldRunAutomatic(latest?.created_at ?? null, settings.frequency, now))
      return { ran: false, reason: 'NOT_DUE' };
    const result = await backup.create({
      destination: settings.destination,
      type: 'DATA',
      notes: 'Automatic backup',
    });
    backup.enforceRetention(settings.destination, settings.retention);
    return { ran: true, result };
  }
  start() {
    if (this.timer) return;
    const tick = () =>
      this.runIfDue().catch((error) =>
        logger.error({ event: 'automatic_backup_failed', error }, 'Automatic backup failed.'),
      );
    void tick();
    this.timer = setInterval(tick, 60 * 60 * 1000);
    this.timer.unref();
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
}
