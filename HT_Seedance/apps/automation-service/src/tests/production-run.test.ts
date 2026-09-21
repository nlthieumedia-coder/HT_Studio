import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JobState } from '@ht-dola/shared';
import { openDatabase, type SqliteDatabase } from '../db/database.js';
import { ProjectRepository } from '../db/repositories/ProjectRepository.js';
import { JobRepository } from '../db/repositories/JobRepository.js';
import { ProductionRunService } from '../services/ProductionRunService.js';
import { providerReliability } from '../providers/reliability/ProviderReliabilityService.js';
import path from 'node:path';
const dbs: SqliteDatabase[] = [];
afterEach(() => dbs.splice(0).forEach((d) => d.close()));
const setup = (count: number) => {
  const db = openDatabase(':memory:');
  dbs.push(db);
  const project = new ProjectRepository(db).create({ name: 'Pilot', description: '' });
  const jobs = new JobRepository(db).createMany(
    Array.from({ length: count }, (_, i) => ({
      projectId: project.id,
      sceneNumber: i + 1,
      provider: 'mock',
      prompt: `job ${i}`,
      inputMedia: {},
      durationSeconds: 5,
      aspectRatio: '16:9' as const,
      resolution: '720p',
      status: JobState.QUEUED,
      priority: 0,
      maxAttempts: 3,
    })),
  );
  return { db, project, jobs, service: new ProductionRunService(db) };
};
describe('Phase 21 production pilots', () => {
  for (const count of [10, 25, 50, 100])
    it(`tracks ${count}-job Mock pilot without duplicate or loss`, () => {
      const x = setup(count),
        run = x.service.create({
          projectId: x.project.id,
          provider: 'mock',
          jobIds: x.jobs.map((j) => j.id),
          workerCount: 1,
          pilot: { enabled: count <= 10, maxBatchSize: 10, maxWorkers: 1, maxActiveJobs: 1 },
        });
      x.db.transaction(() =>
        x.jobs.forEach((j) =>
          x.db
            .prepare("UPDATE jobs SET status='COMPLETED',completed_at=? WHERE id=?")
            .run(new Date().toISOString(), j.id),
        ),
      )();
      const done = x.service.complete(run.id),
        stats = x.service.statistics(run.id);
      assert.equal(done.status, 'COMPLETED');
      assert.deepEqual([stats.total, stats.completed, stats.failed], [count, count, 0]);
      assert.equal(new Set(x.jobs.map((j) => j.id)).size, count);
    });
  it('enforces Pilot Mode and allowed states', () => {
    const x = setup(25);
    assert.throws(() =>
      x.service.create({
        projectId: x.project.id,
        provider: 'mock',
        jobIds: x.jobs.map((j) => j.id),
        workerCount: 2,
        pilot: { enabled: true, maxBatchSize: 10, maxWorkers: 1, maxActiveJobs: 1 },
      }),
    );
    x.db.prepare("UPDATE jobs SET status='GENERATING' WHERE id=?").run(x.jobs[0]!.id);
    assert.throws(() =>
      x.service.create({
        projectId: x.project.id,
        provider: 'mock',
        jobIds: [x.jobs[0]!.id],
        workerCount: 1,
      }),
    );
  });
  it('pauses, stops, detects incidents and recovers safely', () => {
    const x = setup(10),
      run = x.service.create({
        projectId: x.project.id,
        provider: 'mock',
        jobIds: x.jobs.map((j) => j.id),
        workerCount: 1,
      });
    assert.equal(x.service.pause(run.id).status, 'PAUSED');
    assert.equal(x.service.resume(run.id).status, 'RUNNING');
    providerReliability.pause('mock');
    assert.equal(x.service.pause(run.id, true).status, 'PAUSED_PROVIDER_INCIDENT');
    providerReliability.resume('mock');
    assert.equal(x.service.stop(run.id).status, 'STOPPING');
    assert.equal(x.service.recover(), 1);
    assert.equal(x.service.get(run.id)?.status, 'INTERRUPTED');
  });
  it('classifies failures, detects stuck work, validates invalid output, and produces sanitized reports', () => {
    const x = setup(10),
      run = x.service.create({
        projectId: x.project.id,
        provider: 'mock',
        jobIds: x.jobs.map((j) => j.id),
        workerCount: 1,
      });
    x.db
      .prepare(
        "UPDATE jobs SET status='PREPARING',updated_at='2000-01-01T00:00:00.000Z' WHERE id=?",
      )
      .run(x.jobs[0]!.id);
    assert.equal(x.service.detectStuck(run.id, 100).length, 1);
    assert.equal(x.service.classify('LOGIN_REQUIRED').retryGroup, 'LOGIN_REQUIRED');
    assert.equal(x.service.classify('FORM_CHANGED').retryGroup, 'PROVIDER_REVIEW');
    for(const code of ['BROWSER_CRASHED','GENERATION_FAILED','DOWNLOAD_FAILED']) assert.ok(x.service.classify(code).retryGroup);
    assert.equal(x.service.validateOutput(x.jobs[0]!.id).code, 'OUTPUT_INVALID');
    x.db
      .prepare("UPDATE jobs SET status='FAILED',error_code='LOGIN_REQUIRED' WHERE id=?")
      .run(x.jobs[0]!.id);
    const reports = x.service.reports(run.id),
      bundle = x.service.supportBundle(run.id);
    assert.ok(fs.existsSync(reports.manifest) && fs.existsSync(reports.failed));
    const contents = fs.readFileSync(path.join(bundle.path, 'support.json'), 'utf8');
    assert.doesNotMatch(contents, /cookie|auth.?token|password/i);
  });
  it('returns typed blocked preflight reasons', () => {
    const x = setup(10),
      run = x.service.create({
        projectId: x.project.id,
        provider: 'mock',
        jobIds: x.jobs.map((j) => j.id),
        workerCount: 1,
      });
    const result = x.service.preflight(run.id);
    assert.equal(result.status, 'BLOCKED');
    assert.ok(result.checks.some((c) => c.required && c.status === 'FAIL'));
  });
});
