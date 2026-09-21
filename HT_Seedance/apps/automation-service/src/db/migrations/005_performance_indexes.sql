CREATE INDEX IF NOT EXISTS idx_jobs_queue_claim ON jobs(status, priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_jobs_project_status_scene ON jobs(project_id, status, scene_number);
CREATE INDEX IF NOT EXISTS idx_jobs_provider_status ON jobs(provider, status);
CREATE INDEX IF NOT EXISTS idx_jobs_account_status ON jobs(account_id, status);
CREATE INDEX IF NOT EXISTS idx_logs_filter_page ON application_logs(level, module, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_workers_state_heartbeat ON workers(state, heartbeat_at);
