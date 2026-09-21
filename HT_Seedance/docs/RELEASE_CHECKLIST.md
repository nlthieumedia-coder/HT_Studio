# Release Checklist — 1.0.0

- [x] Version 1.0.0
- [x] Typecheck PASS
- [x] Lint PASS
- [x] Tests PASS
- [x] Build PASS
- [x] Database PASS
- [x] Migration PASS (schema 6)
- [x] Backup PASS
- [x] Restore PASS
- [x] Queue PASS
- [x] Workers PASS
- [x] Browser lifecycle PASS
- [x] Mock E2E PASS
- [x] Provider safe-failure PASS
- [x] Crash recovery PASS
- [x] Installer PASS
- [x] Upgrade safety PASS (automated); clean-VM smoke PARTIAL
- [x] Security PASS
- [x] No P0
- [x] No P1

## Packaging

- [x] NSIS Windows x64 installer exists.
- [x] Packaged Node runtime exists.
- [x] Packaged automation-service entry exists.
- [x] Writable data resolves under `%APPDATA%\HT_Dola_Studio`.
- [x] Release manifest and SHA-256 generated.
- [x] Internal/private unsigned policy documented; SHA-256 and controlled provenance verified (accepted P3).
- [x] Missing clean VM classified `DEFERRED_NON_BLOCKING`; reproducible lifecycle script/checklist provided (P3).
- [x] Mandatory 30-minute Mock soak PASS — 195 cycles, 0 duplicate/lost/orphan/failure.
- [ ] Separate clean-VM install/upgrade/uninstall smoke test (required before public distribution).
