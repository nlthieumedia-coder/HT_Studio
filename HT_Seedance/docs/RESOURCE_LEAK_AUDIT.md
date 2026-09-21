# Resource Leak Audit

## Memory

RSS grew from approximately 174 MiB to a peak near 325 MiB during one process that sequentially created 100, 500, 1,000, 5,000, and 10,000-job datasets, 100 downloads, 50 server instances, and 100,000 logs. Temporary databases and directories were closed/deleted each time. No invariant indicated retained jobs, workers, browser contexts, or downloads. Extended soak scripts remain available for machine-specific trend analysis.

## Timers and event listeners

Provider monitoring uses awaited bounded polling and owns no persistent interval. React health polling returns cleanup functions. Browser download listeners are scoped through `waitForEvent`. No `MaxListenersExceededWarning` occurred during 50 service lifecycle cycles.

## Chromium

Ten local persistent-context launch/close cycles completed. BrowserManager open count returned to zero, profile locks were removed, and ten-way lock contention admitted exactly one owner. Stale PID lock cleanup remains enabled.

## FFmpeg and child processes

FFprobe/FFmpeg checks use synchronous bounded child processes and do not use detached execution. The only deliberately detached processes are OS file-manager actions initiated by the user. Tauri sidecar shutdown closes HTTP, browser contexts, and SQLite in sequence.

## Database and file handles

WAL, foreign keys, busy timeout, short synchronous transactions, and migration tracking were verified. No transaction spans browser/network/filesystem waits. All QA database handles close before recursive temp cleanup.

## Logs and diagnostics

File logs rotate by size/count. UI and repository log reads are paginated. Provider diagnostics are capped by count/age and sanitize sensitive values. User outputs are outside diagnostic retention.

## Promises and shutdown

Critical lifecycle operations are awaited. Recovery converts active unsafe states to INTERRUPTED and never blindly resubmits. Fifty create/health/close service cycles completed without port or listener leakage.
