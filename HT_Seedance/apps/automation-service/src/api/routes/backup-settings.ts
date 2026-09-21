import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { SqliteDatabase } from '../../db/database.js';
import { AutomaticBackupService } from '../../services/AutomaticBackupService.js';

const settingsSchema = z.object({
  enabled: z.boolean(),
  destination: z.string().min(1).max(2000),
  frequency: z.enum(['DAILY', 'EVERY_3_DAYS', 'WEEKLY']),
  localTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  retention: z.union([z.literal(3), z.literal(5), z.literal(7), z.literal(10), z.literal(20)]),
});

export const createBackupSettingsRoutes =
  (db: SqliteDatabase): FastifyPluginAsync =>
  async (app) => {
    const service = new AutomaticBackupService(db);
    app.get('/api/backups/settings', async () => ({ data: service.settings() }));
    app.put('/api/backups/settings', async (request) => ({
      data: service.save(settingsSchema.parse(request.body)),
    }));
  };
