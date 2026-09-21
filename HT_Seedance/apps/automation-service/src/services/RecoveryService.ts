import { JobState } from '@ht-dola/shared';
import type { SqliteDatabase } from '../db/database.js';
import type { JobAttemptRecord, JobRecord } from '../db/types.js';
import { ConflictError, NotFoundError } from '../api/errors.js';
import { JobRepository } from '../db/repositories/JobRepository.js';
import { JobAttemptRepository } from '../db/repositories/JobAttemptRepository.js';
import { RetryPolicy } from './RetryPolicy.js';

export const UNSAFE_STARTUP_STATES = [
  JobState.STARTING_BROWSER,
  JobState.PREPARING,
  JobState.SUBMITTING,
  JobState.GENERATING,
  JobState.DOWNLOADING,
  JobState.PROCESSING,
] as const;

export interface InterruptedJobDetail {
  job: JobRecord;
  attempts: JobAttemptRecord[];
  retry: ReturnType<RetryPolicy['decide']>;
}

export class RecoveryService {
  private readonly jobs: JobRepository;
  private readonly attempts: JobAttemptRepository;
  private readonly retryPolicy: RetryPolicy;

  constructor(private readonly database: SqliteDatabase, retryPolicy = new RetryPolicy()) {
    this.jobs = new JobRepository(database);
    this.attempts = new JobAttemptRepository(database);
    this.retryPolicy = retryPolicy;
  }

  recoverStartupInterrupted(): number {
    const now = new Date().toISOString();
    const placeholders = UNSAFE_STARTUP_STATES.map(() => '?').join(',');
    return this.database.transaction(() => {
      const rows = this.database
        .prepare(`SELECT id FROM jobs WHERE status IN (${placeholders})`)
        .all(...UNSAFE_STARTUP_STATES) as { id: string }[];
      const updateJob = this.database.prepare(
        "UPDATE jobs SET status='INTERRUPTED',progress=0,error_code='BROWSER_CRASH',error_message='Application restarted while job was active; manual recovery is required.',updated_at=? WHERE id=?",
      );
      const updateAttempt = this.database.prepare(
        "UPDATE job_attempts SET status='INTERRUPTED',ended_at=?,error_code='BROWSER_CRASH',error_message='Application restart interrupted this attempt.' WHERE id=(SELECT id FROM job_attempts WHERE job_id=? AND ended_at IS NULL ORDER BY attempt_number DESC LIMIT 1)",
      );
      for (const row of rows) {
        updateJob.run(now, row.id);
        updateAttempt.run(now, row.id);
      }
      return rows.length;
    })();
  }

  listInterrupted(): InterruptedJobDetail[] {
    return this.jobs
      .list({ status: JobState.INTERRUPTED, limit: 500, offset: 0 })
      .items.map((job) => this.inspect(job.id));
  }

  inspect(jobId: string): InterruptedJobDetail {
    const job = this.require(jobId);
    return {
      job,
      attempts: this.attempts.listByJob(jobId),
      retry: this.retryPolicy.decide(job),
    };
  }

  retry(jobId: string): JobRecord {
    return this.database.transaction(() => {
      const job = this.require(jobId);
      if (job.status !== JobState.INTERRUPTED)
        throw new ConflictError('Only interrupted jobs can be retried.');
      const decision = this.retryPolicy.decide(job);
      if (!decision.retryable) throw new ConflictError(decision.reason);
      const metadata = {
        ...(job.providerMetadata ?? {}),
        retry: {
          scheduledAt: new Date().toISOString(),
          nextAttemptAt: decision.nextAttemptAt,
          delayMs: decision.delayMs,
          reason: decision.reason,
        },
      };
      const updated = this.database
        .prepare(
          "UPDATE jobs SET status='QUEUED',progress=0,error_code=NULL,error_message=NULL,provider_metadata_json=?,updated_at=? WHERE id=? AND status='INTERRUPTED'",
        )
        .run(JSON.stringify(metadata), new Date().toISOString(), jobId);
      if (!updated.changes) throw new ConflictError('Job was changed by another operation.');
      return this.jobs.getById(jobId)!;
    })();
  }

  markFailed(jobId: string, message = 'Marked failed during recovery.'): JobRecord {
    return this.setTerminal(jobId, JobState.FAILED, 'RECOVERY_MARK_FAILED', message);
  }

  cancel(jobId: string): JobRecord {
    return this.setTerminal(jobId, JobState.CANCELLED, 'RECOVERY_CANCELLED', 'Cancelled during recovery.');
  }

  private setTerminal(
    jobId: string,
    status: JobState.FAILED | JobState.CANCELLED,
    errorCode: string,
    errorMessage: string,
  ): JobRecord {
    return this.database.transaction(() => {
      const job = this.require(jobId);
      if (job.status !== JobState.INTERRUPTED)
        throw new ConflictError('Only interrupted jobs can be recovered this way.');
      this.database
        .prepare(
          'UPDATE jobs SET status=?,progress=0,error_code=?,error_message=?,completed_at=?,updated_at=? WHERE id=?',
        )
        .run(status, errorCode, errorMessage, new Date().toISOString(), new Date().toISOString(), jobId);
      this.database
        .prepare(
          'UPDATE job_attempts SET status=?,ended_at=COALESCE(ended_at,?),error_code=COALESCE(error_code,?),error_message=COALESCE(error_message,?) WHERE job_id=? AND ended_at IS NULL',
        )
        .run(status, new Date().toISOString(), errorCode, errorMessage, jobId);
      return this.jobs.getById(job.id)!;
    })();
  }

  private require(jobId: string): JobRecord {
    const job = this.jobs.getById(jobId);
    if (!job) throw new NotFoundError('Job not found.');
    return job;
  }
}
