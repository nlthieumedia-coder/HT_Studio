import type { JobRecord } from '../db/types.js';

export type RetryErrorCode =
  | 'NAVIGATION_TRANSIENT'
  | 'DOWNLOAD_TRANSIENT'
  | 'BROWSER_CRASH'
  | 'NAVIGATION_FAILED'
  | 'DOWNLOAD_FAILED'
  | 'BROWSER_CRASHED'
  | 'SESSION_EXPIRED'
  | 'LOGIN_REQUIRED'
  | 'INVALID_INPUT'
  | 'UNSUPPORTED_FORM'
  | 'GENERATION_REJECTED'
  | 'UNKNOWN';

export interface RetryDecision {
  retryable: boolean;
  attemptsRemaining: number;
  nextAttemptAt: string | null;
  delayMs: number;
  reason: string;
}

const retryableErrors = new Set<RetryErrorCode>([
  'NAVIGATION_TRANSIENT',
  'DOWNLOAD_TRANSIENT',
  'BROWSER_CRASH',
  'NAVIGATION_FAILED',
  'DOWNLOAD_FAILED',
  'BROWSER_CRASHED',
]);

const normalize = (code?: string | null): RetryErrorCode => {
  const value = String(code ?? 'UNKNOWN').toUpperCase();
  if (value.includes('NAVIGATION') && value.includes('TRANSIENT')) return 'NAVIGATION_TRANSIENT';
  if (value.includes('DOWNLOAD') && value.includes('TRANSIENT')) return 'DOWNLOAD_TRANSIENT';
  if (value.includes('BROWSER') && value.includes('CRASH')) return 'BROWSER_CRASH';
  if (value === 'NAVIGATION_FAILED') return 'NAVIGATION_FAILED';
  if (value === 'DOWNLOAD_FAILED') return 'DOWNLOAD_FAILED';
  if (value === 'SESSION_EXPIRED' || value === 'LOGIN_REQUIRED') return 'LOGIN_REQUIRED';
  if (value === 'INVALID_INPUT') return 'INVALID_INPUT';
  if (value === 'UNSUPPORTED_FORM' || value === 'FORM_CHANGED') return 'UNSUPPORTED_FORM';
  if (value === 'GENERATION_REJECTED' || value === 'GENERATION_FAILED') return 'GENERATION_REJECTED';
  return 'UNKNOWN';
};

export class RetryPolicy {
  constructor(
    private readonly defaultMaxAttempts = 3,
    private readonly baseDelayMs = 1000,
    private readonly maxDelayMs = 60_000,
  ) {}

  decide(job: JobRecord, errorCode?: string | null): RetryDecision {
    const code = normalize(errorCode ?? job.errorCode);
    const maxAttempts = job.maxAttempts || this.defaultMaxAttempts;
    const attemptsRemaining = Math.max(0, maxAttempts - job.attemptCount);
    if (!retryableErrors.has(code))
      return {
        retryable: false,
        attemptsRemaining,
        nextAttemptAt: null,
        delayMs: 0,
        reason: `Error ${code} is not retryable.`,
      };
    if (attemptsRemaining <= 0)
      return {
        retryable: false,
        attemptsRemaining,
        nextAttemptAt: null,
        delayMs: 0,
        reason: 'Maximum attempts reached.',
      };
    const delayMs = Math.min(this.maxDelayMs, this.baseDelayMs * 2 ** Math.max(0, job.attemptCount));
    return {
      retryable: true,
      attemptsRemaining,
      delayMs,
      nextAttemptAt: new Date(Date.now() + delayMs).toISOString(),
      reason: `Retry scheduled after ${delayMs}ms.`,
    };
  }
}
