import assert from 'node:assert/strict';
import fs from 'node:fs';
import { afterEach, describe, it } from 'node:test';
import { openDatabase, type SqliteDatabase } from '../db/database.js';
import { LogRepository, WorkerRepository } from '../db/repositories/index.js';
import { DiagnosticsService } from '../services/DiagnosticsService.js';

const databases: SqliteDatabase[] = [];
const createdFiles: string[] = [];
const create = () => {
  const db = openDatabase(':memory:');
  databases.push(db);
  return db;
};
afterEach(() => {
  databases.splice(0).forEach((db) => db.close());
  createdFiles.splice(0).forEach((file) => fs.rmSync(file, { force: true }));
});

describe('production diagnostics', () => {
  it('filters structured logs and exports diagnostics without secrets or profiles', () => {
    const db = create();
    new WorkerRepository(db).create('Worker 1');
    const logs = new LogRepository(db);
    logs.insert({
      level: 'INFO',
      module: 'queue',
      jobId: null,
      projectId: null,
      workerId: null,
      accountId: null,
      event: 'pause',
      message: 'Queue paused.',
      metadata: { token: 'secret-token' },
    });
    logs.insert({
      level: 'ERROR',
      module: 'worker',
      jobId: null,
      projectId: null,
      workerId: null,
      accountId: null,
      event: 'failure',
      message: 'Worker failed.',
      metadata: null,
    });

    assert.equal(logs.query({ module: 'queue' }).items.length, 1);
    assert.equal(logs.query({ level: 'ERROR' }).items[0]?.module, 'worker');

    const service = new DiagnosticsService(db);
    const health = service.health();
    assert.equal(health.database.ok, true);
    const exported = service.exportPackage();
    createdFiles.push(exported.path);
    const payload = fs.readFileSync(exported.path, 'utf8');
    assert.match(payload, /"\[REDACTED\]"/);
    assert.doesNotMatch(payload, /secret-token/);
    assert.match(payload, /browser profiles/);
  });
});
