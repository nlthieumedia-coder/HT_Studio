# HT_Dola_Studio Architectural Blueprint

## Phase 4 Import Engine

The Batch Import Engine runs entirely in the local automation service. Import adapters parse CSV, XLSX, TXT, and media folders into temporary in-memory sessions; React only drives the wizard and never parses source files or accesses SQLite. Validation, relative-path resolution, preview generation, idempotent commit, and one transaction for all Job records are implemented in `ImportService`.

HT_Dola_Studio is a local Windows desktop production manager designed for managing video-generation workflows through authorized browser sessions.

## 1. Directory & Monorepo Architecture

```
/
├─ apps/
│  ├─ desktop/                  # Tauri v2 + React UI shell (Front-end)
│  │  ├─ src/                   # React components, pages, design system integration
│  │  └─ src-tauri/             # Rust native app configuration & Tauri v2 runtime
│  │
│  └─ automation-service/       # Local Node.js + Fastify backend service
│     ├─ src/
│     │  ├─ api/                # Fastify REST endpoints & auth middleware
│     │  ├─ config/             # Dynamic app config & path resolver
│     │  ├─ db/                 # SQLite database & migrations
│     │  ├─ queue/              # In-memory job queue manager
│     │  ├─ workers/            # Automation worker pool
│     │  ├─ browser/            # Official Playwright Chromium browser manager
│     │  ├─ providers/          # Provider implementations (base & dola)
│     │  ├─ services/           # Business domain logic
│     │  ├─ logging/            # Pino structured log manager
│     │  └─ index.ts
│     └─ package.json
│
├─ packages/
│  ├─ shared/                   # Shared types, Zod schemas, JobState enum, VideoProvider contract
│  └─ ui/                       # Shared design system components (Button, Card, Badge, StatusIndicator)
│
├─ data/                        # Local storage directories
│  ├─ profiles/                 # Persistent Playwright browser profile storage
│  ├─ projects/                 # Project assets and workspace files
│  ├─ downloads/                # Output generation downloads & FFmpeg targets
│  ├─ logs/                     # Pino log files and auth token storage
│  └─ temp/                     # Temporary processing workspace
│
├─ docs/                        # Architecture & Phase documentation
├─ pnpm-workspace.yaml          # Monorepo workspace configuration
├─ package.json                 # Root script runner & dependencies
└─ tsconfig.base.json           # Shared strict TypeScript configuration
```

## 2. Process Control & Data Flow

The React frontend does **NOT** directly control Playwright or launch browser instances. Control flow follows a strict 3-tier isolated hierarchy:

```
┌──────────────────────────┐
│     Tauri React UI       │ (User Interface)
└────────────┬─────────────┘
             │ HTTP REST (127.0.0.1:3001) + Auth Header Token
             ▼
┌──────────────────────────┐
│ Local Automation Service │ (Fastify + SQLite Job Engine)
└────────────┬─────────────┘
             │ Worker Dispatch
             ▼
┌──────────────────────────┐
│      Browser Worker      │ (Official Playwright Chromium Instance)
└──────────────────────────┘
```

## 3. Security Boundaries & Architectural Constraints

1. **Strict Local Loopback Binding**: The local automation backend service binds **ONLY** to `127.0.0.1` and never `0.0.0.0`. It is never exposed externally to network interfaces.
2. **Local Authentication Token**: All non-health API endpoints require a runtime-generated token (`x-auth-token`) stored securely in local data storage (`data/logs/.auth_token`).
3. **CORS Isolation**: The service restricts CORS access exclusively to `tauri://localhost`, `http://localhost:*`, and `http://127.0.0.1:*`.
4. **Safety & Safeguard Compliance**: HT_Dola_Studio strictly omits CAPTCHA bypass, credential theft, automatic Google password storage, fingerprint spoofing, or stealth/anti-detection mechanisms.

The backend build copies versioned SQL migrations from `src/db/migrations` into `dist/db/migrations`; production startup applies any migration that is not yet recorded in `_migrations`.

## 4. Provider Architecture

