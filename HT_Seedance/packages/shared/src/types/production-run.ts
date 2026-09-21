export const PRODUCTION_RUN_STATUSES = ['PREPARING','READY','RUNNING','PAUSED','PAUSED_PROVIDER_INCIDENT','STOPPING','COMPLETED','COMPLETED_WITH_ERRORS','ABORTED','INTERRUPTED'] as const;
export type ProductionRunStatus = typeof PRODUCTION_RUN_STATUSES[number];
export type FailureCategory = 'INPUT'|'ACCOUNT'|'BROWSER'|'PROVIDER'|'QUEUE'|'GENERATION'|'DOWNLOAD'|'OUTPUT'|'FILESYSTEM'|'DATABASE'|'APPLICATION';
export type RetryGroup = 'SAFE_TO_RETRY'|'LOGIN_REQUIRED'|'PROVIDER_REVIEW'|'INPUT_FIX_REQUIRED'|'OUTPUT_REVIEW'|'MANUAL_REVIEW';
export interface PilotLimits { enabled:boolean; maxBatchSize:number; maxWorkers:number; maxActiveJobs:number }
export const DEFAULT_PILOT_LIMITS:PilotLimits={enabled:true,maxBatchSize:10,maxWorkers:1,maxActiveJobs:1};
export interface ProductionRun { id:string; projectId:string; provider:string; status:ProductionRunStatus; startedAt:string|null; endedAt:string|null; workerCount:number; totalJobs:number; completedJobs:number; failedJobs:number; interruptedJobs:number; settingsSnapshot:Record<string,unknown>; notes:string; createdAt:string; updatedAt:string }
export interface PreflightCheck { key:string; status:'PASS'|'WARN'|'FAIL'; message:string; required:boolean }
export interface ProductionPreflight { status:'READY'|'BLOCKED'; checks:PreflightCheck[] }
