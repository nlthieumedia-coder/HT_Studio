import fs from 'node:fs';
import path from 'node:path';
import type { SqliteDatabase } from '../db/database.js';
const rewrite = (value: string, oldPrefix: string, newPrefix: string) =>
  value.toLowerCase().startsWith(oldPrefix.toLowerCase())
    ? newPrefix + value.slice(oldPrefix.length)
    : value;
export class PathRelinkService {
  constructor(private readonly db: SqliteDatabase) {}
  preview(oldPrefix: string, newPrefix: string) {
    this.validate(oldPrefix, newPrefix);
    let jobs = 0,
      outputs = 0;
    for (const row of this.db.prepare('SELECT input_media_json json FROM jobs').all() as {
      json: string;
    }[]) {
      const media = JSON.parse(row.json) as Record<string, string>;
      if (
        Object.values(media).some(
          (value) => typeof value === 'string' && rewrite(value, oldPrefix, newPrefix) !== value,
        )
      )
        jobs++;
    }
    for (const row of this.db.prepare('SELECT file_path path FROM outputs').all() as {
      path: string;
    }[])
      if (rewrite(row.path, oldPrefix, newPrefix) !== row.path) outputs++;
    return { jobs, outputs, oldPrefix, newPrefix };
  }
  commit(oldPrefix: string, newPrefix: string) {
    const preview = this.preview(oldPrefix, newPrefix);
    this.db.transaction(() => {
      const jobs = this.db.prepare('SELECT id,input_media_json json FROM jobs').all() as Array<{
          id: string;
          json: string;
        }>,
        updateJob = this.db.prepare('UPDATE jobs SET input_media_json=?,updated_at=? WHERE id=?');
      for (const row of jobs) {
        const media = JSON.parse(row.json) as Record<string, string>;
        let changed = false;
        for (const [key, value] of Object.entries(media))
          if (typeof value === 'string') {
            const next = rewrite(value, oldPrefix, newPrefix);
            if (next !== value) {
              media[key] = next;
              changed = true;
            }
          }
        if (changed) updateJob.run(JSON.stringify(media), new Date().toISOString(), row.id);
      }
      const outputs = this.db.prepare('SELECT id,file_path FROM outputs').all() as Array<{
          id: string;
          file_path: string;
        }>,
        updateOutput = this.db.prepare('UPDATE outputs SET file_path=? WHERE id=?');
      for (const row of outputs) {
        const next = rewrite(row.file_path, oldPrefix, newPrefix);
        if (next !== row.file_path) updateOutput.run(next, row.id);
      }
    })();
    return preview;
  }
  missingMedia() {
    const report = { images: 0, videos: 0, audio: 0, outputs: 0 };
    for (const row of this.db.prepare('SELECT input_media_json json FROM jobs').all() as {
      json: string;
    }[]) {
      const media = JSON.parse(row.json) as Record<string, string>;
      for (const [kind, file] of Object.entries(media))
        if (file && !fs.existsSync(file)) {
          if (kind === 'image') report.images++;
          else if (kind === 'video') report.videos++;
          else if (kind === 'audio') report.audio++;
        }
    }
    for (const row of this.db.prepare('SELECT file_path path FROM outputs').all() as {
      path: string;
    }[])
      if (!fs.existsSync(row.path)) report.outputs++;
    return report;
  }
  private validate(oldPrefix: string, newPrefix: string) {
    if (!path.isAbsolute(oldPrefix) || !path.isAbsolute(newPrefix) || oldPrefix === newPrefix)
      throw new Error('Path relink requires distinct absolute prefixes.');
  }
}
