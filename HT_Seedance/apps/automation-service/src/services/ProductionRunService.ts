import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  DEFAULT_PILOT_LIMITS,
  JobState,
  type FailureCategory,
  type PilotLimits,
  type ProductionPreflight,
  type ProductionRun,
  type ProductionRunStatus,
  type RetryGroup,
} from '@ht-dola/shared';
import type { SqliteDatabase } from '../db/database.js';
import { appConfig } from '../config/app-config.js';
import { maintenanceCoordinator } from './MaintenanceService.js';
import { providerReliability } from '../providers/reliability/ProviderReliabilityService.js';
import { getChromiumInstallationStatus } from './BrowserInstallationService.js';
import { mediaToolDiagnostics, probeMediaFile } from './MediaToolkit.js';
import { ConflictError, NotFoundError } from '../api/errors.js';
type RunRow = {
  id: string;
  projectId: string;
  provider: string;
  status: ProductionRunStatus;
  startedAt: string | null;
  endedAt: string | null;
  workerCount: number;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  interruptedJobs: number;
  settingsSnapshotJson: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};
type EventRow={id:string;event:string;message:string;metadataJson:string;createdAt:string};
type ReportRow={scene:number;job_id:string;status:string;account:string|null;worker:string|null;attempts:number;output:string|null;error_code:string|null;created_at:string;started_at:string|null;completed_at:string|null};
const select = `SELECT id,project_id projectId,provider,status,started_at startedAt,ended_at endedAt,worker_count workerCount,total_jobs totalJobs,completed_jobs completedJobs,failed_jobs failedJobs,interrupted_jobs interruptedJobs,settings_snapshot_json settingsSnapshotJson,notes,created_at createdAt,updated_at updatedAt FROM production_runs`;
const map = (r: RunRow): ProductionRun => {
  const { settingsSnapshotJson, ...rest } = r;
  return { ...rest, settingsSnapshot: JSON.parse(settingsSnapshotJson) as Record<string, unknown> };
};
const now = () => new Date().toISOString();
const unsafeRetry = new Set([
  'FORM_CHANGED',
  'AMBIGUOUS_CONTROL',
  'LOGIN_REQUIRED',
  'MODEL_NOT_AVAILABLE',
  'SUBMISSION_STATE_UNKNOWN',
]);
export class ProductionRunService {
  constructor(private readonly db: SqliteDatabase) {}
  create(input: {
    projectId: string;
    provider: string;
    jobIds: string[];
    workerCount: number;
    notes?: string;
    pilot?: Partial<PilotLimits>;
  }) {
    const pilot = { ...DEFAULT_PILOT_LIMITS, ...input.pilot };
    if (!input.jobIds.length) throw new ConflictError('Select at least one job.');
    if (
      pilot.enabled &&
      (input.jobIds.length > pilot.maxBatchSize || input.workerCount > pilot.maxWorkers)
    )
      throw new ConflictError('Pilot Mode safety limit exceeded.');
    const jobs = this.db
      .prepare(`SELECT id,status FROM jobs WHERE id IN (${input.jobIds.map(() => '?').join(',')})`)
      .all(...input.jobIds) as { id: string; status: string }[];
    if (
      jobs.length !== input.jobIds.length ||
      jobs.some((j) => ![JobState.QUEUED, JobState.FAILED].includes(j.status as JobState))
    )
      throw new ConflictError('Only queued or eligible failed jobs may be selected.');
    const id = randomUUID(),
      stamp = now(),
      snapshot = {
        pilot,
        workerCount: input.workerCount,
        provider: input.provider,
        createdAt: stamp,
      };
    this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO production_runs(id,project_id,provider,status,worker_count,total_jobs,settings_snapshot_json,notes,created_at,updated_at) VALUES(?,?,?,'PREPARING',?,?,?,?,?,?)`,
        )
        .run(
          id,
          input.projectId,
          input.provider,
          input.workerCount,
          jobs.length,
          JSON.stringify(snapshot),
          input.notes ?? '',
          stamp,
          stamp,
        );
      const add = this.db.prepare(
        'INSERT INTO production_run_jobs(production_run_id,job_id,initial_status,created_at,updated_at) VALUES(?,?,?,?,?)',
      );
      jobs.forEach((j) => add.run(id, j.id, j.status, stamp, stamp));
      this.event(id, 'RUN_CREATED', 'Production run created.', { jobCount: jobs.length });
    })();
    return this.get(id)!;
  }
  get(id: string) {
    const r = this.db.prepare(`${select} WHERE id=?`).get(id) as RunRow | undefined;
    return r ? map(r) : undefined;
  }
  list() {
    return (this.db.prepare(`${select} ORDER BY created_at DESC`).all() as RunRow[]).map(map);
  }
  preflight(id: string): ProductionPreflight {
    const run = this.require(id),
      checks: ProductionPreflight['checks'] = [];
    const check = (key: string, ok: boolean, message: string, required = true) =>
      checks.push({ key, status: ok ? 'PASS' : 'FAIL', message, required });
    let dbOk = true;
    try {
      dbOk = this.db.pragma('quick_check', { simple: true }) === 'ok';
    } catch {
      dbOk = false;
    }
    check('database', dbOk, dbOk ? 'SQLite healthy.' : 'SQLite quick_check failed.');
    check(
      'maintenance',
      !maintenanceCoordinator.active,
      maintenanceCoordinator.active ? 'Maintenance/recovery mode active.' : 'Maintenance inactive.',
    );
    const q = (
      this.db
        .prepare(
          "SELECT COUNT(*) n FROM production_run_jobs rj JOIN jobs j ON j.id=rj.job_id WHERE rj.production_run_id=? AND j.status IN ('QUEUED','FAILED')",
        )
        .get(id) as { n: number }
    ).n;
    check('queue', q > 0, `${q} eligible jobs.`);
    const idle = (
      this.db.prepare("SELECT COUNT(*) n FROM workers WHERE state='IDLE'").get() as { n: number }
    ).n;
    check('workers', idle >= run.workerCount, `${idle} idle workers available.`);
    let output = true,
      free = 0;
    try {
      fs.mkdirSync(appConfig.projectsDir, { recursive: true });
      const stat = fs.statfsSync(appConfig.projectsDir);
      free = stat.bavail * stat.bsize;
      fs.accessSync(appConfig.projectsDir, fs.constants.W_OK);
    } catch {
      output = false;
    }
    check(
      'output',
      output && free > 100 * 1024 * 1024,
      `Output writable; ${Math.round(free / 1024 / 1024)} MiB free.`,
    );
    const media = mediaToolDiagnostics();
    check(
      'ffprobe',
      media.ffprobe.available,
      'FFprobe ' + (media.ffprobe.available ? 'ready.' : 'unavailable.'),
    );
    check(
      'browser',
      getChromiumInstallationStatus().ok,
      'Chromium ' + (getChromiumInstallationStatus().ok ? 'ready.' : 'unavailable.'),
    );
    check(
      'provider',
      providerReliability.canAssign(run.provider),
      'Provider circuit ' + providerReliability.status(run.provider).circuit + '.',
    );
    const accounts = (
      this.db
        .prepare(
          "SELECT COUNT(*) n FROM accounts WHERE enabled=1 AND provider=? AND session_status='AUTHENTICATED' AND browser_profile_id IS NOT NULL",
        )
        .get(run.provider) as { n: number }
    ).n;
    check('account', accounts > 0, `${accounts} eligible authenticated accounts.`);
    const backup = (
      this.db
        .prepare(
          "SELECT COUNT(*) n FROM backups WHERE status='COMPLETED' AND verified_at IS NOT NULL",
        )
        .get() as { n: number }
    ).n;
    check('backup', backup > 0, `${backup} verified backups.`, true);
    const status = checks.some((c) => c.required && c.status === 'FAIL') ? 'BLOCKED' : 'READY';
    this.setStatus(id, status === 'READY' ? 'READY' : 'PREPARING');
    return { status, checks };
  }
  start(id: string) {
    const p = this.preflight(id);
    if (p.status !== 'READY') throw new ConflictError('Production preflight blocked.');
    const stamp = now();
    this.db
      .prepare(
        "UPDATE production_runs SET status='RUNNING',started_at=COALESCE(started_at,?),updated_at=? WHERE id=?",
      )
      .run(stamp, stamp, id);
    this.event(id, 'RUN_STARTED', 'Production run started.');
    return this.get(id)!;
  }
  pause(id: string, incident = false) {
    this.setStatus(id, incident ? 'PAUSED_PROVIDER_INCIDENT' : 'PAUSED');
    this.event(
      id,
      incident ? 'PROVIDER_INCIDENT' : 'RUN_PAUSED',
      incident ? 'Provider circuit opened.' : 'Pause after current requested.',
    );
    return this.get(id)!;
  }
  resume(id: string) {
    if (!providerReliability.canAssign(this.require(id).provider))
      throw new ConflictError('Provider circuit is not assignable.');
    this.setStatus(id, 'RUNNING');
    this.event(id, 'RUN_RESUMED', 'Production run resumed.');
    return this.get(id)!;
  }
  stop(id: string) {
    this.setStatus(id, 'STOPPING');
    this.event(id, 'RUN_STOPPING', 'Scheduler stopped; active safe work may finish.');
    return this.get(id)!;
  }
  recover() {
    const active = [
      'PREPARING',
      'READY',
      'RUNNING',
      'PAUSED',
      'PAUSED_PROVIDER_INCIDENT',
      'STOPPING',
    ];
    const marks = active.map(() => '?').join(',');
    const rows = this.db
      .prepare(`SELECT id FROM production_runs WHERE status IN (${marks})`)
      .all(...active) as { id: string }[];
    const stamp = now();
    rows.forEach((r) => {
      this.db
        .prepare(
          "UPDATE production_runs SET status='INTERRUPTED',ended_at=?,updated_at=? WHERE id=?",
        )
        .run(stamp, stamp, r.id);
      this.event(
        r.id,
        'RUN_INTERRUPTED',
        'Run interrupted during application restart; uncertain jobs require review.',
      );
    });
    return rows.length;
  }
  complete(id: string) {
    const s = this.statistics(id),
      status: ProductionRunStatus =
        s.failed + s.interrupted ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED';
    this.db
      .prepare(
        'UPDATE production_runs SET status=?,ended_at=?,completed_jobs=?,failed_jobs=?,interrupted_jobs=?,updated_at=? WHERE id=?',
      )
      .run(status, now(), s.completed, s.failed, s.interrupted, now(), id);
    this.event(id, 'RUN_COMPLETED', 'Production run completed.', s);
    return this.get(id)!;
  }
  statistics(id: string) {
    this.require(id);
    const r = this.db
      .prepare(
        `SELECT COUNT(*) total,SUM(j.status='COMPLETED') completed,SUM(j.status='FAILED') failed,SUM(j.status='INTERRUPTED') interrupted,SUM(j.status IN ('WAITING_FOR_WORKER','STARTING_BROWSER','PREPARING','SUBMITTING','GENERATING','DOWNLOADING','PROCESSING')) running,SUM(j.status='QUEUED') waiting FROM production_run_jobs rj JOIN jobs j ON j.id=rj.job_id WHERE rj.production_run_id=?`,
      )
      .get(id) as Record<string, number>;
    const run = this.get(id)!;
    const elapsed = run.startedAt
      ? Math.max(1, (Date.now() - new Date(run.startedAt).getTime()) / 3600000)
      : 0;
    return {
      total: r.total ?? 0,
      completed: r.completed ?? 0,
      failed: r.failed ?? 0,
      interrupted: r.interrupted ?? 0,
      running: r.running ?? 0,
      waiting: r.waiting ?? 0,
      successRate: r.total ? Math.round(((r.completed ?? 0) / r.total) * 100) : 0,
      jobsPerHour: elapsed ? (r.completed ?? 0) / elapsed : 0,
    };
  }
  events(id: string) {
    const rows=this.db
      .prepare(
        'SELECT id,event,message,metadata_json metadataJson,created_at createdAt FROM production_run_events WHERE production_run_id=? ORDER BY created_at',
      )
      .all(id) as EventRow[];
    return rows.map((x) => ({ ...x, metadata: JSON.parse(x.metadataJson), metadataJson: undefined }));
  }
  detectStuck(id: string, thresholdMs = 15 * 60_000) {
    const cutoff = new Date(Date.now() - thresholdMs).toISOString();
    return this.db
      .prepare(
        `SELECT j.id jobId,j.status,j.updated_at updatedAt,'STUCK_JOB' code FROM production_run_jobs rj JOIN jobs j ON j.id=rj.job_id LEFT JOIN workers w ON w.job_id=j.id WHERE rj.production_run_id=? AND ((j.status IN ('STARTING_BROWSER','PREPARING','SUBMITTING','DOWNLOADING') AND j.updated_at<?) OR (w.job_id IS NOT NULL AND w.heartbeat_at<?))`,
      )
      .all(id, cutoff, cutoff);
  }
  validateOutput(jobId: string) {
    const o = this.db
      .prepare(
        'SELECT file_path filePath FROM outputs WHERE job_id=? ORDER BY created_at DESC LIMIT 1',
      )
      .get(jobId) as { filePath: string } | undefined;
    if (!o || !fs.existsSync(o.filePath) || fs.statSync(o.filePath).size <= 0)
      return { valid: false, code: 'OUTPUT_INVALID' };
    const p = probeMediaFile(o.filePath);
    return {
      valid: Boolean(p.durationSeconds && p.durationSeconds > 0 && p.width && p.height),
      code: p.durationSeconds && p.width && p.height ? null : 'OUTPUT_INVALID',
      probe: p,
    };
  }
  classify(code: string): { category: FailureCategory; retryGroup: RetryGroup } {
    if (code === 'LOGIN_REQUIRED') return { category: 'ACCOUNT', retryGroup: 'LOGIN_REQUIRED' };
    if (['FORM_CHANGED', 'AMBIGUOUS_CONTROL', 'MODEL_NOT_AVAILABLE'].includes(code))
      return { category: 'PROVIDER', retryGroup: 'PROVIDER_REVIEW' };
    if (code.includes('DOWNLOAD')) return { category: 'DOWNLOAD', retryGroup: 'SAFE_TO_RETRY' };
    if (code === 'OUTPUT_INVALID') return { category: 'OUTPUT', retryGroup: 'OUTPUT_REVIEW' };
    if (code.includes('INPUT')) return { category: 'INPUT', retryGroup: 'INPUT_FIX_REQUIRED' };
    return {
      category: 'APPLICATION',
      retryGroup: unsafeRetry.has(code) ? 'MANUAL_REVIEW' : 'SAFE_TO_RETRY',
    };
  }
  reports(id: string) {
    const run = this.require(id),
      dir = path.join(appConfig.projectsDir, run.projectId, 'production-runs', id);
    fs.mkdirSync(dir, { recursive: true });
    const rows = this.db
      .prepare(
        `SELECT j.scene_number scene,j.id job_id,j.status,rj.account_id account,rj.worker_id worker,j.attempt_count attempts,o.file_path output,j.error_code,j.created_at,j.started_at,j.completed_at FROM production_run_jobs rj JOIN jobs j ON j.id=rj.job_id LEFT JOIN outputs o ON o.job_id=j.id WHERE rj.production_run_id=? ORDER BY j.scene_number`,
      )
      .all(id) as ReportRow[];
    const manifest = path.join(dir, 'run-manifest.json');
    fs.writeFileSync(manifest, JSON.stringify({ run, jobs: rows }, null, 2));
    const failed = path.join(dir, 'failed-jobs.csv'),
      quote = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`;
    fs.writeFileSync(
      failed,
      'scene,job_id,account,error_category,error_code,attempts,recommended_action\n' +
        rows
          .filter((r) => r.status !== 'COMPLETED')
          .map((r) => {
            const c = this.classify(r.error_code ?? 'UNKNOWN');
            return [
              r.scene,
              r.job_id,
              r.account,
              c.category,
              r.error_code,
              r.attempts,
              c.retryGroup,
            ]
              .map(quote)
              .join(',');
          })
          .join('\n'),
    );
    return { manifest, failed };
  }
  supportBundle(id: string) {
    const reports = this.reports(id),
      dir = path.join(path.dirname(reports.manifest), 'support');
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(reports.manifest, path.join(dir, 'run-manifest.json'));
    fs.copyFileSync(reports.failed, path.join(dir, 'failed-jobs.csv'));
    fs.writeFileSync(
      path.join(dir, 'support.json'),
      JSON.stringify(
        {
          version: '1.0.0',
          schemaVersion: 7,
          run: this.require(id),
          statistics: this.statistics(id),
          events: this.events(id),
          system: { platform: process.platform, arch: process.arch },
        },
        null,
        2,
      ),
    );
    return { path: dir };
  }
  private setStatus(id: string, status: ProductionRunStatus) {
    if (
      !this.db
        .prepare('UPDATE production_runs SET status=?,updated_at=? WHERE id=?')
        .run(status, now(), id).changes
    )
      throw new NotFoundError('Production run not found.');
  }
  private event(id: string, event: string, message: string, metadata: unknown = {}) {
    this.db
      .prepare(
        'INSERT INTO production_run_events(id,production_run_id,event,message,metadata_json,created_at) VALUES(?,?,?,?,?,?)',
      )
      .run(randomUUID(), id, event, message, JSON.stringify(metadata), now());
  }
  private require(id: string) {
    const r = this.get(id);
    if (!r) throw new NotFoundError('Production run not found.');
    return r;
  }
}
