import { getDb } from '../db/database.js';
import { LogRepository } from '../db/repositories/LogRepository.js';
import { logger } from './logger.js';

export interface AuditLogInput {
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  module: string;
  jobId?: string | null;
  projectId?: string | null;
  workerId?: string | null;
  accountId?: string | null;
  event?: string | null;
  message: string;
  metadata?: Record<string, unknown> | null;
}

export const auditLog = (input: AuditLogInput) => {
  const safe = {
    module: input.module,
    job_id: input.jobId ?? null,
    project_id: input.projectId ?? null,
    worker_id: input.workerId ?? null,
    account_id: input.accountId ?? null,
    event: input.event ?? null,
  };
  logger[input.level.toLowerCase() as 'debug' | 'info' | 'warn' | 'error'](
    { ...safe, metadata: input.metadata ?? undefined },
    input.message,
  );
  try {
    new LogRepository(getDb()).insert({
      level: input.level,
      module: input.module,
      jobId: input.jobId ?? null,
      projectId: input.projectId ?? null,
      workerId: input.workerId ?? null,
      accountId: input.accountId ?? null,
      event: input.event ?? null,
      message: input.message,
      metadata: input.metadata ?? null,
    });
  } catch {
    // DB logging is best-effort; Pino file logging remains the fallback.
  }
};
