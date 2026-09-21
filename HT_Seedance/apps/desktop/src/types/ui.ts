import type { JobState, SystemInfo } from '@ht-dola/shared';

export type BackendStatus = 'CONNECTING' | 'ONLINE' | 'OFFLINE';
export type ThemePreference = 'dark' | 'light' | 'system';

export interface ProjectListItem {
  id: string;
  name: string;
  description: string;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  createdAt: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
}

export interface JobListItem {
  id: string;
  scene: string;
  projectId: string;
  project: string;
  provider: string;
  account: string;
  duration: number;
  aspectRatio: string;
  state: JobState;
  progress: number;
  prompt: string;
  createdAt: string;
  output?: string;
  resolution?: string;
  inputMedia?: { image?: string; video?: string; audio?: string };
  sceneNumber?: number;
}

export interface JobAttemptItem {
  id: string;
  jobId: string;
  attemptNumber: number;
  accountId: string | null;
  workerId: string | null;
  status: JobState;
  startedAt: string;
  endedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface InterruptedJobDetail {
  job: import('../api/services').ApiJob;
  attempts: JobAttemptItem[];
  retry: {
    retryable: boolean;
    attemptsRemaining: number;
    nextAttemptAt: string | null;
    delayMs: number;
    reason: string;
  };
}

export interface AccountListItem {
  id: string;
  name: string;
  provider: string;
  browserProfile: string;
  loginStatus: 'AUTHENTICATED' | 'LOGIN_REQUIRED' | 'UNKNOWN' | 'ERROR';
  workerStatus: 'IDLE' | 'BUSY' | 'OFFLINE';
  lastChecked: string;
  enabled: boolean;
}

export interface OutputListItem {
  id: string;
  scene: string;
  project: string;
  fileName: string;
  duration: number;
  resolution: string;
  size: string;
  createdAt: string;
}

export interface LogListItem {
  id: string;
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  module: string;
  job: string;
  worker: string;
  account?: string;
  message: string;
}

export interface WorkerListItem {
  id: string;
  name: string;
  account: string;
  currentJob: string;
  state: 'IDLE' | 'RUNNING' | 'DOWNLOADING' | 'OFFLINE';
  elapsed: string;
}

export interface StoragePaths {
  database: string;
  profiles: string;
  projects: string;
  downloads: string;
  logs: string;
}

export interface RuntimeInfo {
  system: SystemInfo;
  paths?: StoragePaths;
}
