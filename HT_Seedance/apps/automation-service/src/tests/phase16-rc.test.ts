import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { JobState, type Job, type JobInput } from '@ht-dola/shared';
import { openDatabase, type SqliteDatabase } from '../db/database.js';
import {
  AccountRepository,
  BrowserProfileRepository,
  JobAttemptRepository,
  JobRepository,
  OutputRepository,
  ProjectRepository,
  WorkerRepository,
} from '../db/repositories/index.js';
import type { JobRecord, WorkerRecord } from '../db/types.js';
import { DownloadManager } from '../services/DownloadManager.js';
import { GenerationService } from '../services/GenerationService.js';
import { ProductionQueueService } from '../services/ProductionQueueService.js';
import { RecoveryService } from '../services/RecoveryService.js';
import { MockVideoProvider } from '../providers/mock/index.js';

const databases: SqliteDatabase[] = [];
const tempDirs: string[] = [];

const createDb = () => {
  const db = openDatabase(':memory:');
  databases.push(db);
  return db;
};

const tempDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ht-dola-rc16-'));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const db of databases.splice(0)) if (db.open) db.close();
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

const createAccounts = (db: SqliteDatabase, count: number) => {
  const profiles = new BrowserProfileRepository(db);
  const accounts = new AccountRepository(db);
  return Array.from({ length: count }, (_, index) => {
    const profile = profiles.create({
      name: `Mock Profile ${index + 1}`,
      profileDirectory: `mock-profile-${index + 1}`,
    });
    const account = accounts.create({
      displayName: `Mock Account ${index + 1}`,
      provider: 'mock',
      browserProfileId: profile.id,
      enabled: true,
    });
    return accounts.updateSessionStatus(account.id, 'AUTHENTICATED')!;
  });
};

const createJobs = (db: SqliteDatabase, projectId: string, count: number, status = JobState.QUEUED) => {
  const jobs = new JobRepository(db);
  return Array.from({ length: count }, (_, index) =>
    jobs.create({
      projectId,
      sceneNumber: index + 1,
      provider: 'mock',
      prompt: `Xin chào Việt Nam - RC1 mock prompt ${index + 1}`,
      inputMedia: {},
      durationSeconds: 5,
      aspectRatio: '16:9',
      resolution: '720p',
      status,
      priority: index % 7,
      maxAttempts: 3,
    }),
  );
};

const createWorkers = (db: SqliteDatabase, count: number) => {
  const workers = new WorkerRepository(db);
  return Array.from({ length: count }, (_, index) => workers.create(`RC Worker ${index + 1}`));
};

const toProviderJob = (job: JobRecord): Job => ({
  id: job.id,
  projectId: job.projectId,
  providerId: job.provider,
  ...(job.accountId ? { accountId: job.accountId } : {}),
  state: job.status,
  input: toJobInput(job),
  priority: job.priority,
  retryCount: job.attemptCount,
  maxRetries: job.maxAttempts,
  createdAt: job.createdAt,
  updatedAt: job.updatedAt,
  ...(job.startedAt ? { startedAt: job.startedAt } : {}),
  ...(job.completedAt ? { completedAt: job.completedAt } : {}),
});

const toJobInput = (job: JobRecord): JobInput => ({
  prompt: job.prompt,
  aspectRatio: ['16:9', '9:16', '1:1', '4:3', '3:4'].includes(job.aspectRatio)
    ? (job.aspectRatio as JobInput['aspectRatio'])
    : '16:9',
  durationSeconds: job.durationSeconds,
  referenceImages: job.inputMedia.image ? [job.inputMedia.image] : [],
  ...(job.inputMedia.video ? { referenceVideo: job.inputMedia.video } : {}),
  ...(job.inputMedia.audio ? { referenceAudio: job.inputMedia.audio } : {}),
  extraParams: { resolution: job.resolution },
});

const runMockJob = async (
  db: SqliteDatabase,
  provider: MockVideoProvider,
  worker: WorkerRecord,
  claimed: JobRecord,
  outputRoot: string,
) => {
  const generation = new GenerationService(db);
  const jobs = new JobRepository(db);
  const workers = new WorkerRepository(db);
  const { job, attempt } = generation.begin(claimed.id, worker.id);
  const submission = await provider.submit(toProviderJob(job), toJobInput(job));
  generation.confirm(job.id, attempt.id, submission.metadata ?? {});
  await provider.checkStatus(submission.externalJobId);
  const status = await provider.checkStatus(submission.externalJobId);
  assert.equal(status.state, JobState.DOWNLOADING);
  jobs.updateStatus(job.id, JobState.DOWNLOADING);
  const providerTemp = path.join(outputRoot, 'provider-temp', `${job.id}.mp4`);
  await provider.downloadResult(submission.externalJobId, providerTemp);
  new DownloadManager(db, outputRoot).persistDownloadedFile({
    jobId: job.id,
    sourcePath: providerTemp,
    suggestedFilename: 'mock-result.mp4',
  });
  workers.update(worker.id, { state: 'IDLE', accountId: null, jobId: null });
};

