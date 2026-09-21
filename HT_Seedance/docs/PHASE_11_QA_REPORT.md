# PHASE 11 QA Report

Status: COMPLETE

Implemented job retry and crash recovery.

## Scope

- Added `RetryPolicy` with default max attempts of 3 and bounded exponential backoff.
- Retry is allowed only for classified transient failures:
  - navigation transient error
  - download transient error
  - browser crash
- Retry is blocked for login required, invalid input, unsupported form, explicit generation rejection, and unknown errors.
- Added startup crash recovery for unsafe active states:
  - `STARTING_BROWSER`
  - `PREPARING`
  - `SUBMITTING`
  - `GENERATING`
  - `DOWNLOADING`
  - `PROCESSING`
- Unsafe jobs are converted to `INTERRUPTED` and open attempts are closed as interrupted.
- Added recovery APIs for interrupted jobs:
  - inspect
  - retry
  - mark failed
  - cancel
  - attempt history
- Added desktop Interrupted Jobs page with inspect, retry, mark failed, and cancel actions.

## Safety

- Unknown generation states are never resubmitted automatically.
- Startup recovery stops at `INTERRUPTED` for operator review.
- Retry action only requeues jobs when `RetryPolicy` marks the error retryable and attempts remain.

## Validation

- Added recovery tests for startup recovery, retry classification/backoff, retry action, mark failed, and cancel.
- Required checks: `typecheck`, `lint`, `test`, `build`.
