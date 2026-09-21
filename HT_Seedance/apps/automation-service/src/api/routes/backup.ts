import fs from 'node:fs';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { SqliteDatabase } from '../../db/database.js';
import { appConfig } from '../../config/app-config.js';
import { BackupService } from '../../services/BackupService.js';
import { RestoreService } from '../../services/RestoreService.js';
import { DatabaseRecoveryService } from '../../services/DatabaseRecoveryService.js';
import { PathRelinkService } from '../../services/PathRelinkService.js';
import { maintenanceCoordinator } from '../../services/MaintenanceService.js';
const pathBody = z.object({ path: z.string().min(1).max(2000) }),
  backupBody = z.object({
    destination: z.string().min(1).max(2000),
    type: z.enum(['DATA', 'FULL', 'PRE_UPDATE', 'PRE_MIGRATION']).default('DATA'),
    includeProfiles: z.boolean().default(false),
    includeOutputs: z.boolean().default(false),
    includeLogs: z.boolean().default(false),
  }),
  relinkBody = z.object({
    oldPrefix: z.string().min(2),
    newPrefix: z.string().min(2),
    commit: z.boolean().default(false),
  });
export const createBackupRoutes =
  (db: SqliteDatabase): FastifyPluginAsync =>
  async (fastify) => {
    const backup = new BackupService(db),
      recovery = new DatabaseRecoveryService(),
      relink = new PathRelinkService(db);
    fastify.get('/api/backups', async () => ({
      data: db
        .prepare(
          'SELECT id,file_path AS filePath,backup_type AS backupType,app_version AS appVersion,schema_version AS schemaVersion,size,status,created_at AS createdAt,verified_at AS verifiedAt,notes FROM backups ORDER BY created_at DESC LIMIT 200',
        )
        .all(),
    }));
    fastify.post('/api/backups/estimate', async (request) => ({
      data: backup.estimate(backupBody.omit({ destination: true }).parse(request.body)),
    }));
    fastify.post('/api/backups', async (request) => ({
      data: await backup.create(backupBody.parse(request.body)),
    }));
    fastify.post('/api/backups/verify', async (request) => ({
      data: backup.verify(pathBody.parse(request.body).path),
    }));
    fastify.post('/api/backups/preview', async (request) => ({
      data: new RestoreService(db, appConfig.dbPath).preview(pathBody.parse(request.body).path),
    }));
    fastify.post('/api/backups/restore', async (request, reply) => {
      const body = pathBody
        .extend({ confirmation: z.literal(true), safetyDestination: z.string().min(1) })
        .parse(request.body);
      const preview = new RestoreService(db, appConfig.dbPath).preview(body.path);
      if (preview.compatibility === 'INVALID' || preview.compatibility === 'NEWER_THAN_APPLICATION')
        return reply.code(409).send({ error: preview.compatibility, data: preview });
      fs.writeFileSync(
        `${appConfig.dbPath}.pending-restore.json`,
        JSON.stringify({ path: body.path, safetyDestination: body.safetyDestination }),
        { mode: 0o600 },
      );
      return reply.code(202).send({
        data: {
          accepted: true,
          message: 'Restore scheduled. Restart the application to enter maintenance restore.',
          preview,
        },
      });
    });
    fastify.delete('/api/backups/:id', async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params),
        confirm = z.object({ confirm: z.literal('true') }).parse(request.query),
        row = db.prepare('SELECT file_path path FROM backups WHERE id=?').get(id) as
          { path: string } | undefined;
      if (row && confirm) {
        fs.rmSync(row.path, { recursive: true, force: true });
        db.prepare('DELETE FROM backups WHERE id=?').run(id);
      }
      return reply.code(204).send();
    });
    fastify.get('/api/recovery/status', async () => ({
      data: {
        integrity: recovery.quickCheck(),
        maintenance: maintenanceCoordinator.state,
        lastVerified:
          db
            .prepare(
              "SELECT * FROM backups WHERE status='COMPLETED' ORDER BY verified_at DESC LIMIT 1",
            )
            .get() ?? null,
      },
    }));
    fastify.post('/api/recovery/integrity/full', async () => ({
      data: recovery.fullIntegrityCheck(),
    }));
    fastify.post('/api/recovery/relink', async (request) => {
      const body = relinkBody.parse(request.body);
      return {
        data: body.commit
          ? relink.commit(body.oldPrefix, body.newPrefix)
          : relink.preview(body.oldPrefix, body.newPrefix),
      };
    });
    fastify.get('/api/recovery/missing-media', async () => ({ data: relink.missingMedia() }));
  };
