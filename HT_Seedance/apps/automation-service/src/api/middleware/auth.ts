import { FastifyRequest, FastifyReply } from 'fastify';
import { appConfig } from '../../config/app-config.js';

export const authenticateRequest = async (request: FastifyRequest, reply: FastifyReply) => {
  // Allow health endpoint without token
  if (request.url === '/health' || request.url.startsWith('/health/')) {
    return;
  }

  const authHeader = request.headers['x-auth-token'] || request.headers['authorization'];
  const token = Array.isArray(authHeader) ? authHeader[0] : authHeader;

  const cleanToken = token?.replace(/^Bearer\s+/i, '').trim();

  if (!cleanToken || cleanToken !== appConfig.authToken) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Invalid or missing authentication token for local HT_Dola_Studio automation service.',
    });
  }
};
