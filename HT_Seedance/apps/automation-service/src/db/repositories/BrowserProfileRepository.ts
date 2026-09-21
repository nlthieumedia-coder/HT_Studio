import { randomUUID } from 'node:crypto';
import type { BrowserProfileStatus } from '@ht-dola/shared';
import type { SqliteDatabase } from '../database.js';
import type { BrowserProfileRecord } from '../types.js';
import { nowIso } from './helpers.js';
const select =
  'SELECT id,name,profile_directory AS profileDirectory,browser_type AS browserType,status,created_at AS createdAt,updated_at AS updatedAt FROM browser_profiles';
export interface BrowserProfileInput {
  name: string;
  profileDirectory: string;
  browserType?: string;
  status?: BrowserProfileStatus;
}
export class BrowserProfileRepository {
  constructor(private readonly database: SqliteDatabase) {}
  create(input: BrowserProfileInput): BrowserProfileRecord {
    return this.createWithId(randomUUID(), input);
  }
  createWithId(id: string, input: BrowserProfileInput): BrowserProfileRecord {
    const now = nowIso();
    this.database
      .prepare('INSERT INTO browser_profiles VALUES (?,?,?,?,?,?,?)')
      .run(
        id,
        input.name,
        input.profileDirectory,
        input.browserType ?? 'chromium',
        input.status ?? 'AVAILABLE',
        now,
        now,
      );
    return this.getById(id)!;
  }
  getById(id: string) {
    return this.database.prepare(`${select} WHERE id=?`).get(id) as
      BrowserProfileRecord | undefined;
  }
  list() {
    return this.database
      .prepare(`${select} ORDER BY created_at DESC`)
      .all() as BrowserProfileRecord[];
  }
  update(id: string, input: Partial<BrowserProfileInput>) {
    const existing = this.getById(id);
    if (!existing) return undefined;
    this.database
      .prepare(
        'UPDATE browser_profiles SET name=?,profile_directory=?,browser_type=?,status=?,updated_at=? WHERE id=?',
      )
      .run(
        input.name ?? existing.name,
        input.profileDirectory ?? existing.profileDirectory,
        input.browserType ?? existing.browserType,
        input.status ?? existing.status,
        nowIso(),
        id,
      );
    return this.getById(id);
  }
  delete(id: string) {
    return this.database.prepare('DELETE FROM browser_profiles WHERE id=?').run(id).changes > 0;
  }
}