All video generation engines implement the unified abstract `VideoProvider` contract defined in `@ht-dola/shared`:

```typescript
export interface VideoProvider {
  readonly id: string;
  readonly name: string;
  readonly version: string;

  initialize(profile: BrowserProfile): Promise<void>;
  validateSession(profile: BrowserProfile): Promise<ProviderSessionValidation>;
  prepareJob(job: Job, input: JobInput): Promise<void>;
  submit(job: Job, input: JobInput): Promise<ProviderJobSubmissionResult>;
  checkStatus(externalJobId: string): Promise<ProviderJobStatusResult>;
  downloadResult(externalJobId: string, targetPath: string): Promise<JobOutput>;
  cleanup(): Promise<void>;
}
```

In Phase 0, `DolaProvider` was established as a typed placeholder implementing `BaseProvider`. Actual Dola automation selectors remain deferred to a later automation phase; Phase 1 contains no browser automation.

## 5. Centralized Job State Model

State transitions are strictly managed using the centralized `JobState` enum:

- `DRAFT`: Job created, parameters being configured.
- `QUEUED`: Enqueued for background worker processing.
- `WAITING_FOR_WORKER`: Awaiting an idle worker in the pool.
- `STARTING_BROWSER`: Worker launching Chromium context.
- `PREPARING`: Navigation and asset staging.
- `SUBMITTING`: Prompt submission to provider interface.
- `GENERATING`: Provider backend rendering video.
- `DOWNLOADING`: Output video binary downloading to `data/downloads/`.
- `PROCESSING`: FFmpeg post-processing / transcoding.
- `COMPLETED`: Terminal success state.
- `FAILED`: Failure state (eligible for retry).
- `CANCELLED`: User-requested cancellation.
- `INTERRUPTED`: Application shutdown or crash recovery state.

## 6. Database Schema & Migrations

Database operations use `better-sqlite3` with foreign keys, Write-Ahead Logging (WAL), and a busy timeout enabled at `data/ht_dola_studio.db`. Versioned migrations are tracked in `schema_migrations`, copied into the compiled service, and applied transactionally before startup.

All SQL access is centralized under `apps/automation-service/src/db/repositories`. The API exposes validated Projects, Jobs, and Accounts endpoints; React communicates only through the typed HTTP client. See [DATABASE.md](./DATABASE.md) for tables, relationships, migration rules, and deletion policy.

## 7. Provider Reliability Pipeline (Phase 17)

Provider execution follows recognition, capability detection, form validation, safe action guard, submit, monitor, and result recognition. `ControlResolver` owns candidate resolution and refuses hidden, disabled, missing, or ambiguous critical controls. Dola page recognition assigns a logical screen and confidence; submission requires HIGH confidence.

`ProviderStateMachine` rejects illegal transitions. `SafeSubmitGuard` combines UI verification with worker ownership, active-attempt, and duplicate-submission checks. Monitoring/result recognition require positive evidence and submission identity prevents stale downloads.

The persistent circuit breaker uses CLOSED, OPEN, and HALF_OPEN. Structural failures are clustered and stop new scheduling after threshold, while account session failures remain isolated. Dashboard/API expose health, incidents, diagnostics, pause, and manual resume. See [PROVIDER_RELIABILITY.md](./PROVIDER_RELIABILITY.md).

## 8. Data Protection and Recovery (Phase 19)

`BackupService` owns consistent SQLite snapshots, portable manifest packages, SHA-256 verification, optional data collection, history, and retention. `RestoreService` verifies and migrates a staged database, requires a current-data safety backup, closes browser instances, and performs rollback-protected file/directory swaps. `MaintenanceLock` excludes backup, restore, migration, and update critical sections from queue mutations.

Startup performs a lightweight database quick check before any audit/database initialization. Failure starts only the restricted loopback Recovery server. Automatic backups use persisted settings and hourly due checks for daily-or-longer schedules. See [BACKUP_AND_RECOVERY.md](./BACKUP_AND_RECOVERY.md) and [UPDATE_SAFETY.md](./UPDATE_SAFETY.md).
