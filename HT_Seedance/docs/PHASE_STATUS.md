# Phase Status Tracker

## PHASE 0 = COMPLETE

### Completed Functionality Checklist

- [x] **Monorepo Architecture**: Configured `pnpm-workspace.yaml`, workspace packages (`apps/*`, `packages/*`), root `package.json`, and `tsconfig.base.json`.
- [x] **Shared Package (`@ht-dola/shared`)**: Created Zod schemas & TypeScript types for `Project`, `Job`, `JobInput`, `JobOutput`, `Account`, `BrowserProfile`, `Provider`, `Worker`, `JobAttempt`, `ApplicationSettings`, `LogEntry`.
- [x] **Centralized Job State Model**: Established `JobState` enum with all 13 required states (`DRAFT`, `QUEUED`, `WAITING_FOR_WORKER`, `STARTING_BROWSER`, `PREPARING`, `SUBMITTING`, `GENERATING`, `DOWNLOADING`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED`, `INTERRUPTED`).
- [x] **Provider Abstraction**: Defined `VideoProvider` contract and created `BaseProvider` & placeholder `DolaProvider`.
- [x] **Shared UI Package (`@ht-dola/ui`)**: Implemented base components (`Button`, `Card`, `Badge`, `StatusIndicator`).
- [x] **Local Automation Service (`apps/automation-service`)**:
  - Built Fastify HTTP backend listening strictly on `127.0.0.1:3001`.
  - Implemented `GET /health` (`{"status":"ok","service":"ht-dola-automation"}`) and `GET /api/system/info`.
  - Implemented local runtime authentication middleware (`x-auth-token`).
  - Integrated `better-sqlite3` with automated migration runner (`_migrations` tracking table & `001_initial_schema.sql`).
  - Integrated Pino logger with stdout and file logging (`data/logs/automation-service.log`).
  - Added graceful process shutdown handling (`SIGTERM` / `SIGINT`).
  - Configured central path resolution for local `data/` storage.
  - Setup official Playwright browser manager.
- [x] **Desktop Shell UI (`apps/desktop`)**:
  - Implemented Tauri v2 + React + TypeScript + Vite layout shell.
  - Added header with app title "HT Dola Studio" and local backend health status indicator.
  - Implemented left navigation bar with routes for `Dashboard`, `Projects`, `Jobs`, `Accounts`, `Outputs`, `Logs`, `Settings`.
  - Enforced architectural separation (React UI communicates with Fastify service over HTTP, never directly controlling Playwright).
- [x] **Quality Tooling & Scripts**:
  - Configured ESLint (`eslint.config.mjs`), Prettier (`.prettierrc`), TypeScript strict mode (`tsconfig.base.json`).
  - Root scripts established: `pnpm dev`, `pnpm dev:desktop`, `pnpm dev:service`, `pnpm build`, `pnpm typecheck`, `pnpm lint`.
- [x] **Data Directory Layout**: Formed `data/profiles`, `data/projects`, `data/downloads`, `data/logs`, `data/temp`.

---

## PHASE 1 — COMPLETE

### Desktop UI Foundation

- [x] **Application Shell**: Production-oriented desktop layout with a persistent collapsible sidebar, route-aware topbar, and compact application status bar.
- [x] **Routing**: Dashboard, projects, project detail, jobs, accounts, outputs, logs, settings, root redirect, and 404 routes.
- [x] **Dashboard**: Compact production statistics, queue overview, worker status, recent jobs, and recent error panels.
- [x] **Projects UI**: Search, status and sort controls, sortable/selectable table, progress summaries, and action placeholders.
- [x] **Project Detail UI**: Header, project statistics, scene/job table, output area, and future project-settings area.
- [x] **Jobs UI**: Search and domain filters with the centralized `JobState` enum from `@ht-dola/shared`.
- [x] **Accounts UI**: Account and browser-profile manager with session and worker status presentation. No credentials are collected or stored.
- [x] **Outputs UI**: Searchable output library and native file-action placeholders.
- [x] **Logs UI**: Search, level/module filters, auto-scroll preference, non-destructive Clear View, and restrained level styling.
- [x] **Settings UI**: General, browser, workers, downloads, FFmpeg, storage, and advanced/system sections using centralized path and system services.
- [x] **Backend Health Integration**: `GET /health` polling every 15 seconds with `CONNECTING`, `ONLINE`, and `OFFLINE` states. Backend failures never crash the interface.
- [x] **System Information**: Settings > Advanced & System consumes `GET /api/system/info` when an authenticated API client is available and degrades to a non-blocking unavailable state otherwise. Secure runtime-token bootstrap remains part of the future desktop/service integration.
- [x] **Reusable UI Components**: Page headers, cards, statistics, tables, status badges, progress bars, filters, states, forms, modal/confirmation primitives, and toast notifications.
- [x] **Theme System**: Dark, light, and system themes with local persistence. Dark mode remains the primary visual treatment.
- [x] **Service Architecture**: Typed API client and domain services with centralized development fixtures for endpoints deferred to later phases.
- [x] **Resilience & Accessibility**: Application error boundary, loading/empty/error states, semantic controls, keyboard focus, and reduced-motion support.

### Deliberate Phase 1 Placeholders

- Project, job, account, output, log, and settings persistence awaits the Phase 2 repository layer.
- Project rename/archive/delete, account profile/session actions, native output file actions, FFmpeg installation testing, startup/tray integration, and notifications/help menus are presentation-only.
- Browser execution, provider selectors, session automation, worker execution, generation, downloads, FFmpeg processing, and all excluded anti-detection capabilities remain unimplemented.

---

## PHASE 2 — COMPLETE

- [x] `better-sqlite3` initialization with foreign keys, WAL, and busy timeout.
- [x] Transactional migrations and legacy Phase 0 schema upgrade.
- [x] Repositories for all nine persisted domains with prepared statements and safe transactions.
- [x] Shared Zod validation and paginated Projects, Jobs, and Accounts APIs.
- [x] Functional frontend project and local-account metadata operations through the centralized API client.
- [x] Explicit migrate/status/seed commands; production data is never seeded automatically.
- [x] Automated migration, repository, foreign-key, bulk transaction, and API tests on `:memory:` databases.
- [x] Persistence verified across a backend restart.

Browser execution, login automation, provider selectors, generation, downloading, and media processing remain intentionally deferred.

---

## Environment Notes

- Node.js runtime: v24.19.0
- Package manager: pnpm (via npx)
- Rust toolchain (`cargo`): Not installed on host machine; Tauri v2 files and configuration are fully established, and frontend builds via `pnpm build` / Vite. Rust compilation will execute when `cargo` is installed.

---

## Next Recommended Action

**PHASE 3 — Project Management + Job Creation**


## PHASE 3 - COMPLETE

Project defaults, SQLite migration, Project/Job business services, validated API endpoints, scene workspace UI, bulk actions, queue state operations, duplication, reorder, and renumbering are complete. Phase 4 browser automation has not started.

## PHASE 4 - COMPLETE

Batch Import Engine supports CSV, XLSX, TXT, and folder matching through temporary sessions, validated previews, strict/lenient policy, transactional creation, duplicate-commit protection, import history, and CSV export. No browser automation was added.

## PHASE 6 - COMPLETE

Generic browser worker pool adds bounded workers (1-10), transactional job claiming, account/profile concurrency protection, heartbeat recovery to `INTERRUPTED`, graceful/force stop APIs, and dashboard worker data. Provider selectors remain deferred.

## PHASE 8 - COMPLETE

Dola form preparation dynamically detects supported controls, validates media paths, selects configured model aliases, verifies prompt entry, and returns a typed readiness result. Automatic generation submission remains intentionally disabled.

## PHASE 9 - COMPLETE

Generation submission uses one normal UI action only after preparation, persists submission lifecycle metadata, monitors observable UI state with a timeout, and safely interrupts in-flight jobs after restart.

## PHASE 15 - COMPLETE

Windows production packaging is configured with Tauri v2 NSIS output, packaged automation-service resources, bundled Node runtime, AppData production storage, Playwright Chromium install/check strategy, Windows build documentation, and release checklist.

## PHASE 16 - RC QA COMPLETE / RELEASE NOT APPROVED

Release-candidate QA for `1.0.0-rc1` has been executed through dependency install, typecheck, lint, automated tests, production build, backend startup smoke, database migration audit, sidecar packaging, security grep, and mock-provider stress/recovery tests.

Code validation passed with 0 P0 and 0 P1 issues. Windows installer creation remains blocked on this host because Rust/Cargo is not installed, so final installer smoke testing is not complete.

Final RC result: `PHASE 16 RC QA = FAIL`.

See:

- `docs/PHASE_16_RC_QA_REPORT.md`
- `docs/KNOWN_ISSUES.md`

## PHASE 17 — COMPLETE

Provider automation now fails safely using centralized selectors, typed control resolution, page recognition/confidence, capability/configuration verification, guarded one-click submission, positive-evidence monitoring, stale-result protection, sanitized bounded diagnostics, persistent circuit breaking, incident clustering, local health metrics, account isolation, and provider pause/manual resume UI/API.

Local fixtures, provider contract checks, Phase 16 Mock regression, form-change avalanche prevention, and circuit restart recovery pass. Live Dola testing was skipped because no authorized session was used, as allowed by policy. See `docs/PHASE_17_QA_REPORT.md`.

## PHASE 18 — COMPLETE

Temporary-database performance QA now covers 100/500/1,000-job Mock execution, 5,000-job queue behavior, 10,000 stored jobs, queue/profile races, bounded retry and provider incidents, WAL/query plans, crash recovery, browser and service lifecycle, 100 local downloads, and 100,000 logs. Metrics are stored locally under `data/test-results`; reusable performance and configurable soak commands are available.

No duplicate/lost jobs, browser registry orphans, corruption, persistent lock storm, P0, or P1 finding remained. See `docs/PHASE_18_PERFORMANCE_REPORT.md`, `docs/RESOURCE_LEAK_AUDIT.md`, and `docs/PHASE_18_QA_REPORT.md`.

## PHASE 19 — COMPLETE

Versioned and verified backup packages now protect SQLite WAL state, settings, metadata, and optional profiles/outputs/logs. Manual and scheduled backups, retention, history, free-space checks, staging restore with safety backup and rollback, schema compatibility, controlled path relinking, startup corruption detection, restricted Recovery Mode, maintenance locking, pre-update and pre-migration safety paths, UI/API/CLI, and recovery/update documentation are implemented.

The complete regression suite and Phase 18 critical performance suite pass with no P0/P1 finding. See `docs/PHASE_19_QA_REPORT.md`, `docs/BACKUP_AND_RECOVERY.md`, `docs/DISASTER_RECOVERY.md`, and `docs/UPDATE_SAFETY.md`.

## PHASE 20 — COMPLETE

HT Dola Studio 1.0.0 passed the release gate with no P0/P1 findings. Static QA, automated regression, representative performance/Mock E2E, data safety, security, and Windows x64 NSIS packaging passed.

Release status after Phase 20.1: `READY` for INTERNAL / PRIVATE release. The 30-minute Mock soak passed 195 cycles with no duplicate, lost job, orphan, or failed cycle. Unsigned packaging, clean-VM lifecycle, authorized live Dola smoke and optional 2–6 hour qualification remain explicitly non-blocking P3 limitations. This status does not approve public distribution. See `docs/PHASE_20_1_GATE_CLOSURE_REPORT.md` and `docs/RELEASE_POLICY.md`.

## PHASE 21 — COMPLETE

ProductionRun persistence (schema 7), typed preflight, Pilot Mode, controlled start/pause/stop, provider/account incident handling, stuck detection, safe restart recovery, validated outputs, run history/monitoring, manifest/failed CSV and sanitized support bundles are implemented. Mock pilots for 10/25/50/100 jobs and the full 59-test/static/build gate pass with no P0/P1. Authorized live smoke remains operator-triggered and deferred. See `docs/PHASE_21_QA_REPORT.md` and `docs/PRODUCTION_PILOT_RUNBOOK.md`.
