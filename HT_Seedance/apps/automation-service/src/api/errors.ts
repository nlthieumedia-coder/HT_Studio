import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { logger } from '../logging/logger.js';
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
export class ValidationError extends AppError {
  constructor(message = 'Request validation failed.') {
    super('VALIDATION_FAILED', message, 400);
  }
}
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found.') {
    super('NOT_FOUND', message, 404);
  }
}
export class ConflictError extends AppError {
  constructor(message = 'The operation conflicts with existing data.') {
    super('CONFLICT', message, 409);
  }
}
export class DatabaseError extends AppError {
  constructor(message = 'The database operation failed.') {
    super('DATABASE_ERROR', message, 500);
  }
}
export const apiErrorHandler = (
  error: FastifyError | Error,
  _request: FastifyRequest,
  reply: FastifyReply,
) => {
  if (error instanceof AppError)
    return reply
      .code(error.statusCode)
      .send({ error: { code: error.code, message: error.message } });
  if (error instanceof ZodError)
    return reply
      .code(400)
      .send({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Request validation failed.',
          details: error.flatten(),
        },
      });
  const sqliteCode = (error as { code?: string }).code;
  if (sqliteCode?.startsWith('SQLITE_CONSTRAINT'))
    return reply
      .code(409)
      .send({
        error: { code: 'DATABASE_CONFLICT', message: 'The operation conflicts with existing data.' },
      });
  logger.error({ error }, 'Unhandled API error');
  return reply
    .code(500)
    .send({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected internal error occurred.' } });
};
