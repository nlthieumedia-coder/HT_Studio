# PHASE 18 Performance Report

Date: 2026-09-19

All workloads used temporary SQLite databases, MockVideoProvider semantics, local files, and local Playwright profiles. No third-party provider load test was performed.

| Test | Jobs | Workers | Duration | Success | Failed | Jobs/min | Peak RSS | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 100 Job E2E | 100 | 1 | 24 ms | 100 | 0 | 278,312 | 174 MiB | Synthetic local pipeline |
| 500 Job E2E | 500 | 3 | 145 ms | 500 | 0 | 216,212 | 180 MiB | 500 outputs and attempts |
| 1,000 Job E2E | 1,000 | 5 | 295 ms | 1,000 | 0 | 210,722 | 192 MiB | No duplicate/lost jobs |
| 5,000 queue | 5,000 | 10 | 365 ms | 1,000 subset | 0 | 189,717 | 195 MiB | 4,000 intentionally preserved queued |
| 10,000 stored | 10,000 | 1 | 122 ms | 10,000 stored | 0 | n/a | 209 MiB | Bounded page of 200 |
| Queue race | 100 | 10 | <1 s | 100 unique | 0 | n/a | 210 MiB | Zero duplicate claim |
| Browser lifecycle | 10 cycles | 1 | <3 s | 10 | 0 | n/a | 209 MiB | Open registry returned to zero |
| Service restart | 50 cycles | 0 | 260 ms | 50 | 0 | n/a | 288 MiB | Health passed every cycle |
| Download stress | 100 | 1 | 2.52 s | 100 | 0 | n/a | 308 MiB | 100 unique outputs, zero `.part` |
| Log stress | 100,000 | 0 | 917 ms | 100,000 | 0 | n/a | 325 MiB | UI/repository page bounded to 200 |

Throughput values describe local synthetic SQLite/Mock work only and must not be interpreted as third-party service capacity. Default workers remains 1; synthetic results do not justify increasing provider concurrency.

## Findings

- Database: WAL and 5-second busy timeout confirmed. Migration 005 adds focused indexes for queue claim, project/status/scene, provider/status, account/status, logs, and worker heartbeat. Query plan uses `idx_jobs_queue_claim`.
- Queue: atomic conditional update yielded zero duplicate and zero lost jobs. Priority/FIFO ordering remains in the indexed claim query.
- Browser: exclusive profile lock allowed exactly one of ten owners; lifecycle registry returned to zero after every close.
- UI: jobs API schema caps pages at 200. The 10,000-job dataset returned bounded pages; no 10,000-row DOM or response is requested.
- Files: 100 local downloads completed atomically, produced unique paths/checksums, and left no partial files.
- Resource behavior: RSS increased while sequentially loading several large datasets and 100,000 logs, then remained bounded for the finite run. No MaxListeners warning, unhandled rejection, orphan browser, SQLite corruption, or lock storm occurred.
- Artifacts: JSON measurements are written to `data/test-results/`. QA databases are created under the OS temporary directory and deleted deterministically.

Machine-dependent latency/RSS values are warnings and observations. Duplicate execution, lost jobs, corruption, deadlock, and orphan accumulation are hard failures.
