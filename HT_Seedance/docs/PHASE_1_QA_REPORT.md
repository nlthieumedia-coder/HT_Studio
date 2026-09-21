# Phase 1 QA Report

Date: 2026-09-19

## Environment

- OS: Windows 10.0.26200 x86_64
- Node.js: v24.19.0
- pnpm: 9.15.0
- WebView2: 153.0.4234.32
- Rust: Not installed
- Cargo: Not installed
- MSVC/Windows SDK: Not detected by the Tauri CLI

## Results

| Check | Result | Notes |
| --- | --- | --- |
| Dependency Check | PASS | `pnpm install --frozen-lockfile`; workspace links and lockfile are valid. |
| Typecheck | PASS | All four script-bearing workspace packages pass strict TypeScript validation. |
| Lint | PASS | No ESLint errors or warnings were reported. |
| Tests | NOT AVAILABLE | The repository does not define a test script or test suite. |
| Frontend Build | PASS | Vite production build completed with 1,624 modules transformed. |
| Frontend Startup | PASS | Vite served the SPA on port 1420; known and unknown routes returned the application entry point. |
| Backend Startup | PASS | Production and development scripts start the Fastify service on `127.0.0.1:3001`. |
| Health Endpoint | PASS | `GET /health` returned `status: ok` and `service: ht-dola-automation`. |
| System Info Endpoint | PASS | Unauthenticated access returned 401; authenticated access returned valid runtime JSON. |
| Database Migration Packaging | PASS | SQL migrations are copied into `dist` and were successfully applied to a clean QA database. |
| Routing Audit | PASS | Dashboard, projects, project detail, jobs, accounts, outputs, logs, settings, root redirect, and not-found routes are present. |
| Sidebar Audit | PASS | Navigation, active state, persisted collapse state, collapsed tooltips, version, and backend status are present. |
| UI Architecture | PASS | Major pages use typed services, centralized fixtures, reusable tables, and reusable loading/empty/error states. |
| Theme Audit | PASS | Dark, light, and system modes use shared CSS tokens and persist a validated preference. |
| Health Polling | PASS | Centralized health service polls every 15 seconds, cleans up its timer, handles offline state, and can recover. |
| Accessibility Audit | PASS | Semantic controls, labels, keyboard focus, navigation landmarks, icon labels, and reduced-motion behavior are present. |
| Security Audit | PASS | Loopback-only binding, authenticated non-health endpoints, strict loopback CORS, and no committed credentials or unsafe automation fields. |
| Tauri Native Build | NOT RUN | Blocked by missing Rust/Cargo and MSVC Build Tools; web frontend validation is clean. |

## Issues Found

### 1. Runtime authentication token exposed in startup logs

- Severity: High
- File: `apps/automation-service/src/api/server.ts`
- Issue: The service logged `appConfig.authToken` as structured startup metadata.
- Fix applied: Removed the token from all startup logging while preserving host, port, and address diagnostics.

### 2. CORS origin validation accepted substring matches

- Severity: High
- File: `apps/automation-service/src/api/server.ts`
- Issue: `origin.includes('localhost')` and `origin.includes('127.0.0.1')` could accept attacker-controlled hostnames containing those strings.
- Fix applied: Parse origins with `URL` and require an exact `localhost` or `127.0.0.1` hostname with an allowed HTTP/Tauri scheme. Smoke tests confirmed that a valid loopback origin receives a CORS header and `localhost.evil.example` does not.

### 3. Production build omitted SQLite migrations

- Severity: High
- Files: `apps/automation-service/package.json`, `apps/automation-service/scripts/copy-static.mjs`
- Issue: TypeScript compilation did not copy `src/db/migrations` to `dist`, causing built service startup to skip migrations.
- Fix applied: Added a cross-platform static asset copy step to the backend build. A clean QA database recorded `001_initial_schema.sql` successfully.

### 4. Backend development script did not start on Windows

