CREATE TABLE backups (
  id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL UNIQUE,
  backup_type TEXT NOT NULL CHECK (backup_type IN ('DATA','FULL','PRE_UPDATE','PRE_RESTORE','PRE_MIGRATION')),
  app_version TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('CREATING','VERIFYING','COMPLETED','FAILED','CORRUPTED')),
  created_at TEXT NOT NULL,
  verified_at TEXT,
  notes TEXT
);
CREATE INDEX idx_backups_created_at ON backups(created_at DESC);
CREATE INDEX idx_backups_status ON backups(status, created_at DESC);
