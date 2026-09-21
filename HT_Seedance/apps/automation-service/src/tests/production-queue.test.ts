import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { JobState } from '@ht-dola/shared';
import { openDatabase, type SqliteDatabase } from '../db/database.js';
import {
  AccountRepository,
  BrowserProfileRepository,
  JobRepository,
  ProjectRepository,
  WorkerRepository,
} from '../db/repositories/index.js';
import { ProductionQueueService } from '../services/ProductionQueueService.js';

const databases: SqliteDatabase[] = [];
const create = () => {
  const db = openDatabase(':memory:');
  databases.push(db);
  return db;
};
afterEach(() => databases.splice(0).forEach((db) => db.close()));

const jobInput = (projectId: string, sceneNumber: number, priority = 0, status = JobState.QUEUED) => ({
  projectId,
  sceneNumber,
  provider: 'dola',
  prompt: `job-${sceneNumber}`,
  inputMedia: {},
  durationSeconds: 5,
  aspectRatio: '16:9' as const,
  resolution: '720p',
  status,
  priority,
  maxAttempts: 3,
});

const authenticatedAccount = (db: SqliteDatabase) => {
  const profile = new BrowserProfileRepository(db).create({
    name: 'Profile',
    profileDirectory: 'profile-a',
  });
  const account = new AccountRepository(db).create({
    displayName: 'Account',
    provider: 'dola',
    browserProfileId: profile.id,
    enabled: true,
  });
  return new AccountRepository(db).updateSessionStatus(account.id, 'AUTHENTICATED')!;
};

describe('ProductionQueueService', () => {
  it('persists pause/resume/stop-after-current queue state', () => {
    const db = create();
    const queue = new ProductionQueueService(db);

    assert.equal(queue.pause().paused, true);
    assert.equal(new ProductionQueueService(db).getState().paused, true);
    assert.equal(queue.stopAfterCurrent().stopAfterCurrent, true);
    const resumed = new ProductionQueueService(db).resume();
    assert.equal(resumed.paused, false);
    assert.equal(resumed.stopAfterCurrent, false);
  });

  it('schedules only authenticated enabled unlocked accounts and respects priority FIFO', () => {
    const db = create();
    authenticatedAccount(db);
    const project = new ProjectRepository(db).create({ name: 'Queue', description: '' });
    const jobs = new JobRepository(db);
    const workers = new WorkerRepository(db);
    const low = jobs.create(jobInput(project.id, 1, 0));
    const highFirst = jobs.create(jobInput(project.id, 2, 10));
    const highSecond = jobs.create(jobInput(project.id, 3, 10));
    const workerOne = workers.create('Worker 1');
    const queue = new ProductionQueueService(db);

    assert.equal(queue.schedulerTick(workerOne.id)?.id, highFirst.id);
    workers.update(workerOne.id, { state: 'IDLE', accountId: null, jobId: null });
    assert.equal(queue.schedulerTick(workerOne.id)?.id, highSecond.id);
    workers.update(workerOne.id, { state: 'IDLE', accountId: null, jobId: null });
    assert.equal(queue.schedulerTick(workerOne.id)?.id, low.id);
  });

  it('pause and stop-after-current prevent new scheduling', () => {
    const db = create();
    authenticatedAccount(db);
    const project = new ProjectRepository(db).create({ name: 'Pause', description: '' });
    new JobRepository(db).create(jobInput(project.id, 1, 0));
    const worker = new WorkerRepository(db).create('Worker 1');
    const queue = new ProductionQueueService(db);

    queue.pause();
    assert.equal(queue.schedulerTick(worker.id), undefined);
    queue.resume();
    queue.stopAfterCurrent();
    assert.equal(queue.schedulerTick(worker.id), undefined);
  });

  it('stress-tests simulated jobs with higher priority first and FIFO within same priority', () => {
    const db = create();
    authenticatedAccount(db);
    const project = new ProjectRepository(db).create({ name: 'Stress', description: '' });
    const jobs = new JobRepository(db);
    const worker = new WorkerRepository(db).create('Worker 1');
    const queue = new ProductionQueueService(db);
    const expected = Array.from({ length: 25 }, (_, index) => {
      const priority = index % 5;
      const job = jobs.create(jobInput(project.id, index + 1, priority));
      return { id: job.id, priority, createdAt: job.createdAt };
    }).sort((a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt));

    const actual: string[] = [];
    for (let index = 0; index < expected.length; index += 1) {
      const claimed = queue.schedulerTick(worker.id);
      if (claimed) actual.push(claimed.id);
      new WorkerRepository(db).update(worker.id, { state: 'IDLE', accountId: null, jobId: null });
    }

    assert.deepEqual(actual, expected.map((job) => job.id));
  });

  it('supports bulk queue, bulk cancel, and retry failed policy', () => {
    const db = create();
    const project = new ProjectRepository(db).create({ name: 'Bulk', description: '' });
    const jobs = new JobRepository(db);
    const draft = jobs.create(jobInput(project.id, 1, 0, JobState.DRAFT));
    const failed = jobs.create(jobInput(project.id, 2, 0, JobState.FAILED));
    db.prepare("UPDATE jobs SET error_code='BROWSER_CRASH',attempt_count=1 WHERE id=?").run(failed.id);
    const queue = new ProductionQueueService(db);

    assert.equal(queue.bulkQueue([draft.id])[0]?.status, JobState.QUEUED);
    assert.equal(queue.bulkCancel([draft.id])[0]?.status, JobState.CANCELLED);
    assert.equal(queue.retryFailed(failed.id).status, JobState.QUEUED);
  });
});
