# Disaster Recovery

## Application will not start

1. Copy the entire application data directory before manual changes.
2. Inspect logs and start the service. If corruption is detected it enters Recovery Mode automatically.
3. Export diagnostics; never send browser profiles or cookies.
4. Run Quick Check, then Full Integrity Check only when required.

## Database corruption

Preserve a timestamped corrupted copy in `data/recovery`. Use read-only inspection and restore the most recent verified backup. Recovery Mode deliberately prevents workers/browser automation from starting. Never attempt automatic in-place repair.

## Restore last backup

Verify checksums and compatibility, review counts, create the mandatory current-data safety backup, stop active work, then restore through staging. If switching fails, the service restores the `.pre-restore` database and staged directory rollbacks.

## Failed update or migration

Do not repeatedly launch an incompatible binary. Keep the pre-update/pre-migration snapshot. Reinstall the prior signed application build, verify its health, and restore the safety backup if migration did not complete. User data is outside Program Files and survives reinstall.

## Missing project paths

Use Missing Media Report. Create the destination folder or preview and commit a controlled old-prefix to new-prefix relink. Missing outputs or source media are warnings, not database corruption.

## Move to another PC

Create a verified Data backup on the old PC, copy it securely, install the same or newer compatible signed version, restore, relink paths, revalidate browser sessions, FFmpeg, storage, and workers. Use Full backup only when authenticated profiles must transfer and can be protected securely.
