import { JobState } from '@ht-dola/shared';
import type { SqliteDatabase } from '../db/database.js';
import type { AccountRecord, JobRecord } from '../db/types.js';
import { AccountRepository } from '../db/repositories/AccountRepository.js';
import { JobRepository } from '../db/repositories/JobRepository.js';
import { SettingsRepository } from '../db/repositories/SettingsRepository.js';
import { WorkerRepository } from '../db/repositories/WorkerRepository.js';
import { browserManager } from '../browser/browser-manager.js';
import { ConflictError, NotFoundError } from '../api/errors.js';
import { RetryPolicy } from './RetryPolicy.js';
import { auditLog } from '../logging/audit-log.js';
import { providerReliability } from '../providers/reliability/ProviderReliabilityService.js';
import { maintenanceCoordinator } from './MaintenanceService.js';

export interface QueueState {
  paused: boolean;
  stopAfterCurrent: boolean;
  updatedAt: string;
}

export interface QueueSnapshot {
  state: QueueState;
  running: JobRecord[];
  waiting: JobRecord[];
  failed: JobRecord[];
  completed: JobRecord[];
}

const QUEUE_STATE_KEY = 'productionQueue.state';
const runningStates = [
  JobState.WAITING_FOR_WORKER,
  JobState.STARTING_BROWSER,
  JobState.PREPARING,
  JobState.SUBMITTING,
  JobState.GENERATING,
  JobState.DOWNLOADING,
  JobState.PROCESSING,
] as const;

export class ProductionQueueService {
  private readonly jobs: JobRepository;
  private readonly accounts: AccountRepository;
  private readonly workers: WorkerRepository;
  private readonly settings: SettingsRepository;
  private readonly retryPolicy: RetryPolicy;

  constructor(private readonly database: SqliteDatabase, retryPolicy = new RetryPolicy()) {
    this.jobs = new JobRepository(database);
    this.accounts = new AccountRepository(database);
    this.workers = new WorkerRepository(database);
    this.settings = new SettingsRepository(database);
    this.retryPolicy = retryPolicy;
  }

  getState(): QueueState {
    return (
      this.settings.get<QueueState>(QUEUE_STATE_KEY) ?? {
        paused: false,
        stopAfterCurrent: false,
        updatedAt: new Date().toISOString(),
      }
    );
  }

  pause(): QueueState {
    auditLog({ level: 'INFO', module: 'queue', event: 'pause', message: 'Production queue paused.' });
    return this.setState({ paused: true });
  }

  resume(): QueueState {
    auditLog({ level: 'INFO', module: 'queue', event: 'resume', message: 'Production queue resumed.' });
    return this.setState({ paused: false, stopAfterCurrent: false });
  }

  stopAfterCurrent(): QueueState {
    auditLog({ level: 'INFO', module: 'queue', event: 'stop_after_current', message: 'Queue will stop after current jobs.' });
    return this.setState({ stopAfterCurrent: true });
  }

  snapshot(): QueueSnapshot {
    return {
      state: this.getState(),
      running: this.listByStatuses(runningStates),
      waiting: this.jobs.list({ status: JobState.QUEUED, limit: 500, offset: 0 }).items,
      failed: this.jobs.list({ status: JobState.FAILED, limit: 500, offset: 0 }).items,
      completed: this.jobs.list({ status: JobState.COMPLETED, limit: 500, offset: 0 }).items,
    };
  }

  queue(jobId: string, priority?: number): JobRecord {
    if (maintenanceCoordinator.active) throw new ConflictError(`Queue is frozen during ${maintenanceCoordinator.state} maintenance.`);
    const job = this.require(jobId);
    if (![JobState.DRAFT, JobState.CANCELLED, JobState.FAILED, JobState.INTERRUPTED].includes(job.status))
      throw new ConflictError(`Job cannot be queued from ${job.status}.`);
    const fields: string[] = ["status='QUEUED'", 'progress=0', 'error_code=NULL', 'error_message=NULL', 'updated_at=?'];
    const values: unknown[] = [new Date().toISOString()];
    if (priority !== undefined) {
      fields.push('priority=?');
      values.push(priority);
    }
    values.push(jobId);
    this.database.prepare(`UPDATE jobs SET ${fields.join(',')} WHERE id=?`).run(...values);
    return this.require(jobId);
  }

