import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { JobState } from '@ht-dola/shared';
import { openDatabase, type SqliteDatabase } from '../db/database.js';
import { JobAttemptRepository, JobRepository, ProjectRepository } from '../db/repositories/index.js';
import { RecoveryService, UNSAFE_STARTUP_STATES } from '../services/RecoveryService.js';
import { RetryPolicy } from '../services/RetryPolicy.js';

const databases: SqliteDatabase[] = [];
const create = () => {
  const db = openDatabase(':memory:');
  databases.push(db);
  return db;
};
afterEach(() => databases.splice(0).forEach((db) => db.close()));

const makeJob = (db: SqliteDatabase, status: JobState, errorCode = 'BROWSER_CRASH') => {
  const project = new ProjectRepository(db).create({ name: 'Recovery', description: '' });
  const job = new JobRepository(db).create({
    projectId: project.id,
    sceneNumber: 1,
    provider: 'dola',
    prompt: 'test',
    inputMedia: {},
    durationSeconds: 5,
    aspectRatio: '16:9',
    resolution: '720p',
    status,
    priority: 0,
    maxAttempts: 3,
  });
  db.prepare('UPDATE jobs SET error_code=?,attempt_count=1 WHERE id=?').run(errorCode, job.id);
  return new JobRepository(db).getById(job.id)!;
};

describe('RetryPolicy', () => {
  it('retries only classified transient errors with bounded backoff', () => {
    const db = create();
    const retryable = makeJob(db, JobState.INTERRUPTED, 'BROWSER_CRASH');
    const login = makeJob(db, JobState.INTERRUPTED, 'LOGIN_REQUIRED');
    const policy = new RetryPolicy(3, 100, 500);

    assert.equal(policy.decide(retryable).retryable, true);
    assert.equal(policy.decide(retryable).delayMs, 200);
    assert.equal(policy.decide(login).retryable, false);
  });
});

describe('RecoveryService', () => {
  it('marks unsafe startup states interrupted and closes active attempts', () => {
    const db = create();
    const jobs = new JobRepository(db);
    const attempts = new JobAttemptRepository(db);
    const unsafe = UNSAFE_STARTUP_STATES.map((state, index) => {
      const job = makeJob(db, state);
      db.prepare('UPDATE jobs SET scene_number=? WHERE id=?').run(index + 1, job.id);
      attempts.createAttempt({ jobId: job.id, attemptNumber: 2, status: state });
      return job.id;
    });
    const stable = makeJob(db, JobState.QUEUED).id;

    assert.equal(new RecoveryService(db).recoverStartupInterrupted(), unsafe.length);
    for (const id of unsafe) assert.equal(jobs.getById(id)?.status, JobState.INTERRUPTED);
    assert.equal(jobs.getById(stable)?.status, JobState.QUEUED);
    assert.ok(attempts.listByJob(unsafe[0]!).at(-1)?.endedAt);
  });

  it('queues retryable interrupted jobs and rejects non-retryable jobs', () => {
    const db = create();
    const service = new RecoveryService(db, new RetryPolicy(3, 1, 10));
    const retryable = makeJob(db, JobState.INTERRUPTED, 'DOWNLOAD_TRANSIENT');
    const rejected = makeJob(db, JobState.INTERRUPTED, 'INVALID_INPUT');

    assert.equal(service.retry(retryable.id).status, JobState.QUEUED);
    assert.throws(() => service.retry(rejected.id), /not retryable/);
  });

  it('supports mark failed and cancel recovery actions', () => {
    const db = create();
    const service = new RecoveryService(db);
    const failed = makeJob(db, JobState.INTERRUPTED);
    const cancelled = makeJob(db, JobState.INTERRUPTED);

    assert.equal(service.markFailed(failed.id).status, JobState.FAILED);
    assert.equal(service.cancel(cancelled.id).status, JobState.CANCELLED);
  });
});