- Severity: Medium
- Files: `apps/automation-service/package.json`, `apps/automation-service/scripts/dev.mjs`
- Issue: The shell expression `tsc -w & node --watch dist/index.js` blocked at the TypeScript watcher on Windows.
- Fix applied: Added a dependency-free Node development coordinator that performs an initial build and starts both watchers concurrently. `pnpm dev:service` was smoke-tested successfully.

### 5. Tauri JavaScript/Rust package versions were mismatched

- Severity: Medium
- Files: `apps/desktop/package.json`, `apps/desktop/src-tauri/Cargo.toml`, `pnpm-lock.yaml`
- Issue: Tauri CLI reported Rust 2.0 declarations against JavaScript Tauri 2.11 and opener 2.5 packages.
- Fix applied: Aligned manifest minor versions with the installed JavaScript packages. Tauri CLI no longer reports a version mismatch.

### 6. Tauri bundle referenced nonexistent icon assets

- Severity: Medium
- File: `apps/desktop/src-tauri/tauri.conf.json`
- Issue: Bundle configuration listed five files under an absent `icons` directory.
- Fix applied: Removed the invalid icon list. Branded native icons can be added later as real assets without blocking configuration validation.

### 7. Required project/account placeholder actions were hidden behind ambiguous controls

- Severity: Low
- Files: `apps/desktop/src/pages/Projects.tsx`, `apps/desktop/src/pages/Accounts.tsx`, `apps/desktop/src/index.css`
- Issue: Rename, archive, delete, disable, and remove actions existed only as tooltip descriptions.
- Fix applied: Added explicit accessible placeholder buttons with non-destructive toast feedback.

### 8. Persisted theme value was not validated

- Severity: Low
- File: `apps/desktop/src/context/AppContext.tsx`
- Issue: An arbitrary local-storage value could be cast to `ThemePreference`.
- Fix applied: Validate stored values against dark, light, and system; invalid values now fall back to system.

### 9. Collapsed backend status lacked an accessible text alternative

- Severity: Low
- File: `apps/desktop/src/components/ui.tsx`
- Issue: The collapsed sidebar intentionally hid badge text but did not expose status through an accessible label or tooltip.
- Fix applied: Added the status as `aria-label` and `title` when visible text is suppressed.

### 10. Generated JavaScript/declaration artifacts were stored beside shared TypeScript sources

- Severity: Low
- Directory: `packages/shared/src`
- Issue: Compiled `.js`, `.d.ts`, and source-map files duplicated the TypeScript source tree and could become stale.
- Fix applied: Removed generated artifacts from `src`; build output remains isolated under `dist`.

## Remaining Warnings

- No automated test suite exists, so behavior beyond static validation and smoke tests has no repeatable unit/integration coverage yet.
- Tauri CSP remains unset. The current UI loads only local packaged assets and a loopback API, but a restrictive production CSP should be established before distribution.
- The frontend API client supports an authentication token, but secure Tauri-to-service runtime token bootstrap is not implemented yet. Authenticated system info therefore degrades safely in the browser-only frontend until desktop process integration is added.
- Installation reports deprecated `eslint@9.39.5`, `@types/sqlite3@5.1.0`, and one transitive `prebuild-install` package. They do not cause current validation failures; major dependency upgrades were intentionally avoided during this audit.
- Tauri reports a newer patch of the Rust `tauri` crate, but the aligned 2.11.1 declaration is compatible and was not upgraded without a native toolchain validation path.

## Environment Limitations

- Rust, Cargo, rustup, and Visual Studio C++ Build Tools/Windows SDK are not installed. Native Tauri compilation and bundling could not be executed.
- Vite/React/TypeScript production build, frontend startup, Tauri configuration inspection, and backend runtime validation were completed independently of that external limitation.
- Test processes had to be terminated externally by the QA harness on Windows; source code graceful shutdown handlers were inspected, but OS signal behavior could not be fully exercised through the harness.

## Final Decision

**PHASE 1 QA = PASS**

Phase 1 meets the stated pass criteria. The recommended next phase is **PHASE 2 — SQLite Database + Repository Layer**; it was not started during this audit.
