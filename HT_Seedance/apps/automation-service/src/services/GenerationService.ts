import { JobState } from '@ht-dola/shared';
import type { SqliteDatabase } from '../db/database.js';
import { ConflictError, NotFoundError } from '../api/errors.js';
import { JobRepository } from '../db/repositories/JobRepository.js';
import { JobAttemptRepository } from '../db/repositories/JobAttemptRepository.js';
export class GenerationService {
  private jobs: JobRepository;
  private attempts: JobAttemptRepository;
  constructor(private readonly database: SqliteDatabase) {
    this.jobs = new JobRepository(database);
    this.attempts = new JobAttemptRepository(database);
  }
  begin(jobId: string, workerId?: string): { job: ReturnType<JobRepository['getById']> & {}; attempt: ReturnType<JobAttemptRepository['createAttempt']> } {
    return this.database.transaction(() => {
      const job = this.jobs.getById(jobId);
      if (!job) throw new NotFoundError('Job not found.');
      if (![JobState.WAITING_FOR_WORKER, JobState.PREPARING].includes(job.status))
        throw new ConflictError('Job is not ready for submission.');
      const updated = this.database
        .prepare(
          "UPDATE jobs SET status='SUBMITTING',updated_at=? WHERE id=? AND status IN ('WAITING_FOR_WORKER','PREPARING')",
        )
        .run(new Date().toISOString(), jobId);
      if (!updated.changes) throw new ConflictError('Job was claimed by another worker.');
      const attempt = this.attempts.createAttempt({
        jobId,
        attemptNumber: job.attemptCount + 1,
        ...(job.accountId ? { accountId: job.accountId } : {}),
        ...(workerId ? { workerId } : {}),
        status: JobState.SUBMITTING,
      });
      return { job: this.jobs.getById(jobId)!, attempt };
    })();
  }
  confirm(jobId: string, attemptId: string, metadata: Record<string, unknown>): ReturnType<JobRepository['getById']> & {} {
    return this.database.transaction(() => {
      const now = new Date().toISOString();
      this.database
        .prepare(
          "UPDATE jobs SET status='GENERATING',submitted_at=?,attempt_count=attempt_count+1,provider_metadata_json=?,updated_at=? WHERE id=? AND status='SUBMITTING'",
        )
        .run(now, JSON.stringify(metadata), now, jobId);
      this.attempts.finishAttempt(attemptId, {
        status: JobState.GENERATING,
        providerMetadata: metadata,
      });
      return this.jobs.getById(jobId)!;
    })();
  }
  recoverGenerating() {
    return this.database
      .prepare("UPDATE jobs SET status='INTERRUPTED',updated_at=? WHERE status='GENERATING'")
      .run(new Date().toISOString()).changes;
  }
}
