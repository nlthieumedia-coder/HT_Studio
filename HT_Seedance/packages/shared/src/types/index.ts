export * from '../enums/job-state.js';
export * from '../schemas/models.js';
export * from '../schemas/persistence.js';

export interface SystemInfo {
  version: string;
  service: string;
  uptimeSeconds: number;
  nodeVersion: string;
  platform: string;
  arch: string;
  memoryUsageMb: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
  };
  activeWorkers: number;
  queuedJobs: number;
}

export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
  service: string;
  timestamp: string;
}
