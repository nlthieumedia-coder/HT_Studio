import { randomUUID } from 'node:crypto';
import type { SqliteDatabase } from '../database.js';
import type { OutputRecord } from '../types.js';
import { nowIso } from './helpers.js';

const select =
  'SELECT id,job_id AS jobId,file_path AS filePath,file_name AS fileName,duration_seconds AS durationSeconds,width,height,fps,video_codec AS videoCodec,audio_codec AS audioCodec,file_size AS fileSize,checksum_sha256 AS checksumSha256,created_at AS createdAt FROM outputs';
type Input = Omit<OutputRecord, 'id' | 'createdAt'>;

export class OutputRepository {
  constructor(private readonly database: SqliteDatabase) {}

  create(input: Input): OutputRecord {
    const id = randomUUID();
    this.database
      .prepare('INSERT INTO outputs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(
        id,
        input.jobId,
        input.filePath,
        input.fileName,
        input.durationSeconds,
        input.width,
        input.height,
        input.fps,
        input.videoCodec,
        input.audioCodec,
        input.fileSize,
        input.checksumSha256,
        nowIso(),
      );
    return this.getById(id)!;
  }

  getById(id: string): OutputRecord | undefined {
    return this.database.prepare(`${select} WHERE id=?`).get(id) as OutputRecord | undefined;
  }

  updateFileMetadata(id: string, input: Input): OutputRecord | undefined {
    this.database
      .prepare(
        'UPDATE outputs SET job_id=?,file_path=?,file_name=?,duration_seconds=?,width=?,height=?,fps=?,video_codec=?,audio_codec=?,file_size=?,checksum_sha256=? WHERE id=?',
      )
      .run(
        input.jobId,
        input.filePath,
        input.fileName,
        input.durationSeconds,
        input.width,
        input.height,
        input.fps,
        input.videoCodec,
        input.audioCodec,
        input.fileSize,
        input.checksumSha256,
        id,
      );
    return this.getById(id);
  }

  getByJob(jobId: string): OutputRecord[] {
    return this.database
      .prepare(`${select} WHERE job_id=? ORDER BY created_at DESC`)
      .all(jobId) as OutputRecord[];
  }

  list(limit = 50, offset = 0): OutputRecord[] {
    return this.database
      .prepare(`${select} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .all(limit, offset) as OutputRecord[];
  }
}
