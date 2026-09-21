import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { JobState } from '@ht-dola/shared';
import { openDatabase, type SqliteDatabase } from '../db/database.js';
import { JobRepository, ProjectRepository } from '../db/repositories/index.js';
import { DownloadManager } from '../services/DownloadManager.js';

const databases: SqliteDatabase[] = [];
const tempDirs: string[] = [];

const create = () => {
  const db = openDatabase(':memory:');
  databases.push(db);
  return db;
};

const createTempDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ht-dola-download-'));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const db of databases.splice(0)) if (db.open) db.close();
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

const createJob = (db: SqliteDatabase, sceneNumber = 1) => {
  const project = new ProjectRepository(db).create({ name: 'Download', description: '' });
  return new JobRepository(db).create({
    projectId: project.id,
    sceneNumber,
    provider: 'dola',
    prompt: 'render this',
    inputMedia: {},
    durationSeconds: 5,
    aspectRatio: '16:9',
    resolution: '1080p',
    status: JobState.DOWNLOADING,
    priority: 0,
    maxAttempts: 3,
  });
};

describe('DownloadManager', () => {
  it('uses stable scene naming and never overwrites collisions', () => {
    const db = create();
    const root = createTempDir();
    const job = createJob(db, 1);
    const manager = new DownloadManager(db, root);
    const outputDir = path.join(root, job.projectId, 'outputs');
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, 'SCENE_0001.mp4'), 'existing');

    const reserved = manager.reserveOutputPath(job, 'provider-name.mp4');

    assert.equal(path.basename(reserved.finalPath), 'SCENE_0001_v2.mp4');
  });

  it('writes through .part, verifies bytes, hashes output, records DB row, and completes job', () => {
    const db = create();
    const root = createTempDir();
    const source = path.join(root, 'source.mp4');
    const payload = Buffer.from('fake mp4 bytes');
    fs.writeFileSync(source, payload);
    const job = createJob(db, 2);
    const manager = new DownloadManager(db, root);

    const output = manager.persistDownloadedFile({
      jobId: job.id,
      sourcePath: source,
      suggestedFilename: 'download.webm',
    });
    const tracker = manager.getTracker(job.id);
    const updated = new JobRepository(db).getById(job.id);

    assert.equal(path.basename(output.filePath), 'SCENE_0002.webm');
    assert.equal(output.fileSize, payload.length);
    assert.equal(output.checksumSha256, crypto.createHash('sha256').update(payload).digest('hex'));
    assert.equal(updated?.status, JobState.COMPLETED);
    assert.equal(updated?.progress, 100);
    assert.ok(updated?.completedAt);
    assert.equal(fs.existsSync(output.filePath), true);
    assert.equal(fs.existsSync(`${output.filePath}.part`), false);
    assert.equal(tracker?.status, 'COMPLETED');
    assert.equal(tracker?.bytes, payload.length);
  });

  it('rejects empty downloads before creating an output record or completing the job', () => {
    const db = create();
    const root = createTempDir();
    const source = path.join(root, 'empty.mp4');
    fs.writeFileSync(source, '');
    const job = createJob(db, 3);
    const manager = new DownloadManager(db, root);

    assert.throws(() =>
      manager.persistDownloadedFile({
        jobId: job.id,
        sourcePath: source,
        suggestedFilename: 'empty.mp4',
      }),
    );

    assert.equal(new JobRepository(db).getById(job.id)?.status, JobState.DOWNLOADING);
    assert.equal((db.prepare('SELECT COUNT(*) count FROM outputs').get() as { count: number }).count, 0);
  });
});
