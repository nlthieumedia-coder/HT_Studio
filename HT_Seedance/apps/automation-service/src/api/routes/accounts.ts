import type { FastifyPluginAsync } from 'fastify';
import { AccountCreateSchema, AccountListQuerySchema, AccountUpdateSchema } from '@ht-dola/shared';
import { getDb, type SqliteDatabase } from '../../db/database.js';
import { AccountRepository } from '../../db/repositories/AccountRepository.js';
import { NotFoundError } from '../errors.js';
import { AccountService } from '../../services/AccountService.js';

export const createAccountsRoutes =
  (database: SqliteDatabase = getDb()): FastifyPluginAsync =>
  async (fastify) => {
    const repository = new AccountRepository(database);
    const service = new AccountService(database);
    fastify.get('/api/accounts', async (request) => ({
      data: repository.list(AccountListQuerySchema.parse(request.query)),
    }));
    fastify.get('/api/accounts/:id', async (request) => {
      const { id } = request.params as { id: string };
      const account = repository.getById(id);
      if (!account) throw new NotFoundError('Account not found.');
      return { data: account };
    });
    fastify.post('/api/accounts', async (request, reply) =>
      reply
        .code(201)
        .send({
          data: service.create(
            AccountCreateSchema.omit({ browserProfileId: true }).parse(request.body),
          ),
        }),
    );
    fastify.post('/api/accounts/:id/open-profile', async (request) => {
      const { id } = request.params as { id: string };
      return { data: await service.openProfile(id) };
    });
    fastify.post('/api/accounts/:id/check-session', async (request) => {
      const { id } = request.params as { id: string };
      return { data: await service.checkSession(id) };
    });
    fastify.patch('/api/accounts/:id', async (request) => {
      const { id } = request.params as { id: string };
      const account = repository.update(id, AccountUpdateSchema.parse(request.body));
      if (!account) throw new NotFoundError('Account not found.');
      return { data: account };
    });
    fastify.post('/api/accounts/:id/enable', async (request) => {
      const { id } = request.params as { id: string };
      const account = repository.setEnabled(id, true);
      if (!account) throw new NotFoundError('Account not found.');
      return { data: account };
    });
    fastify.post('/api/accounts/:id/disable', async (request) => {
      const { id } = request.params as { id: string };
      const account = repository.setEnabled(id, false);
      if (!account) throw new NotFoundError('Account not found.');
      return { data: account };
    });
    fastify.delete('/api/accounts/:id', async (request, reply) => {
      const { id } = request.params as { id: string };
      return reply.send({ data: service.deleteMetadata(id) });
    });
  };
