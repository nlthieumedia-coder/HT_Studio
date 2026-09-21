# Database Architecture

HT Dola Studio uses a local SQLite database through `better-sqlite3`. React never accesses SQLite directly; HTTP routes call repositories in the automation service.

## Location and initialization

- Development: `data/ht_dola_studio.db`
- Production-ready resolver: `%APPDATA%/HT_Dola_Studio/data/ht_dola_studio.db`
- Override: `HT_DOLA_DATA_DIR`

Initialization creates the parent directory, enables foreign keys and WAL mode, sets a 5-second busy timeout, and applies missing migrations before the service listens.

## Tables

- `projects`: project metadata, lifecycle, and output-directory preference.
- `browser_profiles`: profile directory references and browser state; cookies are not stored in SQLite.
- `accounts`: local provider metadata and session status; credentials are never stored.
- `jobs`: scene inputs, centralized `JobState`, progress, attempts, errors, and timestamps.
- `job_attempts`: a separate history row for every execution attempt.
- `outputs`: generated-file metadata only; media binaries remain on disk.
- `workers`: future worker-pool state without executing workers in Phase 2.
- `settings`: typed JSON values accessed only through `SettingsRepository`.
- `application_logs`: searchable structured application events without secrets.
- `schema_migrations`: deterministic migration history.
- `import_history`: lightweight audit records for completed import sessions; source contents remain temporary and are never stored in the jobs table before commit.
- `backups`: backup package history, type, application/schema version, size, lifecycle state, verification timestamp, and non-sensitive notes.

## Relationships and deletion policy

- Projects with jobs cannot be deleted (`RESTRICT`); they should be archived.
- Removing an account or browser profile sets nullable references to `NULL`.
- Jobs with attempts or outputs cannot be deleted automatically.
- Deleting database records never deletes generated media files.
- Log references use `SET NULL` so operational history can remain.

## Migrations

Ordered SQL files live in `apps/automation-service/src/db/migrations` and are copied into `dist` during build. Each unapplied migration runs in a transaction and is recorded only after success. The Phase 2 runner also upgrades the empty/legacy Phase 0 schema while preserving compatible records.

Before upgrading an existing schema, the runner creates a SQLite `VACUUM INTO` snapshot under `data/recovery`. Phase 19 backup creation uses SQLite's backup API rather than copying a live WAL database file. Restore migrates and validates a staged database before switching the active file.

Commands:

```text
pnpm db:migrate
pnpm db:status
pnpm db:seed
```

The development seed is explicit and refuses to run when projects already exist. Production startup never seeds data automatically.

## Repository layer

All SQL is isolated under `apps/automation-service/src/db/repositories`. Repositories use prepared statements, bounded pagination, explicit update-field allowlists, and `better-sqlite3` transactions for multi-row writes such as bulk job creation.
