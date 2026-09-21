import { randomUUID } from 'node:crypto';
import type { SqliteDatabase } from '../database.js';
import type { ApplicationLogRecord, PaginatedResult } from '../types.js';
import { nowIso, parseJson } from './helpers.js';

type Row = Omit<ApplicationLogRecord, 'metadata'> & { metadataJson: string | null };
const select =
  'SELECT id,timestamp,level,module,job_id AS jobId,project_id AS projectId,worker_id AS workerId,account_id AS accountId,event,message,metadata_json AS metadataJson FROM application_logs';
const map = (row: Row): ApplicationLogRecord => {
  const { metadataJson, ...rest } = row;
  return { ...rest, metadata: parseJson(metadataJson, null) };
};

export interface LogQuery {
  level?: string;
  module?: string;
  jobId?: string;
  workerId?: string;
  accountId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export class LogRepository {
  constructor(private readonly database: SqliteDatabase) {}

  insert(input: Omit<ApplicationLogRecord, 'id' | 'timestamp'> & { timestamp?: string }): ApplicationLogRecord {
    const id = randomUUID();
    const timestamp = input.timestamp ?? nowIso();
    this.database
      .prepare('INSERT INTO application_logs VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .run(
        id,
        timestamp,
        input.level,
        input.module,
        input.jobId,
        input.projectId,
        input.workerId,
        input.accountId,
        input.event,
        input.message,
        input.metadata ? JSON.stringify(input.metadata) : null,
      );
    return map(this.database.prepare(`${select} WHERE id=?`).get(id) as Row);
  }

  list(limit = 100, offset = 0): PaginatedResult<ApplicationLogRecord> {
    return this.query({ limit, offset });
  }

  query(query: LogQuery): PaginatedResult<ApplicationLogRecord> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (query.level) {
      conditions.push('level=?');
      values.push(query.level);
    }
    if (query.module) {
      conditions.push('module=?');
      values.push(query.module);
    }
    if (query.jobId) {
      conditions.push('job_id=?');
      values.push(query.jobId);
    }
    if (query.workerId) {
      conditions.push('worker_id=?');
      values.push(query.workerId);
    }
    if (query.accountId) {
      conditions.push('account_id=?');
      values.push(query.accountId);
    }
    if (query.search) {
      conditions.push('(message LIKE ? OR module LIKE ? OR event LIKE ?)');
      values.push(`%${query.search}%`, `%${query.search}%`, `%${query.search}%`);
    }
    const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
    const total = (this.database.prepare(`SELECT COUNT(*) count FROM application_logs${where}`).get(...values) as { count: number }).count;
    const limit = query.limit ?? 100;
    const offset = query.offset ?? 0;
    const rows = this.database
      .prepare(`${select}${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`)
      .all(...values, limit, offset) as Row[];
    return { items: rows.map(map), total, limit, offset };
  }
}
