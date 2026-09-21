# Windows Build Guide

This project produces a Tauri v2 Windows installer for HT_Dola_Studio.

## Prerequisites

- Windows 10/11 x64
- Node.js 20+ for the build machine
- pnpm 9+
- Rust stable toolchain with Cargo in `PATH`
- Tauri Windows build dependencies, including Microsoft C++ Build Tools

End users do not need Node.js. The production package includes a local Node runtime used only to run the packaged automation service.

## Development build

From the repository root:

```powershell
pnpm install
pnpm dev
```

Development mode runs Vite and the automation service from the workspace. Data is stored in:

```text
data/
```

## Production sidecar preparation

The production package embeds:

- `apps/desktop/src-tauri/resources/node/node.exe`
- `apps/desktop/src-tauri/resources/automation-service/`

Prepare these resources manually with:

```powershell
pnpm prepare:windows-sidecar
```

The script builds `@ht-dola/automation-service`, deploys production dependencies, and copies the build-machine Node runtime into Tauri resources.

## Production build and installer

Run:

```powershell
pnpm build:windows
```

Tauri runs the frontend build and sidecar preparation automatically through `beforeBuildCommand`, then produces an NSIS installer.

Expected output directory:

```text
apps/desktop/src-tauri/target/release/bundle/nsis/
```

## Production data location

Writable production data is stored outside Program Files:

```text
%APPDATA%\HT_Dola_Studio\data\
```

Preserved across upgrades:

- database: `%APPDATA%\HT_Dola_Studio\data\ht_dola_studio.db`
- projects: `%APPDATA%\HT_Dola_Studio\data\projects\`
- profiles: `%APPDATA%\HT_Dola_Studio\data\profiles\`
- downloads: `%APPDATA%\HT_Dola_Studio\data\downloads\`
- settings and logs under `%APPDATA%\HT_Dola_Studio\data\`

## Logs

Automation logs live in:

```text
%APPDATA%\HT_Dola_Studio\data\logs\
```

Diagnostic exports are written to the same logs directory and intentionally exclude browser profiles, cookies, auth tokens, passwords, and browser storage.

## Playwright browser location

Production Chromium is managed with:

```text
PLAYWRIGHT_BROWSERS_PATH=%APPDATA%\HT_Dola_Studio\browsers
```

On production startup, the packaged automation service checks this location and installs official Playwright Chromium if missing. It does not rely on developer `node_modules` browser caches.

## Local service lifecycle

In release builds, Tauri starts the packaged automation service automatically using the bundled Node runtime and stops it when the desktop app exits.

Service URL:

```text
http://127.0.0.1:3001
```

The service remains local-only and stores its auth token under the production data logs directory.
