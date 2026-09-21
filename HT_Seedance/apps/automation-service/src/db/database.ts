import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { appConfig } from '../config/app-config.js';
import { logger } from '../logging/logger.js';
import { runMigrations } from './migrations.js';

export type SqliteDatabase = Database.Database;
let databaseInstance: SqliteDatabase | null = null;

export const openDatabase = (databasePath: string): SqliteDatabase => {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const database = new Database(databasePath);
  database.pragma('foreign_keys = ON');
  database.pragma('journal_mode = WAL');
  database.pragma('busy_timeout = 5000');
  runMigrations(database);
  logger.info({ dbPath: databasePath }, 'SQLite database initialized');
  return database;
};

export const getDb = (): SqliteDatabase => {
  databaseInstance ??= openDatabase(appConfig.dbPath);
  return databaseInstance;
};

export const closeDb = (): void => {
  if (databaseInstance) {
    databaseInstance.close();
    databaseInstance = null;
    logger.info('Closed SQLite database connection');
  }
};

export const withTransaction = <T>(database: SqliteDatabase, work: () => T): T => database.transaction(work)();
