import { FastifyInstance } from 'fastify';
import os from 'node:os';
import { SystemInfo } from '@ht-dola/shared';
import { jobQueue } from '../../queue/job-queue.js';
import { appConfig } from '../../config/app-config.js';
import { getDb } from '../../db/database.js';
import { DiagnosticsService } from '../../services/DiagnosticsService.js';

const startTime = Date.now();

export async function systemRoutes(fastify: FastifyInstance) {
  fastify.get('/api/system/info', async (_request, reply) => {
    const mem = process.memoryUsage();
    const systemInfo: SystemInfo = {
      version: '1.0.0',
      service: 'ht-dola-automation',
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
      nodeVersion: process.version,
      platform: os.platform(),
      arch: os.arch(),
      memoryUsageMb: {
        rss: Math.round(mem.rss / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      },
      activeWorkers: 0,
      queuedJobs: jobQueue.size(),
    };

    return reply.send({
      success: true,
      data: systemInfo,
      config: {
        env: appConfig.env,
        host: appConfig.host,
        port: appConfig.port,
        dataDir: appConfig.dataDir,
      },
    });
  });
  fastify.get('/api/system/health', async () => ({ data: new DiagnosticsService(getDb()).health() }));
  fastify.post('/api/system/diagnostics/export', async () => ({
    data: new DiagnosticsService(getDb()).exportPackage(),
  }));
}
