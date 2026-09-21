CREATE TABLE production_runs (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL, status TEXT NOT NULL, started_at TEXT, ended_at TEXT,
  worker_count INTEGER NOT NULL, total_jobs INTEGER NOT NULL DEFAULT 0,
  completed_jobs INTEGER NOT NULL DEFAULT 0, failed_jobs INTEGER NOT NULL DEFAULT 0,
  interrupted_jobs INTEGER NOT NULL DEFAULT 0, settings_snapshot_json TEXT NOT NULL DEFAULT '{}',
  notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE production_run_jobs (
  production_run_id TEXT NOT NULL REFERENCES production_runs(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT, worker_id TEXT, account_id TEXT,
  initial_status TEXT NOT NULL, error_category TEXT, retry_group TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY (production_run_id, job_id)
);
CREATE TABLE production_run_events (
  id TEXT PRIMARY KEY, production_run_id TEXT NOT NULL REFERENCES production_runs(id) ON DELETE CASCADE,
  event TEXT NOT NULL, message TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
);
CREATE INDEX idx_production_runs_status ON production_runs(status, updated_at);
CREATE INDEX idx_production_run_jobs_job ON production_run_jobs(job_id);
CREATE INDEX idx_production_run_events_run ON production_run_events(production_run_id, created_at);
