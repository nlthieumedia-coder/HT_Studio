import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { JobState } from '@ht-dola/shared';
import { appConfig } from '../config/app-config.js';
import { openDatabase, type SqliteDatabase } from '../db/database.js';
import { JobRepository, OutputRepository, ProjectRepository } from '../db/repositories/index.js';
import { MediaOutputManager } from '../services/MediaOutputManager.js';

const databases: SqliteDatabase[] = [];
const tempDirs: string[] = [];
const create = () => {
  const db = openDatabase(':memory:');
  databases.push(db);
  return db;
};
const temp = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ht-dola-media-'));
  tempDirs.push(dir);
  return dir;
};
afterEach(() => {
  databases.splice(0).forEach((db) => db.close());
  tempDirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

const createOutput = (db: SqliteDatabase, dir: string) => {
  const project = new ProjectRepository(db).create({ name: 'Media', description: '' });
  const job = new JobRepository(db).create({
    projectId: project.id,
    sceneNumber: 1,
    provider: 'dola',
    prompt: 'prompt',
    inputMedia: { image: 'input.png' },
    durationSeconds: 5,
    aspectRatio: '16:9',
    resolution: '720p',
    status: JobState.COMPLETED,
    priority: 0,
    maxAttempts: 3,
  });
  const filePath = path.join(dir, 'SCENE_0001.mp4');
  const payload = Buffer.from('local mp4 placeholder');
  fs.writeFileSync(filePath, payload);
  const output = new OutputRepository(db).create({
    jobId: job.id,
    filePath,
    fileName: path.basename(filePath),
    durationSeconds: null,
    width: null,
    height: null,
    fps: null,
    videoCodec: null,
    audioCodec: null,
    fileSize: null,
    checksumSha256: null,
  });
  return { project, job, output, payload };
};

describe('MediaOutputManager', () => {
  it('probes media and stores checksum plus size', () => {
    const db = create();
    const { output, payload } = createOutput(db, temp());
    const probed = new MediaOutputManager(db).probe(output.id);

    assert.equal(probed.fileSize, payload.length);
    assert.equal(probed.checksumSha256, crypto.createHash('sha256').update(payload).digest('hex'));
  });

  it('renames, moves, and copies outputs without overwriting', () => {
    const db = create();
    const dir = temp();
    const targetDir = path.join(dir, 'moved');
    const copyDir = path.join(dir, 'copy');
    const { output } = createOutput(db, dir);
    const manager = new MediaOutputManager(db);

    const renamed = manager.rename(output.id, 'RENAMED.mp4');
    assert.equal(renamed.fileName, 'RENAMED.mp4');
    assert.equal(fs.existsSync(renamed.filePath), true);
    const moved = manager.move(output.id, targetDir);
    assert.equal(path.dirname(moved.filePath), targetDir);
    const copied = manager.copy(output.id, copyDir);
    assert.notEqual(copied.id, output.id);
    assert.equal(fs.existsSync(copied.filePath), true);
    assert.throws(() => manager.rename(output.id, copied.fileName));
  });

  it('exports project manifest with scene prompt inputs output and status', () => {
    const db = create();
    const { project, output } = createOutput(db, temp());
    const result = new MediaOutputManager(db).exportProjectManifest(project.id);
    const manifest = JSON.parse(fs.readFileSync(result.path, 'utf8')) as {
      scenes: Array<{ scene: number; prompt: string; inputPaths: unknown; outputPath: string; status: string }>;
    };

    assert.equal(path.basename(result.path), 'project.json');
    assert.equal(result.scenes, 1);
    assert.equal(manifest.scenes[0]?.outputPath, output.filePath);
    assert.equal(manifest.scenes[0]?.status, JobState.COMPLETED);
    assert.ok(result.path.startsWith(path.join(appConfig.projectsDir, project.id)));
    fs.rmSync(path.dirname(result.path), { recursive: true, force: true });
  });
});
