# Update Safety

Production updates must use the signed Tauri updater architecture. A future update manifest must carry version, release date, trusted download source, SHA-256, signature metadata, and minimum supported version. Unsigned update binaries must never be downloaded or executed silently.

Required flow: verify signed update metadata and payload; wait for active jobs or cancel the update; acquire Maintenance Lock; create and verify a `PRE_UPDATE` backup; stop queue/workers/browsers; install; restart; create a pre-migration snapshot when migrations are pending; run transactional migrations; run database/application health checks; record success.

If backup, signature verification, migration, or post-update health fails, stop. Preserve the safety package and migration evidence. Binary rollback must not remove the application-data directory. Database rollback uses a verified compatible backup, never a blind downgrade. Only one backup/restore/migration/update maintenance operation may run at once; stale locks are reported for inspection.
