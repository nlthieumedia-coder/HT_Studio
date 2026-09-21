CREATE TABLE IF NOT EXISTS import_history (
 id TEXT PRIMARY KEY,
 project_id TEXT NOT NULL,
 source_type TEXT NOT NULL,
 source_name TEXT NOT NULL,
 total_rows INTEGER NOT NULL,
 imported_rows INTEGER NOT NULL,
 skipped_rows INTEGER NOT NULL,
 error_rows INTEGER NOT NULL,
 created_at TEXT NOT NULL,
 FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_import_history_project_id ON import_history(project_id);
