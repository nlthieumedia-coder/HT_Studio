import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  BulkJobUpdateSchema,
  JobCreateSchema,
  JobIdListSchema,
  JobListQuerySchema,
  JobReorderSchema,
  JobState,
  JobUpdateSchema,
} from '@ht-dola/shared';
import { getDb, type SqliteDatabase } from '../../db/database.js';
import { JobService } from '../../services/JobService.js';
import { RecoveryService } from '../../services/RecoveryService.js';
import { ProductionQueueService } from '../../services/ProductionQueueService.js';
import { NotFoundError } from '../errors.js';

const idParams = z.object({ id: z.string().uuid() });
const priorityBody = z.object({ priority: z.number().int().min(-1000).max(1000).optional() }).default({});
export const createJobsRoutes =
  (database: SqliteDatabase = getDb()): FastifyPluginAsync =>
  async (fastify) => {
    const service = new JobService(database),
      repository = service.repository,
      recovery = new RecoveryService(database),
      queue = new ProductionQueueService(database);
    fastify.get('/api/jobs', async (request) => ({
      data: repository.list(JobListQuerySchema.parse(request.query)),
    }));
    fastify.get('/api/jobs/queue', async () => ({ data: queue.snapshot() }));
    fastify.post('/api/jobs/queue/pause', async () => ({ data: queue.pause() }));
    fastify.post('/api/jobs/queue/resume', async () => ({ data: queue.resume() }));
    fastify.post('/api/jobs/queue/stop-after-current', async () => ({
      data: queue.stopAfterCurrent(),
    }));
    fastify.get('/api/jobs/interrupted', async () => ({ data: recovery.listInterrupted() }));
    fastify.get('/api/jobs/:id', async (request) => {
      const { id } = idParams.parse(request.params);
      const job = repository.getById(id);
      if (!job) throw new NotFoundError('Job not found.');
      return { data: job };
    });
    fastify.post('/api/jobs', async (request, reply) =>
      reply.code(201).send({ data: service.create(JobCreateSchema.parse(request.body)) }),
    );
    fastify.post('/api/jobs/bulk', async (request, reply) =>
      reply
        .code(201)
        .send({
          data: repository.createMany(
            z.array(JobCreateSchema).min(1).max(1000).parse(request.body),
          ),
        }),
    );
    fastify.patch('/api/jobs/:id', async (request) => ({
      data: service.update(idParams.parse(request.params).id, JobUpdateSchema.parse(request.body)),
    }));
    fastify.post('/api/jobs/:id/duplicate', async (request, reply) =>
      reply.code(201).send({ data: service.duplicate(idParams.parse(request.params).id) }),
    );
    fastify.post('/api/jobs/:id/queue', async (request) => ({
      data: queue.queue(idParams.parse(request.params).id, priorityBody.parse(request.body).priority),
    }));
    fastify.post('/api/jobs/:id/unqueue', async (request) => ({
      data: service.transition(idParams.parse(request.params).id, JobState.DRAFT),
    }));
    fastify.get('/api/jobs/:id/attempts', async (request) => ({
      data: recovery.inspect(idParams.parse(request.params).id).attempts,
    }));
    fastify.get('/api/jobs/:id/inspect', async (request) => ({
      data: recovery.inspect(idParams.parse(request.params).id),
    }));
    fastify.post('/api/jobs/:id/retry', async (request) => ({
      data: recovery.retry(idParams.parse(request.params).id),
    }));
    fastify.post('/api/jobs/:id/retry-failed', async (request) => ({
      data: queue.retryFailed(idParams.parse(request.params).id),
    }));
    fastify.post('/api/jobs/:id/mark-failed', async (request) => ({
      data: recovery.markFailed(idParams.parse(request.params).id),
    }));
    fastify.post('/api/jobs/:id/cancel', async (request) => ({
      data: (() => {
        const id = idParams.parse(request.params).id;
        const job = repository.getById(id);
        return job?.status === JobState.QUEUED ? queue.cancelQueued(id) : recovery.cancel(id);
      })(),
    }));
    fastify.post('/api/jobs/:id/reorder', async (request) => ({
      data: service.reorder(
        idParams.parse(request.params).id,
        JobReorderSchema.parse(request.body).direction,
      ),
    }));
    fastify.post('/api/projects/:id/jobs/renumber', async (request) => ({
      data: service.renumber(idParams.parse(request.params).id),
    }));
    fastify.post('/api/jobs/bulk/queue', async (request) => ({
      data: queue.bulkQueue(
        JobIdListSchema.parse(request.body).ids,
        priorityBody.parse(request.body).priority,
      ),
    }));
    fastify.post('/api/jobs/bulk/unqueue', async (request) => ({
      data: queue.bulkCancel(JobIdListSchema.parse(request.body).ids),
    }));
    fastify.post('/api/jobs/bulk/cancel', async (request) => ({
      data: queue.bulkCancel(JobIdListSchema.parse(request.body).ids),
    }));
    fastify.patch('/api/jobs/bulk', async (request) => {
      const body = BulkJobUpdateSchema.parse(request.body);
      return { data: service.bulkUpdate(body.ids, body.changes) };
    });
    fastify.post('/api/jobs/bulk/duplicate', async (request, reply) =>
      reply
        .code(201)
        .send({ data: service.bulkDuplicate(JobIdListSchema.parse(request.body).ids) }),
    );
    fastify.post('/api/jobs/bulk/delete', async (request, reply) => {
      service.bulkDelete(JobIdListSchema.parse(request.body).ids);
      return reply.code(204).send();
    });
    fastify.delete('/api/jobs/:id', async (request, reply) => {
      service.delete(idParams.parse(request.params).id);
      return reply.code(204).send();
    });
  };
