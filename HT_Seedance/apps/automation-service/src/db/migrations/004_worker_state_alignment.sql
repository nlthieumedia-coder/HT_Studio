DROP TABLE IF EXISTS workers_new;

CREATE TABLE workers_new (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('IDLE', 'STARTING', 'BUSY', 'WAITING', 'STOPPING', 'STOPPED', 'OFFLINE', 'ERROR')),
  account_id TEXT,
  job_id TEXT,
  heartbeat_at TEXT,
  started_at TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL
);

INSERT INTO workers_new (id,name,state,account_id,job_id,heartbeat_at,started_at,updated_at)
SELECT id,name,state,account_id,job_id,heartbeat_at,started_at,updated_at FROM workers;

DROP TABLE workers;
ALTER TABLE workers_new RENAME TO workers;
