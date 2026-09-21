import { FastifyInstance } from 'fastify';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (_request, _reply) => {
    return {
      status: 'ok',
      service: 'ht-dola-automation',
      timestamp: new Date().toISOString(),
    };
  });
}
