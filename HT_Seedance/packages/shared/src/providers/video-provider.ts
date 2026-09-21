import { Job, JobInput, JobOutput, BrowserProfile } from '../schemas/models.js';
import { JobState } from '../enums/job-state.js';

export interface ProviderSessionValidation {
  isValid: boolean;
  userEmail?: string;
  authError?: string;
  quotaRemaining?: number;
}

export interface ProviderJobSubmissionResult {
  externalJobId: string;
  initialState: JobState;
  metadata?: Record<string, unknown>;
}

export interface ProviderJobStatusResult {
  externalJobId: string;
  state: JobState;
  progressPercent?: number;
  errorMessage?: string;
  downloadUrl?: string;
}

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
