import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getDb, type SqliteDatabase } from '../../db/database.js';
import { OutputRepository } from '../../db/repositories/OutputRepository.js';
import { MediaOutputManager } from '../../services/MediaOutputManager.js';

const params = z.object({ id: z.string().uuid() });
const fileNameBody = z.object({ fileName: z.string().min(1).max(255) });
const targetDirectoryBody = z.object({ targetDirectory: z.string().min(1).max(1000) });

export const createOutputsRoutes =
  (database: SqliteDatabase = getDb()): FastifyPluginAsync =>
  async (fastify) => {
    const repository = new OutputRepository(database);
    const manager = new MediaOutputManager(database);

    fastify.get('/api/outputs', async () => ({ data: repository.list(200, 0) }));
    fastify.get('/api/media/diagnostics', async () => ({ data: manager.diagnostics() }));
    fastify.post('/api/outputs/:id/probe', async (request) => ({
      data: manager.probe(params.parse(request.params).id),
    }));
    fastify.post('/api/outputs/:id/rename', async (request) => ({
      data: manager.rename(params.parse(request.params).id, fileNameBody.parse(request.body).fileName),
    }));
    fastify.post('/api/outputs/:id/move', async (request) => ({
      data: manager.move(
        params.parse(request.params).id,
        targetDirectoryBody.parse(request.body).targetDirectory,
      ),
    }));
    fastify.post('/api/outputs/:id/copy', async (request) => ({
      data: manager.copy(
        params.parse(request.params).id,
        targetDirectoryBody.parse(request.body).targetDirectory,
      ),
    }));
    fastify.post('/api/outputs/:id/open-folder', async (request) => ({
      data: manager.openContainingFolder(params.parse(request.params).id),
    }));
    fastify.post('/api/outputs/:id/normalize/faststart', async (request) => ({
      data: manager.normalizeFaststart(params.parse(request.params).id),
    }));
  };
