# Release Policy

## Release classification

HT Dola Studio 1.0.0 is an **INTERNAL / PRIVATE RELEASE**. Distribution is limited to controlled operators who receive the installer and checksum through an approved internal channel. It is not approved for public, anonymous distribution.

## Internal readiness

An internal release may be `READY` when all P0/P1 findings are closed; static QA, tests, build, data integrity, Mock E2E, provider fail-safe, backup/restore, security, installer and checksum validation pass; and every environment-dependent limitation is explicitly non-blocking.

An unsigned installer is accepted for internal use when its origin is controlled, its SHA-256 matches both the release manifest and `SHA256SUMS.txt`, and operators are warned about SmartScreen. It must remain labeled unsigned.

A missing clean Windows VM may be `DEFERRED_NON_BLOCKING` when packaged resources, installer metadata/checksum, path handling and production build checks pass and a reproducible lifecycle checklist is supplied. It is not represented as a passed clean install.

Live-provider validation may be deferred for an internal release when no authorized session is available. Local fixtures and MockVideoProvider remain mandatory; bulk/stress testing must not target Dola.

## Public distribution readiness

Public distribution requires separate approval and, by default:

- an authentic trusted Windows code-signing certificate and verified signature;
- clean Windows install, first-launch, restart, upgrade, uninstall and reinstall validation;
- review of public distribution/support channels and release provenance;
- resolution or explicit release-owner acceptance of remaining P2/P3 limitations.

Internal `READY` does not imply public-distribution approval.

## Reproducible lifecycle validation

Run the non-destructive artifact/path preflight:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/test-windows-release-lifecycle.ps1
```

On a clean Windows x64 VM, snapshot the VM, install the verified artifact, launch it, check the local service/database/AppData/system health, create a test project and Mock job, close and restart. Upgrade from the prior RC, then run SQLite `quick_check` and `foreign_key_check`. Uninstall and confirm binaries are removed while valuable AppData remains; reinstall and verify the retained data is recognized.

## Soak commands

```powershell
pnpm test:soak -- --duration=30m
pnpm test:soak -- --duration=2h
pnpm test:soak -- --duration=6h
```

The two-hour and six-hour runs are scheduled operational qualifications, not requirements for every ordinary build.
