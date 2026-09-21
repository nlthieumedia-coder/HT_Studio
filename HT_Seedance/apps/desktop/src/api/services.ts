import type { HealthCheckResponse, SystemInfo, ProductionRun, ProductionPreflight } from '@ht-dola/shared';
import { JobState, formatSceneNumber } from '@ht-dola/shared';
import { apiClient } from './client';
import {
  accountFixtures,
  jobFixtures,
  logFixtures,
  outputFixtures,
  projectFixtures,
  storagePathFixtures,
  workerFixtures,
} from '../dev/fixtures';
import type {
  AccountListItem,
  JobListItem,
  OutputListItem,
  ProjectListItem,
  RuntimeInfo,
  WorkerListItem,
  InterruptedJobDetail,
} from '../types/ui';
interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
export interface ApiProject {
  id: string;
  name: string;
  description: string;
  status: 'ACTIVE' | 'ARCHIVED';
  outputDirectory: string | null;
  defaultProvider: string;
  defaultDurationSeconds: number;
  defaultAspectRatio: string;
  defaultResolution: string;
  createdAt: string;
  totalJobs: number;
  draftJobs: number;
  queuedJobs: number;
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
}
export interface ApiJob {
  id: string;
  projectId: string;
  sceneNumber: number;
  projectName?: string;
  provider: string;
  accountName?: string | null;
  accountId: string | null;
  durationSeconds: number;
  aspectRatio: string;
  resolution: string;
  status: JobState;
  progress: number;
  priority: number;
  attemptCount: number;
  maxAttempts: number;
  errorCode: string | null;
  errorMessage: string | null;
  prompt: string;
  inputMedia: { image?: string; video?: string; audio?: string };
  createdAt: string;
}
export interface ApiOutput {
  id: string;
  jobId: string;
  filePath: string;
  fileName: string;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  fileSize: number | null;
  checksumSha256: string | null;
  createdAt: string;
}
const mapProject = (item: ApiProject): ProjectListItem => ({
  id: item.id,
  name: item.name,
  description: item.description,
  totalJobs: item.totalJobs,
  completedJobs: item.completedJobs,
  failedJobs: item.failedJobs,
  createdAt: item.createdAt,
  status: item.status,
});
const mapJob = (item: ApiJob): JobListItem => ({
  id: item.id,
  scene: formatSceneNumber(item.sceneNumber),
  projectId: item.projectId,
  project: item.projectName ?? item.projectId,
  provider: item.provider,
  account: item.accountName ?? 'Unassigned',
  duration: item.durationSeconds,
  aspectRatio: item.aspectRatio,
  state: item.status,
  progress: item.progress,
  prompt: item.prompt,
  createdAt: item.createdAt,
  resolution: item.resolution,
  inputMedia: item.inputMedia,
  sceneNumber: item.sceneNumber,
});
const formatBytes = (value: number | null) => {
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(index ? 1 : 0)} ${units[index]}`;
};
const mapOutput = (item: ApiOutput): OutputListItem => ({
  id: item.id,
  scene: item.jobId.slice(0, 8),
  project: item.filePath,
  fileName: item.fileName,
  duration: item.durationSeconds ?? 0,
  resolution: item.width && item.height ? `${item.width}x${item.height}` : 'Unknown',
  size: formatBytes(item.fileSize),
  createdAt: item.createdAt,
});
const withFallback = async <T>(request: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await request();
  } catch {
    return fallback;
  }
};
export const healthService = {
  check: (signal?: AbortSignal) => apiClient.get<HealthCheckResponse>('/health', signal),
};
export const systemService = {
  getInfo: async (): Promise<RuntimeInfo | null> => {
    try {
      const result = await apiClient.get<{ success: boolean; data: SystemInfo }>(
        '/api/system/info',
      );
      return { system: result.data, paths: storagePathFixtures };
    } catch {
      return null;
    }
  },
  health: () =>
    apiClient.get<{ data: Record<string, unknown> }>('/api/system/health').then((r) => r.data),
  exportDiagnostics: () =>
    apiClient.post<{ data: { path: string; bytes: number } }>('/api/system/diagnostics/export'),
};
export const projectService = {
  list: (): Promise<ProjectListItem[]> =>
    withFallback(
      () =>
        apiClient
          .get<{ data: Page<ApiProject> }>('/api/projects?limit=200')
          .then((r) => r.data.items.map(mapProject)),
      projectFixtures,
    ),
  getRaw: (id: string) =>
    apiClient.get<{ data: ApiProject }>(`/api/projects/${id}`).then((r) => r.data),
  get: async (id: string) =>
    withFallback(
      () => projectService.getRaw(id).then(mapProject),
      projectFixtures.find((project) => project.id === id),
    ),
  create: (input: Record<string, unknown>) =>
    apiClient.post<{ data: ApiProject }>('/api/projects', input),
  update: (id: string, input: Record<string, unknown>) =>
    apiClient.patch<{ data: ApiProject }>(`/api/projects/${id}`, input),
  archive: (id: string) => apiClient.post<{ data: ApiProject }>(`/api/projects/${id}/archive`),
  restore: (id: string) => apiClient.post<{ data: ApiProject }>(`/api/projects/${id}/restore`),
  delete: (id: string, confirmRecords = false) =>
    apiClient.delete(`/api/projects/${id}${confirmRecords ? '?confirmRecords=true' : ''}`),
};
export const jobService = {
  listRaw: (projectId?: string) =>
    apiClient
      .get<{ data: Page<ApiJob> }>(`/api/jobs?limit=200${projectId ? `&project=${projectId}` : ''}`)
      .then((r) => r.data.items),
  list: async (): Promise<JobListItem[]> =>
    withFallback(() => jobService.listRaw().then((items) => items.map(mapJob)), jobFixtures),
  create: (input: Record<string, unknown>) => apiClient.post<{ data: ApiJob }>('/api/jobs', input),
  update: (id: string, input: Record<string, unknown>) =>
    apiClient.patch<{ data: ApiJob }>(`/api/jobs/${id}`, input),
  duplicate: (id: string) => apiClient.post<{ data: ApiJob }>(`/api/jobs/${id}/duplicate`),
  queue: (id: string) => apiClient.post<{ data: ApiJob }>(`/api/jobs/${id}/queue`),
  unqueue: (id: string) => apiClient.post<{ data: ApiJob }>(`/api/jobs/${id}/unqueue`),
  reorder: (id: string, direction: 'up' | 'down') =>
    apiClient.post<{ data: ApiJob }>(`/api/jobs/${id}/reorder`, { direction }),
  renumber: (projectId: string) => apiClient.post(`/api/projects/${projectId}/jobs/renumber`),
  delete: (id: string) => apiClient.delete(`/api/jobs/${id}`),
  bulkQueue: (ids: string[]) => apiClient.post('/api/jobs/bulk/queue', { ids }),
  bulkUnqueue: (ids: string[]) => apiClient.post('/api/jobs/bulk/unqueue', { ids }),
  bulkUpdate: (ids: string[], changes: Record<string, unknown>) =>
    apiClient.patch('/api/jobs/bulk', { ids, changes }),
  bulkDuplicate: (ids: string[]) => apiClient.post('/api/jobs/bulk/duplicate', { ids }),
  bulkDelete: (ids: string[]) => apiClient.post('/api/jobs/bulk/delete', { ids }),
  interrupted: () =>
    apiClient.get<{ data: InterruptedJobDetail[] }>('/api/jobs/interrupted').then((r) => r.data),
  inspect: (id: string) =>
    apiClient.get<{ data: InterruptedJobDetail }>(`/api/jobs/${id}/inspect`).then((r) => r.data),
  attempts: (id: string) => apiClient.get(`/api/jobs/${id}/attempts`),
  retry: (id: string) => apiClient.post<{ data: ApiJob }>(`/api/jobs/${id}/retry`),
  retryFailed: (id: string) => apiClient.post<{ data: ApiJob }>(`/api/jobs/${id}/retry-failed`),
  markFailed: (id: string) => apiClient.post<{ data: ApiJob }>(`/api/jobs/${id}/mark-failed`),
  cancel: (id: string) => apiClient.post<{ data: ApiJob }>(`/api/jobs/${id}/cancel`),
  queueSnapshot: () =>
    apiClient
      .get<{
        data: {
          state: { paused: boolean; stopAfterCurrent: boolean; updatedAt: string };
          running: ApiJob[];
          waiting: ApiJob[];
          failed: ApiJob[];
          completed: ApiJob[];
        };
      }>('/api/jobs/queue')
      .then((r) => r.data),
  pauseQueue: () => apiClient.post('/api/jobs/queue/pause'),
  resumeQueue: () => apiClient.post('/api/jobs/queue/resume'),
  stopAfterCurrent: () => apiClient.post('/api/jobs/queue/stop-after-current'),
};
export const importService = {
  analyze: (projectId: string, input: Record<string, unknown>) =>
    apiClient.post<{
      data: {
        id: string;
        detectedColumns: string[];
        mapping: Record<string, string>;
        rows: Array<{ row: number; sceneNumber: number; prompt: string; status: string }>;
        issues: Array<{ row: number; code: string; message: string; severity: string }>;
        sheets?: Array<{ name: string; rows: number; columns: string[] }>;
      };
    }>(`/api/projects/${projectId}/import/analyze`, input),
  commit: (projectId: string, sessionId: string) =>
    apiClient.post<{
      data: { total: number; imported: number; skipped: number; warnings: number; errors: number };
    }>(`/api/projects/${projectId}/import/commit`, { sessionId }),
  exportCsv: (projectId: string) => apiClient.getText(`/api/projects/${projectId}/export/csv`),
  template: () => apiClient.getText('/api/import/template.csv'),
};
export const accountService = {
  list: (): Promise<AccountListItem[]> =>
    withFallback(
      () =>
        apiClient
          .get<{
            data: Page<{
              id: string;
              displayName: string;
              provider: string;
              browserProfileId: string | null;
              enabled: boolean;
              sessionStatus: 'UNKNOWN' | 'AUTHENTICATED' | 'LOGIN_REQUIRED' | 'ERROR';
              lastSessionCheck: string | null;
            }>;
          }>('/api/accounts?limit=200')
          .then((r) =>
            r.data.items.map((item) => ({
              id: item.id,
              name: item.displayName,
              provider: item.provider,
              browserProfile: item.browserProfileId ?? 'Not linked',
              loginStatus: item.sessionStatus,
              workerStatus: 'IDLE',
              lastChecked: item.lastSessionCheck ?? '',
              enabled: item.enabled,
            })),
          ),
      accountFixtures,
    ),
  create: (input: { displayName: string; provider: string; enabled: boolean }) =>
    apiClient.post('/api/accounts', input),
  setEnabled: (id: string, enabled: boolean) =>
    apiClient.post(`/api/accounts/${id}/${enabled ? 'enable' : 'disable'}`),
  delete: (id: string) => apiClient.delete(`/api/accounts/${id}`),
  openProfile:(id:string)=>apiClient.post(`/api/accounts/${id}/open-profile`),
  checkSession:(id:string)=>apiClient.post(`/api/accounts/${id}/check-session`),
};
export const outputService = {
  list: () =>
    withFallback(
      () => apiClient.get<{ data: ApiOutput[] }>('/api/outputs').then((r) => r.data.map(mapOutput)),
      outputFixtures,
    ),
  probe: (id: string) => apiClient.post<{ data: ApiOutput }>(`/api/outputs/${id}/probe`),
  rename: (id: string, fileName: string) =>
    apiClient.post<{ data: ApiOutput }>(`/api/outputs/${id}/rename`, { fileName }),
  move: (id: string, targetDirectory: string) =>
    apiClient.post<{ data: ApiOutput }>(`/api/outputs/${id}/move`, { targetDirectory }),
  copy: (id: string, targetDirectory: string) =>
    apiClient.post<{ data: ApiOutput }>(`/api/outputs/${id}/copy`, { targetDirectory }),
  openFolder: (id: string) => apiClient.post(`/api/outputs/${id}/open-folder`),
  diagnostics: () => apiClient.get('/api/media/diagnostics'),
};
export const logService = {
  list: () =>
    withFallback(
      () =>
        apiClient
          .get<{
            data: {
              items: Array<{
                id: string;
                timestamp: string;
                level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
                module: string;
                jobId: string | null;
                workerId: string | null;
                accountId: string | null;
                message: string;
              }>;
            };
          }>('/api/logs?limit=200')
          .then((r) =>
            r.data.items.map((item) => ({
              id: item.id,
              timestamp: item.timestamp,
              level: item.level,
              module: item.module,
              job: item.jobId ?? '—',
              worker: item.workerId ?? '—',
              account: item.accountId ?? '—',
              message: item.message,
            })),
          ),
      logFixtures,
    ),
};
export const workerService = {
  list: (): Promise<WorkerListItem[]> =>
    withFallback(
      () =>
        apiClient
          .get<{
            data: Array<{
              id: string;
              name: string;
              state: string;
              accountId: string | null;
              jobId: string | null;
              startedAt: string | null;
            }>;
          }>('/api/workers')
          .then((result) =>
            result.data.map((worker) => ({
              id: worker.id,
              name: worker.name,
              account: worker.accountId ?? 'Unassigned',
              currentJob: worker.jobId ?? '—',
              state: worker.state as WorkerListItem['state'],
              elapsed: worker.startedAt
                ? `${Math.max(0, Math.floor((Date.now() - new Date(worker.startedAt).getTime()) / 1000))}s`
                : '—',
            })),
          ),
      workerFixtures,
    ),
};
export interface ProviderStatus {
  provider: string;
  circuit: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  status: 'HEALTHY' | 'DEGRADED' | 'PAUSED' | 'FORM_CHANGED' | 'SESSION_ISSUE';
  healthPercent: number;
  attempted: number;
  succeeded: number;
  failed: number;
  incidents: Array<{
    id: string;
    detectedAt: string;
    errorCode: string;
    affectedJobs: string[];
    affectedAccounts: string[];
    screenshotCount: number;
    status: string;
  }>;
}
export const providerService = {
  list: () =>
    withFallback(
      () => apiClient.get<{ data: ProviderStatus[] }>('/api/providers').then((r) => r.data),
      [],
    ),
  pause: (id: string) => apiClient.post(`/api/providers/${id}/pause`),
  resume: (id: string) => apiClient.post(`/api/providers/${id}/resume`),
  diagnostics: (id: string) => apiClient.get(`/api/providers/${id}/diagnostics`),
};
export const settingsService = { getStoragePaths: () => Promise.resolve(storagePathFixtures) };
export interface BackupRecord {
  id: string;
  filePath: string;
  backupType: string;
  appVersion: string;
  size: number;
  status: string;
  createdAt: string;
  verifiedAt: string | null;
}
export const backupService = {
  list: () => apiClient.get<{ data: BackupRecord[] }>('/api/backups').then((result) => result.data),
  create: (input: Record<string, unknown>) =>
    apiClient
      .post<{ data: { path: string; size: number } }>('/api/backups', input)
      .then((result) => result.data),
  verify: (filePath: string) =>
    apiClient
      .post<{ data: { valid: boolean; errors: string[] } }>('/api/backups/verify', {
        path: filePath,
      })
      .then((result) => result.data),
  preview: (filePath: string) =>
    apiClient
      .post<{ data: Record<string, unknown> }>('/api/backups/preview', { path: filePath })
      .then((result) => result.data),
  restore: (filePath: string, safetyDestination: string) =>
    apiClient.post('/api/backups/restore', { path: filePath, safetyDestination, confirmation: true }),
  remove: (id: string) => apiClient.delete(`/api/backups/${id}?confirm=true`),
  getSettings: () =>
    apiClient
      .get<{
        data: {
          enabled: boolean;
          destination: string;
          frequency: 'DAILY' | 'EVERY_3_DAYS' | 'WEEKLY';
          localTime: string;
          retention: 3 | 5 | 7 | 10 | 20;
        };
      }>('/api/backups/settings')
      .then((result) => result.data),
  saveSettings: (input: Record<string, unknown>) => apiClient.put('/api/backups/settings', input),
  integrity: () =>
    apiClient
      .post<{ data: Record<string, unknown> }>('/api/recovery/integrity/full')
      .then((result) => result.data),
};
export const productionRunService={list:()=>apiClient.get<{data:ProductionRun[]}>('/api/production-runs').then(r=>r.data),create:(input:Record<string,unknown>)=>apiClient.post<{data:ProductionRun}>('/api/production-runs',input).then(r=>r.data),detail:(id:string)=>apiClient.get(`/api/production-runs/${id}`),preflight:(id:string)=>apiClient.post<{data:ProductionPreflight}>(`/api/production-runs/${id}/preflight`).then(r=>r.data),action:(id:string,action:'start'|'pause'|'resume'|'stop'|'complete')=>apiClient.post<{data:ProductionRun}>(`/api/production-runs/${id}/${action}`).then(r=>r.data),reports:(id:string)=>apiClient.post(`/api/production-runs/${id}/reports`),support:(id:string)=>apiClient.post(`/api/production-runs/${id}/support-bundle`)};
