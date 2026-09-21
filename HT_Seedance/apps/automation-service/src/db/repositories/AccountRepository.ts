import { randomUUID } from 'node:crypto';
import type {
  AccountCreateInput,
  AccountListQuery,
  AccountSessionStatus,
  AccountUpdateInput,
} from '@ht-dola/shared';
import type { SqliteDatabase } from '../database.js';
import type { AccountRecord, PaginatedResult } from '../types.js';
import { nowIso } from './helpers.js';
const select =
  'SELECT id,display_name AS displayName,provider,browser_profile_id AS browserProfileId,enabled,session_status AS sessionStatus,last_session_check AS lastSessionCheck,created_at AS createdAt,updated_at AS updatedAt FROM accounts';
type AccountRow = Omit<AccountRecord, 'enabled'> & { enabled: number };
const normalize = (row: AccountRow): AccountRecord => ({ ...row, enabled: Boolean(row.enabled) });
export class AccountRepository {
  constructor(private readonly database: SqliteDatabase) {}
  create(input: AccountCreateInput): AccountRecord {
    const id = randomUUID(),
      now = nowIso();
    this.database
      .prepare(
        "INSERT INTO accounts (id,display_name,provider,browser_profile_id,enabled,session_status,created_at,updated_at) VALUES (?,?,?,?,?,'UNKNOWN',?,?)",
      )
      .run(
        id,
        input.displayName,
        input.provider,
        input.browserProfileId ?? null,
        input.enabled ? 1 : 0,
        now,
        now,
      );
    return this.getById(id)!;
  }
  getById(id: string): AccountRecord | undefined {
    const row = this.database.prepare(`${select} WHERE id=?`).get(id) as AccountRow | undefined;
    return row ? normalize(row) : undefined;
  }
  list(query: AccountListQuery): PaginatedResult<AccountRecord> {
    const c: string[] = [],
      p: unknown[] = [];
    if (query.sessionStatus) {
      c.push('session_status=?');
      p.push(query.sessionStatus);
    }
    if (query.provider) {
      c.push('provider=?');
      p.push(query.provider);
    }
    if (query.search) {
      c.push('(display_name LIKE ? OR provider LIKE ?)');
      p.push(`%${query.search}%`, `%${query.search}%`);
    }
    const w = c.length ? ` WHERE ${c.join(' AND ')}` : '';
    const total = (
      this.database.prepare(`SELECT COUNT(*) count FROM accounts${w}`).get(...p) as {
        count: number;
      }
    ).count;
    const rows = this.database
      .prepare(`${select}${w} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .all(...p, query.limit, query.offset) as AccountRow[];
    return { items: rows.map(normalize), total, limit: query.limit, offset: query.offset };
  }
  update(id: string, input: AccountUpdateInput): AccountRecord | undefined {
    const f: string[] = [],
      v: unknown[] = [];
    if (input.displayName !== undefined) {
      f.push('display_name=?');
      v.push(input.displayName);
    }
    if (input.provider !== undefined) {
      f.push('provider=?');
      v.push(input.provider);
    }
    if (input.browserProfileId !== undefined) {
      f.push('browser_profile_id=?');
      v.push(input.browserProfileId);
    }
    if (input.enabled !== undefined) {
      f.push('enabled=?');
      v.push(input.enabled ? 1 : 0);
    }
    if (!f.length) return this.getById(id);
    f.push('updated_at=?');
    v.push(nowIso(), id);
    return this.database.prepare(`UPDATE accounts SET ${f.join(',')} WHERE id=?`).run(...v).changes
      ? this.getById(id)
      : undefined;
  }
  setEnabled(id: string, enabled: boolean): AccountRecord | undefined {
    return this.update(id, { enabled });
  }
  updateSessionStatus(id: string, status: AccountSessionStatus): AccountRecord | undefined {
    const now = nowIso();
    return this.database
      .prepare('UPDATE accounts SET session_status=?,last_session_check=?,updated_at=? WHERE id=?')
      .run(status, now, now, id).changes
      ? this.getById(id)
      : undefined;
  }
  delete(id: string): boolean {
    return this.database.prepare('DELETE FROM accounts WHERE id=?').run(id).changes > 0;
  }
}
