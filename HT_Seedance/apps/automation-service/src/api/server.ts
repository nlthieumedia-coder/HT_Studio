import Fastify from 'fastify';
import cors from '@fastify/cors';
import { appConfig } from '../config/app-config.js';
import { logger } from '../logging/logger.js';
import { authenticateRequest } from './middleware/auth.js';
import { healthRoutes } from './routes/health.js';
import { systemRoutes } from './routes/system.js';
import { createJobsRoutes } from './routes/jobs.js';
import { createProjectsRoutes } from './routes/projects.js';
import { createAccountsRoutes } from './routes/accounts.js';
import { createImportRoutes } from './routes/imports.js';
import { createWorkerRoutes } from './routes/workers.js';
import { createOutputsRoutes } from './routes/outputs.js';
import { createLogsRoutes } from './routes/logs.js';
import { providerRoutes } from './routes/providers.js';
import { createBackupRoutes } from './routes/backup.js';
import { createBackupSettingsRoutes } from './routes/backup-settings.js';
import { apiErrorHandler } from './errors.js';
import { closeDb, getDb } from '../db/sqlite.js';
import { browserManager } from '../browser/browser-manager.js';
import type { SqliteDatabase } from '../db/database.js';
import { AutomaticBackupService } from '../services/AutomaticBackupService.js';
import { DatabaseRecoveryService } from '../services/DatabaseRecoveryService.js';
import { createProductionRunRoutes } from './routes/production-runs.js';

export async function createServer(database: SqliteDatabase = getDb()) {
  const fastify = Fastify({
    loggerInstance: logger,
  });

  await fastify.register(cors, {
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }

      try {
        const parsedOrigin = new URL(origin);
        const isTauriOrigin =
          parsedOrigin.protocol === 'tauri:' && parsedOrigin.hostname === 'localhost';
        const isHttpLoopback =
          parsedOrigin.protocol === 'http:' &&
          (parsedOrigin.hostname === '127.0.0.1' || parsedOrigin.hostname === 'localhost');

        if (isTauriOrigin || isHttpLoopback) {
          cb(null, true);
          return;
        }
      } catch {
        // Invalid origins are rejected below.
      }

      cb(null, false);
    },
    credentials: true,
  });

  // Register authentication hook
  fastify.addHook('onRequest', authenticateRequest);
  fastify.setErrorHandler(apiErrorHandler);

  // Register routes
  await fastify.register(healthRoutes);
  await fastify.register(systemRoutes);
  await fastify.register(createJobsRoutes(database));
  await fastify.register(createProjectsRoutes(database));
  await fastify.register(createAccountsRoutes(database));
  await fastify.register(createImportRoutes(database));
  await fastify.register(createWorkerRoutes(database));
  await fastify.register(createOutputsRoutes(database));
  await fastify.register(createLogsRoutes(database));
  await fastify.register(providerRoutes);
  await fastify.register(createBackupRoutes(database));
  await fastify.register(createBackupSettingsRoutes(database));
  await fastify.register(createProductionRunRoutes(database));

  return fastify;
}

export async function startServer() {
  // Ensure DB initialized
  getDb();

  const app = await createServer();
  const automaticBackups = new AutomaticBackupService(getDb());
  automaticBackups.start();

  try {
    const address = await app.listen({
      port: appConfig.port,
      host: appConfig.host, // Strictly 127.0.0.1
    });

    logger.info(
      { address, host: appConfig.host, port: appConfig.port },
      'HT_Dola_Studio automation service started successfully',
    );
  } catch (err) {
    logger.fatal({ err }, 'Failed to start automation service server');
    process.exit(1);
  }

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Received termination signal, shutting down gracefully...');
    try {
      await app.close();
      automaticBackups.stop();
      await browserManager.closeAll();
      closeDb();
      logger.info('Automation service shutdown complete.');
      process.exit(0);
    } catch (error) {
      logger.error({ error }, 'Error during graceful shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return app;
}

export async function startRecoveryServer(details: Record<string, unknown>) {
  const app = Fastify({ loggerInstance: logger });
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      try {
        const parsed = new URL(origin);
        const allowed =
          (parsed.protocol === 'tauri:' && parsed.hostname === 'localhost') ||
          (parsed.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(parsed.hostname));
        return cb(null, allowed);
      } catch {
        return cb(null, false);
      }
    },
  });
  app.get('/health', async () => ({
    status: 'recovery',
    service: 'ht-dola-automation',
    recoveryMode: true,
  }));
  app.get('/api/recovery/status', async () => ({ data: details }));
  app.post('/api/recovery/integrity/full', async () => ({
    data: new DatabaseRecoveryService().fullIntegrityCheck(),
  }));
  await app.listen({ port: appConfig.port, host: appConfig.host });
  logger.error(
    { module: 'recovery', event: 'recovery_mode', ...details },
    'Database is unsafe; service started in Recovery Mode.',
  );
  const shutdown = async () => {
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  return app;
}
