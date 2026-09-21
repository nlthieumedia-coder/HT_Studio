import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SqliteDatabase } from './database.js';
import { logger } from '../logging/logger.js';

const migrationsDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

interface MigrationRecord {
  version: number;
  name: string;
}
const tableExists = (database: SqliteDatabase, table: string): boolean =>
  Boolean(
    database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table),
  );
const columnExists = (database: SqliteDatabase, table: string, column: string): boolean =>
  (database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).some(
    (item) => item.name === column,
  );

const upgradeLegacyPhaseZeroSchema = (database: SqliteDatabase, schemaSql: string): boolean => {
  if (!tableExists(database, 'projects') || columnExists(database, 'projects', 'status'))
    return false;
  logger.info('Upgrading legacy Phase 0 database schema');
  database.pragma('foreign_keys = OFF');
  try {
    database.transaction(() => {
      const legacyTables = [
        'job_attempts',
        'jobs',
        'accounts',
        'browser_profiles',
        'projects',
        'app_settings',
      ];
      for (const table of legacyTables)
        if (tableExists(database, table))
          database.exec(`ALTER TABLE ${table} RENAME TO ${table}_legacy`);
      database.exec(schemaSql);
      database.exec(
        `INSERT INTO projects (id,name,description,status,created_at,updated_at) SELECT id,name,COALESCE(description,''),'ACTIVE',created_at,updated_at FROM projects_legacy`,
      );
      if (tableExists(database, 'browser_profiles_legacy'))
        database.exec(
          `INSERT INTO browser_profiles (id,name,profile_directory,browser_type,status,created_at,updated_at) SELECT id,name,storage_path,'chromium',CASE WHEN is_locked=1 THEN 'IN_USE' ELSE 'AVAILABLE' END,created_at,updated_at FROM browser_profiles_legacy`,
        );
      if (tableExists(database, 'accounts_legacy'))
        database.exec(
          `INSERT INTO accounts (id,display_name,provider,browser_profile_id,enabled,session_status,last_session_check,created_at,updated_at) SELECT id,COALESCE(alias,email),provider_id,profile_id,1,CASE WHEN is_authenticated=1 THEN 'AUTHENTICATED' ELSE 'UNKNOWN' END,last_authenticated_at,created_at,updated_at FROM accounts_legacy`,
        );
      if (tableExists(database, 'jobs_legacy'))
        database.exec(
          `INSERT INTO jobs (id,project_id,scene_number,provider,account_id,prompt,input_media_json,duration_seconds,aspect_ratio,resolution,status,priority,attempt_count,max_attempts,error_message,provider_metadata_json,created_at,updated_at,started_at,completed_at) SELECT id,project_id,ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at),provider_id,account_id,COALESCE(json_extract(input_json,'$.prompt'),''),json_object('image',json_extract(input_json,'$.referenceImages[0]'),'video',json_extract(input_json,'$.referenceVideo'),'audio',json_extract(input_json,'$.referenceAudio')),COALESCE(json_extract(input_json,'$.durationSeconds'),5),COALESCE(json_extract(input_json,'$.aspectRatio'),'16:9'),'1920x1080',state,priority,retry_count,max_retries,NULL,output_json,created_at,updated_at,started_at,completed_at FROM jobs_legacy`,
        );
      if (tableExists(database, 'job_attempts_legacy'))
        database.exec(
          `INSERT INTO job_attempts (id,job_id,attempt_number,worker_id,status,started_at,ended_at,error_message) SELECT id,job_id,attempt_number,worker_id,status,started_at,ended_at,error_message FROM job_attempts_legacy`,
        );
      if (tableExists(database, 'app_settings_legacy'))
        database.exec(
          `INSERT INTO settings (key,value_json,updated_at) SELECT key,value,updated_at FROM app_settings_legacy`,
        );
      for (const table of legacyTables.reverse())
        if (tableExists(database, `${table}_legacy`)) database.exec(`DROP TABLE ${table}_legacy`);
    })();
  } finally {
    database.pragma('foreign_keys = ON');
  }
  return true;
};

export const runMigrations = (database: SqliteDatabase): void => {
  database.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, applied_at TEXT NOT NULL)`,
  );
  if (!fs.existsSync(migrationsDirectory))
    throw new Error(`Migrations directory not found: ${migrationsDirectory}`);
  const migrations = fs
    .readdirSync(migrationsDirectory)
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .sort()
    .map((file): MigrationRecord & { file: string } => ({
      version: Number(file.split('_')[0]),
      name: file.replace(/\.sql$/, ''),
      file,
    }));
  const applied = new Set(
    (
      database.prepare('SELECT version FROM schema_migrations').all() as Array<{ version: number }>
    ).map((row) => row.version),
  );
  const pending = migrations.filter((migration) => !applied.has(migration.version));
  if (applied.size > 0 && pending.length > 0 && database.name !== ':memory:') {
    const recoveryDirectory = path.join(path.dirname(database.name), 'recovery');
    fs.mkdirSync(recoveryDirectory, { recursive: true });
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
    const snapshot = path.join(recoveryDirectory, `pre_migration_${stamp}.db`);
    database.exec(`VACUUM INTO '${snapshot.replaceAll("'", "''")}'`);
    logger.info(
      { event: 'pre_migration_backup', snapshot, pending: pending.map((item) => item.version) },
      'Created pre-migration safety snapshot.',
    );
  }
  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;
    const sql = fs.readFileSync(path.join(migrationsDirectory, migration.file), 'utf8');
    try {
      const upgradedLegacy = migration.version === 1 && upgradeLegacyPhaseZeroSchema(database, sql);
      if (!upgradedLegacy) database.transaction(() => database.exec(sql))();
      database
        .prepare('INSERT INTO schema_migrations (version,name,applied_at) VALUES (?,?,?)')
        .run(migration.version, migration.name, new Date().toISOString());
      logger.info(
        { version: migration.version, migration: migration.name },
        'Applied database migration',
      );
    } catch (error) {
      logger.error(
        { version: migration.version, migration: migration.name, error },
        'Database migration failed',
      );
      throw error;
    }
  }
};

export const getMigrationStatus = (
  database: SqliteDatabase,
): Array<{ version: number; name: string; appliedAt: string }> =>
  database
    .prepare('SELECT version,name,applied_at AS appliedAt FROM schema_migrations ORDER BY version')
    .all() as Array<{ version: number; name: string; appliedAt: string }>;
