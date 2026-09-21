import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { appConfig } from '../config/app-config.js';
export type RecoveryModeState =
  { safe: true; quickCheck: 'ok' } | { safe: false; quickCheck: string; recoveryMode: true };
export class DatabaseRecoveryService {
  constructor(
    private readonly dbPath = appConfig.dbPath,
    private readonly recoveryDir = path.join(appConfig.dataDir, 'recovery'),
  ) {}
  quickCheck(): RecoveryModeState {
    let db: Database.Database | undefined;
    try {
      db = new Database(this.dbPath, { readonly: true, fileMustExist: true });
      const result = String(db.pragma('quick_check', { simple: true }));
      return result === 'ok'
        ? { safe: true, quickCheck: 'ok' }
        : { safe: false, quickCheck: result, recoveryMode: true };
    } catch (error) {
      return {
        safe: false,
        quickCheck: error instanceof Error ? error.message : String(error),
        recoveryMode: true,
      };
    } finally {
      if (db?.open) db.close();
    }
  }
  fullIntegrityCheck() {
    let db: Database.Database | undefined;
    try {
      db = new Database(this.dbPath, { readonly: true, fileMustExist: true });
      const rows = db.pragma('integrity_check') as Array<{ integrity_check: string }>;
      return {
        valid: rows.length === 1 && rows[0]?.integrity_check === 'ok',
        results: rows.map((row) => row.integrity_check),
      };
    } catch (error) {
      return { valid: false, results: [error instanceof Error ? error.message : String(error)] };
    } finally {
      if (db?.open) db.close();
    }
  }
  preserveCorruptedCopy() {
    fs.mkdirSync(this.recoveryDir, { recursive: true });
    const target = path.join(
      this.recoveryDir,
      `corrupted_db_${new Date()
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}Z$/, '')}.db`,
    );
    fs.copyFileSync(this.dbPath, target, fs.constants.COPYFILE_EXCL);
    return target;
  }
}
