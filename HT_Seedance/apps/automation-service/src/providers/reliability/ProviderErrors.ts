export const providerErrorCodes = [
  'SESSION_EXPIRED','LOGIN_REQUIRED','NAVIGATION_FAILED','PAGE_NOT_RECOGNIZED','FORM_CHANGED',
  'CONTROL_NOT_FOUND','AMBIGUOUS_CONTROL','MODEL_NOT_AVAILABLE','UPLOAD_CONTROL_MISSING',
  'UPLOAD_FAILED','PROMPT_CONTROL_MISSING','INVALID_PROVIDER_STATE','SUBMIT_CONTROL_MISSING',
  'SUBMIT_NOT_SAFE','SUBMIT_FAILED','SUBMISSION_STATE_UNKNOWN','GENERATION_STATE_UNKNOWN',
  'GENERATION_FAILED','GENERATION_TIMEOUT','RESULT_NOT_FOUND','DOWNLOAD_FAILED',
  'PROVIDER_UNAVAILABLE','BROWSER_CRASHED','UNKNOWN_PROVIDER_ERROR',
] as const;

export type ProviderErrorCode = (typeof providerErrorCodes)[number];

export class ProviderError extends Error {
  constructor(
    public readonly code: ProviderErrorCode,
    message: string,
    public readonly details: object = {},
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export const asProviderError = (error: unknown, fallback: ProviderErrorCode): ProviderError =>
  error instanceof ProviderError
    ? error
    : new ProviderError(fallback, error instanceof Error ? error.message : String(error));
