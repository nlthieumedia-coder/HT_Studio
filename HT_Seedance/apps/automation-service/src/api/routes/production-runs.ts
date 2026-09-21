import type { FastifyPluginAsync } from 'fastify';
import type { SqliteDatabase } from '../../db/database.js';
import { ProductionRunService } from '../../services/ProductionRunService.js';
export const createProductionRunRoutes =
  (db: SqliteDatabase): FastifyPluginAsync =>
  async (app) => {
    const service = new ProductionRunService(db);
    app.get('/api/production-runs', async () => ({ data: service.list() }));
    app.post('/api/production-runs', async (req) => ({
      data: service.create(req.body as Parameters<typeof service.create>[0]),
    }));
    app.get<{ Params: { id: string } }>('/api/production-runs/:id', async (req) => ({
      data: {
        run: service.get(req.params.id),
        statistics: service.statistics(req.params.id),
        events: service.events(req.params.id),
        stuck: service.detectStuck(req.params.id),
      },
    }));
    app.post<{ Params: { id: string } }>('/api/production-runs/:id/preflight', async (req) => ({
      data: service.preflight(req.params.id),
    }));
    for (const action of ['start', 'resume', 'stop', 'complete'] as const)
      app.post<{ Params: { id: string } }>(`/api/production-runs/:id/${action}`, async (req) => ({
        data: service[action](req.params.id),
      }));
    app.post<{ Params: { id: string } }>('/api/production-runs/:id/pause', async (req) => ({
      data: service.pause(req.params.id),
    }));
    app.post<{ Params: { id: string } }>(
      '/api/production-runs/:id/provider-incident',
      async (req) => ({ data: service.pause(req.params.id, true) }),
    );
    app.post('/api/production-runs/recover', async () => ({
      data: { recovered: service.recover() },
    }));
    app.post<{ Params: { id: string } }>('/api/production-runs/:id/reports', async (req) => ({
      data: service.reports(req.params.id),
    }));
    app.post<{ Params: { id: string } }>(
      '/api/production-runs/:id/support-bundle',
      async (req) => ({ data: service.supportBundle(req.params.id) }),
    );
  };
