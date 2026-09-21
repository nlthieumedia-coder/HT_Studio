# Backup and Recovery

HT Dola Studio creates versioned `.htbackup` directory packages. A package contains a SQLite backup-API snapshot, exported settings/project/account metadata, `manifest.json`, and SHA-256 checksums. Data backup is the default. Profiles, generated outputs, and logs are opt-in.

## Manual backup

Open **Settings > Backup & Recovery**, choose a writable destination, keep optional large items off unless needed, then select **Create Backup**. The service checks free space, takes a consistent WAL-aware snapshot, calculates checksums, verifies it, and only then records it as `COMPLETED`.

Browser profile backups may contain active authenticated sessions. They never contain passwords stored by this application, but must still be protected like credentials. A running profile cannot be copied. Outputs can be very large and are excluded by default.

Internal safe commands:

```powershell
pnpm backup:create -- D:\Backups
pnpm backup:verify -- D:\Backups\name.htbackup
pnpm restore:verify -- D:\Backups\name.htbackup
```

## Automatic backup

Enable it in Backup & Recovery, choose Daily, Every 3 Days, or Weekly, local time, destination, and retention (3/5/7/10/20; default 5). The hourly scheduler only checks whether the configured day/time is due. It keeps verified backups and never deletes the only valid copy.

## Restore

Select the package, verify, and inspect the preview. Newer unsupported schemas are blocked. Restore always creates a `PRE_RESTORE` safety backup, stages and migrates the database, runs SQLite and foreign-key checks, stops browsers, and swaps data with rollback protection. Profile/output directories are replaced as whole staged directories, never merged into running profiles.

After transfer to another PC: install the app, restore a Data backup, relink old media prefixes, validate sessions if profiles were excluded, validate FFmpeg, then run Health. Missing external media is reported but does not invalidate the database.

## Recovery mode

Startup performs `PRAGMA quick_check`. An unsafe database starts only the restricted Recovery server; queue, workers, normal routes, and browsers are not started. Preserve evidence under `data/recovery`, run the full integrity check, export diagnostics, and restore the last verified backup. Do not edit or delete the damaged database until recovery succeeds.

Backup packages are portable but may still contain machine-specific external media paths. Use controlled **Relink Base Folder** prefix replacement; arbitrary SQL replacement is intentionally unsupported.
