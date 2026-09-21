ALTER TABLE projects ADD COLUMN default_provider TEXT NOT NULL DEFAULT 'dola';
ALTER TABLE projects ADD COLUMN default_duration_seconds INTEGER NOT NULL DEFAULT 30;
ALTER TABLE projects ADD COLUMN default_aspect_ratio TEXT NOT NULL DEFAULT '9:16';
ALTER TABLE projects ADD COLUMN default_resolution TEXT NOT NULL DEFAULT '720p';
