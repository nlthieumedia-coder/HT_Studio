import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { JobState } from '@ht-dola/shared';
import type { SqliteDatabase } from '../db/database.js';
import { openDatabase } from '../db/database.js';
import { getMigrationStatus } from '../db/migrations.js';
import { JobRepository, ProjectRepository, WorkerRepository } from '../db/repositories/index.js';
import { JobService } from '../services/JobService.js';
import { createServer } from '../api/server.js';
import { appConfig } from '../config/app-config.js';

const databases: SqliteDatabase[] = [];
const create = () => { const db = openDatabase(':memory:'); databases.push(db); return db; };
afterEach(() => { for (const db of databases.splice(0)) if (db.open) db.close(); });
const makeJob = (projectId: string, sceneNumber: number) => ({ projectId, sceneNumber, provider: 'dola', prompt: 'Prompt', inputMedia: {}, durationSeconds: 5, aspectRatio: '16:9' as const, resolution: '1080p', status: JobState.DRAFT, priority: 0, maxAttempts: 3 });

describe('migration runner', () => { it('creates current schema', () => { const db = create(); assert.equal(getMigrationStatus(db).length, 7); assert.ok((db.prepare('PRAGMA table_info(projects)').all() as Array<{name:string}>).some((column) => column.name === 'default_provider')); assert.doesNotThrow(() => new WorkerRepository(db).create('Stopping worker', 'STOPPING')); }); });
describe('repositories and services', () => {
  it('applies project defaults and supports archive restore', () => { const repository = new ProjectRepository(create()); const project = repository.create({ name: 'QA Project', description: 'Initial', outputDirectory: null }); assert.equal(project.defaultDurationSeconds, 30); assert.equal(repository.archive(project.id)?.status, 'ARCHIVED'); assert.equal(repository.restore(project.id)?.status, 'ACTIVE'); });
  it('enforces job transitions and transaction-safe reorder', () => { const db = create(), project = new ProjectRepository(db).create({ name: 'Jobs', description: '' }), service = new JobService(db); const first = service.create(makeJob(project.id, 1)), second = service.create(makeJob(project.id, 2)); assert.equal(service.transition(first.id, JobState.QUEUED).status, JobState.QUEUED); assert.throws(() => service.transition(first.id, JobState.COMPLETED)); service.reorder(second.id, 'up'); assert.equal(service.repository.getById(second.id)?.sceneNumber, 1); assert.equal(service.duplicate(second.id).status, JobState.DRAFT); });
  it('keeps foreign keys and bulk operations atomic', () => { const db = create(), repository = new JobRepository(db); assert.throws(() => repository.create(makeJob(crypto.randomUUID(), 1)), /FOREIGN KEY/); const project = new ProjectRepository(db).create({ name: 'Bulk', description: '' }); assert.throws(() => repository.createMany([makeJob(project.id, 1), makeJob(project.id, 1)])); assert.equal(repository.list({ limit: 50, offset: 0 }).total, 0); });
});
describe('Phase 3 API', () => { it('validates, creates, queues and unqueues jobs', async () => { const db = create(), app = await createServer(db), headers = { 'x-auth-token': appConfig.authToken }; const project = (await app.inject({ method: 'POST', url: '/api/projects', headers, payload: { name: 'API Project' } })).json().data; const created = await app.inject({ method: 'POST', url: '/api/jobs', headers, payload: makeJob(project.id, 1) }); assert.equal(created.statusCode, 201); const id = created.json().data.id; assert.equal((await app.inject({ method: 'POST', url: `/api/jobs/${id}/queue`, headers })).json().data.status, JobState.QUEUED); assert.equal((await app.inject({ method: 'POST', url: `/api/jobs/${id}/unqueue`, headers })).json().data.status, JobState.DRAFT); await app.close(); }); });
