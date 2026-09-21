import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { appConfig } from '../config/app-config.js';
export type MaintenanceOperation = 'BACKUP' | 'RESTORE' | 'MIGRATION' | 'UPDATE' | 'RECOVERY';
export class MaintenanceLock {
  private token: string | undefined;
  constructor(private readonly file = path.join(appConfig.dataDir, '.maintenance.lock')) {}
  acquire(operation: MaintenanceOperation) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    if (fs.existsSync(this.file)) {
      try {
        const saved = JSON.parse(fs.readFileSync(this.file, 'utf8')) as { pid: number };
        try {
          process.kill(saved.pid, 0);
          throw new Error('Another maintenance operation is active.');
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ESRCH')
            fs.rmSync(this.file, { force: true });
          else throw error;
        }
      } catch (error) {
        if (error instanceof Error && error.message === 'Another maintenance operation is active.')
          throw error;
        fs.rmSync(this.file, { force: true });
      }
    }
    this.token = randomUUID();
    fs.writeFileSync(
      this.file,
      JSON.stringify({
        operation,
        pid: process.pid,
        token: this.token,
        startedAt: new Date().toISOString(),
      }),
      { flag: 'wx' },
    );
    return this.token;
  }
  release() {
    if (!this.token) return;
    try {
      const saved = JSON.parse(fs.readFileSync(this.file, 'utf8')) as { token: string };
      if (saved.token === this.token) fs.rmSync(this.file, { force: true });
    } catch {}
    this.token = undefined;
  }
  inspect() {
    if (!fs.existsSync(this.file)) return { active: false as const };
    try {
      return {
        active: true as const,
        ...(JSON.parse(fs.readFileSync(this.file, 'utf8')) as object),
      };
    } catch {
      return { active: true as const, corrupted: true };
    }
  }
}
class MaintenanceCoordinator {
  private operation: MaintenanceOperation | undefined;
  enter(operation: MaintenanceOperation) {
    if (this.operation) throw new Error(`Maintenance mode already active: ${this.operation}`);
    this.operation = operation;
  }
  leave() {
    this.operation = undefined;
  }
  get active() {
    return Boolean(this.operation);
  }
  get state() {
    return this.operation ?? 'NORMAL';
  }
}
export const maintenanceCoordinator = new MaintenanceCoordinator();
