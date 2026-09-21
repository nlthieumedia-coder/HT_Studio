import { JobState } from '@ht-dola/shared';
import type { SqliteDatabase } from '../db/database.js';
import { WorkerRepository } from '../db/repositories/WorkerRepository.js';
import type { JobRecord } from '../db/types.js';
export class WorkerManager {
  private repository: WorkerRepository;
  private readonly max: number;
  constructor(
    private readonly database: SqliteDatabase,
    maxConcurrentWorkers = 1,
  ) {
    if (maxConcurrentWorkers < 1 || maxConcurrentWorkers > 10)
      throw new Error('maxConcurrentWorkers must be 1-10.');
    this.max = maxConcurrentWorkers;
    this.repository = new WorkerRepository(database);
  }
  configure(value: number) {
    if (value < 1 || value > 10) throw new Error('maxConcurrentWorkers must be 1-10.');
    return value;
  }
  ensureWorkers() {
    const workers = this.repository.list();
    for (let i = workers.length; i < this.max; i++) this.repository.create(`Worker-${i + 1}`);
    return this.repository.list();
  }
  list() {
    return this.repository.list();
  }
  claim(workerId: string, accountId: string | null): JobRecord | undefined {
    return this.database.transaction(() => {
      const worker = this.repository.getById(workerId);
      if (!worker || worker.state !== 'IDLE') return undefined;
      if (
        accountId &&
        this.database
          .prepare(
            "SELECT 1 FROM workers WHERE account_id=? AND state IN ('STARTING','BUSY','WAITING') LIMIT 1",
          )
          .get(accountId)
      )
        return undefined;
      const job = this.database
        .prepare(
          "SELECT id FROM jobs WHERE status='QUEUED' AND (account_id IS NULL OR account_id=?) ORDER BY priority DESC,created_at LIMIT 1",
        )
        .get(accountId) as { id: string } | undefined;
      if (!job) return undefined;
      const now = new Date().toISOString();
      const claimed = this.database
        .prepare(
          "UPDATE jobs SET status=?,started_at=?,updated_at=? WHERE id=? AND status='QUEUED'",
        )
        .run(JobState.WAITING_FOR_WORKER, now, now, job.id);
      if (!claimed.changes) return undefined;
      this.repository.update(workerId, {
        state: 'BUSY',
        accountId,
        jobId: job.id,
        heartbeatAt: now,
        startedAt: now,
      });
      return this.database
        .prepare(
          'SELECT id,project_id AS projectId,scene_number AS sceneNumber,provider,account_id AS accountId,prompt,input_media_json AS inputMediaJson,duration_seconds AS durationSeconds,aspect_ratio AS aspectRatio,resolution,status,progress,priority,attempt_count AS attemptCount,max_attempts AS maxAttempts,error_code AS errorCode,error_message AS errorMessage,provider_metadata_json AS providerMetadataJson,created_at AS createdAt,updated_at AS updatedAt,started_at AS startedAt,submitted_at AS submittedAt,completed_at AS completedAt FROM jobs WHERE id=?',
        )
        .get(job.id) as JobRecord;
    })();
  }
  heartbeat(workerId: string) {
    return this.repository.update(workerId, { heartbeatAt: new Date().toISOString() });
  }
  stop(workerId: string, force = false): ReturnType<WorkerRepository['getById']> {
    const worker = this.repository.getById(workerId);
    if (!worker) return undefined;
    return this.database.transaction(() => {
      if (worker.jobId && force)
        this.database
          .prepare(
            "UPDATE jobs SET status='INTERRUPTED',updated_at=? WHERE id=? AND status NOT IN ('COMPLETED','FAILED','CANCELLED','INTERRUPTED')",
          )
          .run(new Date().toISOString(), worker.jobId);
      return this.repository.update(workerId, {
        state: force ? 'STOPPED' : 'STOPPING',
        jobId: force ? null : worker.jobId,
        accountId: force ? null : worker.accountId,
        heartbeatAt: new Date().toISOString(),
      });
    })();
  }
  recoverStale(staleMs = 60000) {
    const cutoff = new Date(Date.now() - staleMs).toISOString();
    const stale = this.database
      .prepare(
        "SELECT id,job_id AS jobId FROM workers WHERE heartbeat_at IS NOT NULL AND heartbeat_at<? AND state IN ('STARTING','BUSY','WAITING','STOPPING')",
      )
      .all(cutoff) as Array<{ id: string; jobId: string | null }>;
    return this.database.transaction(() => {
      for (const worker of stale) {
        if (worker.jobId)
          this.database
            .prepare(
              "UPDATE jobs SET status='INTERRUPTED',updated_at=? WHERE id=? AND status NOT IN ('COMPLETED','FAILED','CANCELLED','INTERRUPTED')",
            )
            .run(new Date().toISOString(), worker.jobId);
        this.repository.update(worker.id, { state: 'ERROR', jobId: null, accountId: null });
      }
      return stale.length;
    })();
  }
}