  cancelQueued(jobId: string): JobRecord {
    const job = this.require(jobId);
    if (job.status !== JobState.QUEUED) throw new ConflictError('Only queued jobs can be cancelled.');
    return this.jobs.updateStatus(jobId, JobState.CANCELLED)!;
  }

  bulkQueue(ids: string[], priority?: number): JobRecord[] {
    return this.database.transaction((values: string[]) => values.map((id) => this.queue(id, priority)))(ids);
  }

  bulkCancel(ids: string[]): JobRecord[] {
    return this.database.transaction((values: string[]) => values.map((id) => this.cancelQueued(id)))(ids);
  }

  retryFailed(jobId: string): JobRecord {
    const job = this.require(jobId);
    if (job.status !== JobState.FAILED) throw new ConflictError('Only failed jobs can be retried.');
    const decision = this.retryPolicy.decide(job);
    if (!decision.retryable) throw new ConflictError(decision.reason);
    return this.queue(jobId);
  }

  schedulerTick(workerId: string): JobRecord | undefined {
    if (maintenanceCoordinator.active) return undefined;
    return this.database.transaction(() => {
      const state = this.getState();
      if (state.paused || state.stopAfterCurrent) return undefined;
      const worker = this.workers.getById(workerId);
      if (!worker || worker.state !== 'IDLE') return undefined;
      const account = this.chooseAvailableAccount();
      if (!account) return undefined;
      const job = this.chooseJob(account.id);
      if (!job) return undefined;
      const now = new Date().toISOString();
      const claimed = this.database
        .prepare(
          "UPDATE jobs SET status='WAITING_FOR_WORKER',account_id=?,started_at=COALESCE(started_at,?),updated_at=? WHERE id=? AND status='QUEUED'",
        )
        .run(account.id, now, now, job.id);
      if (!claimed.changes) return undefined;
      this.workers.update(workerId, {
        state: 'BUSY',
        accountId: account.id,
        jobId: job.id,
        heartbeatAt: now,
        startedAt: now,
      });
      auditLog({
        level: 'INFO',
        module: 'scheduler',
        jobId: job.id,
        projectId: job.projectId,
        workerId,
        accountId: account.id,
        event: 'job_claimed',
        message: 'Scheduler assigned queued job to worker.',
      });
      return this.jobs.getById(job.id);
    })();
  }

  private setState(patch: Partial<QueueState>): QueueState {
    const state = { ...this.getState(), ...patch, updatedAt: new Date().toISOString() };
    this.settings.set(QUEUE_STATE_KEY, state);
    return state;
  }

  private chooseAvailableAccount(): AccountRecord | undefined {
    const busyAccounts = new Set(
      this.workers
        .list()
        .filter((worker) => worker.accountId && ['BUSY', 'STARTING', 'WAITING', 'STOPPING'].includes(worker.state))
        .map((worker) => worker.accountId),
    );
    return this.accounts
      .list({ limit: 500, offset: 0 })
      .items.find(
        (account) =>
          account.enabled &&
          account.sessionStatus === 'AUTHENTICATED' &&
          account.browserProfileId &&
          !busyAccounts.has(account.id) &&
          !browserManager.isProfileRunning(account.browserProfileId),
      );
  }

  private chooseJob(accountId: string): JobRecord | undefined {
    const rows = this.database
      .prepare(
        "SELECT id FROM jobs WHERE status='QUEUED' AND (account_id IS NULL OR account_id=?) ORDER BY priority DESC,created_at ASC LIMIT 100",
      )
      .all(accountId) as { id: string }[];
    for (const row of rows) {
      const job = this.jobs.getById(row.id);
      if (job && providerReliability.canAssign(job.provider)) return job;
    }
    return undefined;
  }

  private listByStatuses(statuses: readonly JobState[]): JobRecord[] {
    const placeholders = statuses.map(() => '?').join(',');
    const rows = this.database
      .prepare(
        `SELECT id FROM jobs WHERE status IN (${placeholders}) ORDER BY updated_at DESC LIMIT 500`,
      )
      .all(...statuses) as { id: string }[];
    return rows.map((row) => this.jobs.getById(row.id)).filter(Boolean) as JobRecord[];
  }

  private require(jobId: string): JobRecord {
    const job = this.jobs.getById(jobId);
    if (!job) throw new NotFoundError('Job not found.');
    return job;
  }
}
