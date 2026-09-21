import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getDb, type SqliteDatabase } from '../../db/database.js';
import { LogRepository } from '../../db/repositories/LogRepository.js';

const querySchema = z.object({
  level: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']).optional(),
  module: z.string().optional(),
  jobId: z.string().uuid().optional(),
  workerId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export const createLogsRoutes =
  (database: SqliteDatabase = getDb()): FastifyPluginAsync =>
  async (fastify) => {
    const logs = new LogRepository(database);
    fastify.get('/api/logs', async (request) => {
      const parsed = querySchema.parse(request.query);
      return {
        data: logs.query({
          ...(parsed.level ? { level: parsed.level } : {}),
          ...(parsed.module ? { module: parsed.module } : {}),
          ...(parsed.jobId ? { jobId: parsed.jobId } : {}),
          ...(parsed.workerId ? { workerId: parsed.workerId } : {}),
          ...(parsed.accountId ? { accountId: parsed.accountId } : {}),
          ...(parsed.search ? { search: parsed.search } : {}),
          limit: parsed.limit,
          offset: parsed.offset,
        }),
      };
    });
  };