describe('Phase 16 RC mock provider QA', () => {
  it('completes a 100-job end-to-end mock pipeline with one output per job', async () => {
    const db = createDb();
    const outputRoot = tempDir();
    createAccounts(db, 10);
    const project = new ProjectRepository(db).create({ name: 'RC1 E2E TEST', description: 'Phase 16' });
    createJobs(db, project.id, 100);
    const workers = createWorkers(db, 10);
    const queue = new ProductionQueueService(db);
    const provider = new MockVideoProvider();

    let completed = 0;
    while (completed < 100) {
      let madeProgress = false;
      for (const worker of workers) {
        const fresh = new WorkerRepository(db).getById(worker.id)!;
        if (fresh.state !== 'IDLE') continue;
        const claimed = queue.schedulerTick(fresh.id);
        if (!claimed) continue;
        madeProgress = true;
        await runMockJob(db, provider, fresh, claimed, outputRoot);
        completed += 1;
      }
      assert.equal(madeProgress, true);
    }

    const jobs = new JobRepository(db).list({ project: project.id, status: JobState.COMPLETED, limit: 200, offset: 0 });
    assert.equal(jobs.total, 100);
    assert.equal(new OutputRepository(db).list(200, 0).length, 100);
    assert.equal(new JobAttemptRepository(db).listByJob(jobs.items[0]!.id).length, 1);
    assert.equal(new ProductionQueueService(db).snapshot().waiting.length, 0);
    assert.equal(new ProjectRepository(db).getById(project.id)?.completedJobs, 100);
  });

  for (const workerCount of [1, 2, 3, 5, 10]) {
    it(`prevents duplicate claims with ${workerCount} mock workers`, () => {
      const db = createDb();
      createAccounts(db, workerCount);
      const project = new ProjectRepository(db).create({ name: `Concurrency ${workerCount}`, description: '' });
      createJobs(db, project.id, workerCount * 3);
      const workers = createWorkers(db, workerCount);
      const queue = new ProductionQueueService(db);
      const claimed = new Set<string>();

      for (const worker of workers) {
        const job = queue.schedulerTick(worker.id);
        assert.ok(job);
        assert.equal(claimed.has(job.id), false);
        claimed.add(job.id);
      }

      assert.equal(claimed.size, workerCount);
    });
  }

  it('stress-tests 500 queued mock jobs without duplicate scheduling or database lock crashes', () => {
    const db = createDb();
    createAccounts(db, 10);
    const project = new ProjectRepository(db).create({ name: 'RC1 500 JOB STRESS', description: '' });
    createJobs(db, project.id, 500);
    const workers = createWorkers(db, 10);
    const queue = new ProductionQueueService(db);
    const claimed = new Set<string>();

    while (claimed.size < 500) {
      let progress = false;
      for (const worker of workers) {
        new WorkerRepository(db).update(worker.id, { state: 'IDLE', accountId: null, jobId: null });
        const job = queue.schedulerTick(worker.id);
        if (!job) continue;
        assert.equal(claimed.has(job.id), false);
        claimed.add(job.id);
        new JobRepository(db).updateStatus(job.id, JobState.COMPLETED);
        progress = true;
      }
      assert.equal(progress, true);
    }

    assert.equal(new JobRepository(db).list({ project: project.id, status: JobState.COMPLETED, limit: 200, offset: 0 }).total, 500);
  });

  it('creates 5,000 mock jobs and keeps repository pagination bounded', () => {
    const db = createDb();
    const project = new ProjectRepository(db).create({ name: 'RC1 5000 DB TEST', description: '' });
    createJobs(db, project.id, 5_000, JobState.DRAFT);
    const page = new JobRepository(db).list({ project: project.id, limit: 200, offset: 4_800 });

    assert.equal(page.total, 5_000);
    assert.equal(page.items.length, 200);
    assert.equal(new ProjectRepository(db).getById(project.id)?.totalJobs, 5_000);
  });

  it('recovers unsafe generation/download/processing states as interrupted and preserves partial files', () => {
    const db = createDb();
    const root = tempDir();
    const project = new ProjectRepository(db).create({ name: 'Crash Recovery', description: '' });
    const unsafe = [JobState.GENERATING, JobState.DOWNLOADING, JobState.PROCESSING].map((state, index) =>
      new JobRepository(db).create({
        projectId: project.id,
        sceneNumber: index + 1,
        provider: 'mock',
        prompt: `crash ${state}`,
        inputMedia: {},
        durationSeconds: 5,
        aspectRatio: '16:9',
        resolution: '720p',
        status: state,
        priority: 0,
        maxAttempts: 3,
      }),
    );
    const part = path.join(root, project.id, 'outputs', 'SCENE_0002.mp4.part');
    fs.mkdirSync(path.dirname(part), { recursive: true });
    fs.writeFileSync(part, 'partial');

    assert.equal(new RecoveryService(db).recoverStartupInterrupted(), 3);
    for (const job of unsafe) assert.equal(new JobRepository(db).getById(job.id)?.status, JobState.INTERRUPTED);
    assert.equal(fs.existsSync(part), true);
    assert.equal(new OutputRepository(db).list(50, 0).length, 0);
  });
});
