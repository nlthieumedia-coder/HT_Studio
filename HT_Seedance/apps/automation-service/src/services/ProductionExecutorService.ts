import fs from 'node:fs';
import path from 'node:path';
import { JobState, type BrowserProfile, type Job, type JobInput, type VideoProvider } from '@ht-dola/shared';
import type { SqliteDatabase } from '../db/database.js';
import type { JobRecord } from '../db/types.js';
import { JobRepository } from '../db/repositories/JobRepository.js';
import { JobAttemptRepository } from '../db/repositories/JobAttemptRepository.js';
import { WorkerRepository } from '../db/repositories/WorkerRepository.js';
import { BrowserProfileRepository } from '../db/repositories/BrowserProfileRepository.js';
import { AccountRepository } from '../db/repositories/AccountRepository.js';
import { DolaProvider } from '../providers/dola/dola-provider.js';
import { MockVideoProvider } from '../providers/mock/index.js';
import { ProviderError } from '../providers/reliability/ProviderErrors.js';
import { DownloadManager } from './DownloadManager.js';
import { ProductionRunService } from './ProductionRunService.js';
import { browserManager } from '../browser/browser-manager.js';
import { appConfig } from '../config/app-config.js';
import { logger } from '../logging/logger.js';
import { auditLog } from '../logging/audit-log.js';
import { concatenateVideos, extractLastFrame, probeMediaFile } from './MediaToolkit.js';

const terminal = new Set([JobState.DOWNLOADING, JobState.FAILED, JobState.INTERRUPTED]);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const promptForSegment = (prompt: string, segmentNumber: number, segmentCount: number, duration: number) => {
  const withoutLongDuration = prompt
    .replace(/\bthirty[-\s]+seconds?\b/gi, `${duration} seconds`)
    .replace(/\b30\s*(?:seconds?|secs?|s|giây)\b/gi, `${duration} seconds`)
    .replace(/\b(?:15|20)\s*(?:seconds?|secs?|s|giây)\b/gi, `${duration} seconds`);
  return `${withoutLongDuration}\n\nCreate exactly one ${duration}-second video segment. Segment ${segmentNumber}/${segmentCount}; preserve the same characters, face, hair, wardrobe, setting, lighting, camera style and cinematic continuity. Continue naturally from the previous segment and keep the reference image identity unchanged.`;
};
const promptForNative30s = (prompt: string) => prompt
  .replace(/\bat approximately thirty seconds\b/gi, 'near the end')
  .replace(/\bat approximately 30\s*(?:seconds?|secs?|s)\b/gi, 'near the end')
  .replace(/\b(?:thirty|30|15|20)[-\s]*(?:seconds?|secs?|s|giây)\b/gi, 'the full sequence')
  .trim();

export class ProductionExecutorService {
  private readonly activeRuns = new Set<string>();

  constructor(private readonly db: SqliteDatabase) {}

  start(runId: string) {
    if (this.activeRuns.has(runId)) return;
    this.activeRuns.add(runId);
    void this.executeRun(runId).finally(() => this.activeRuns.delete(runId));
  }

  private async executeRun(runId: string) {
    const runs = new ProductionRunService(this.db);
    try {
      auditLog({ level: 'INFO', module: 'production', event: 'run_executor_started', message: `Bắt đầu thực thi production run ${runId.slice(0, 8)}.` });
      const rows = this.db
        .prepare(
          `SELECT j.id FROM production_run_jobs rj JOIN jobs j ON j.id=rj.job_id
           WHERE rj.production_run_id=? AND j.status IN ('QUEUED','FAILED') ORDER BY j.priority DESC,j.created_at`,
        )
        .all(runId) as Array<{ id: string }>;
      for (const row of rows) await this.executeJob(row.id);
      runs.complete(runId);
      auditLog({ level: 'INFO', module: 'production', event: 'run_executor_completed', message: `Production run ${runId.slice(0, 8)} đã kết thúc.` });
    } catch (error) {
      logger.error({ runId, error }, 'Production run executor failed');
      runs.pause(runId, true);
    }
  }

  private async executeJob(jobId: string) {
    const jobs = new JobRepository(this.db);
    const attempts = new JobAttemptRepository(this.db);
    const workers = new WorkerRepository(this.db);
    const job = jobs.getById(jobId);
    if (!job) return;
    const account = new AccountRepository(this.db)
      .list({ provider: job.provider, limit: 500, offset: 0 })
      .items.find((item) => item.enabled && item.sessionStatus === 'AUTHENTICATED' && item.browserProfileId);
    const worker = workers.list().find((item) => item.state === 'IDLE');
    if (!account?.browserProfileId || !worker) throw new Error('No authenticated account or idle worker is available.');
    const trace = (level: 'INFO' | 'WARN' | 'ERROR', event: string, message: string, metadata?: Record<string, unknown>) =>
      auditLog({ level, module: 'production', event, message, jobId: job.id, projectId: job.projectId, workerId: worker.id, accountId: account.id, ...(metadata ? { metadata } : {}) });

    const stamp = new Date().toISOString();
    trace('INFO', 'job_assigned', 'Đã nhận job và gán tài khoản/worker.');
    this.db.prepare("UPDATE jobs SET status='WAITING_FOR_WORKER',account_id=?,started_at=COALESCE(started_at,?),updated_at=? WHERE id=?").run(account.id, stamp, stamp, job.id);
    workers.update(worker.id, { state: 'BUSY', accountId: account.id, jobId: job.id, startedAt: stamp, heartbeatAt: stamp });
    const attempt = attempts.createAttempt({ jobId: job.id, attemptNumber: job.attemptCount + 1, accountId: account.id, workerId: worker.id, status: JobState.PREPARING });
    this.db.prepare('UPDATE jobs SET attempt_count=attempt_count+1 WHERE id=?').run(job.id);
    const provider = this.provider(job.provider);
    const temporaryFiles = new Set<string>();
    try {
      this.setJobState(job.id, JobState.STARTING_BROWSER, 5);
      trace('INFO', 'browser_starting', 'Đang mở Chromium với session của tài khoản.');
      const profileRecord = new BrowserProfileRepository(this.db).getById(account.browserProfileId);
      if (!profileRecord) throw new Error('Browser profile is missing.');
      const profile: BrowserProfile = {
        id: profileRecord.id,
        name: profileRecord.name,
        storagePath: profileRecord.profileDirectory,
        viewport: { width: 1280, height: 720 },
        isLocked: false,
        createdAt: profileRecord.createdAt,
        updatedAt: profileRecord.updatedAt,
      };
      await provider.initialize(profile);
      // Dola may expose the 30s option in the UI while the current account only
      // accepts short generations. Build a reliable 30s master from three 10s
      // generations, which is the broadly supported duration.
      const native30s = false;
      const requested30s = job.provider === 'dola' && job.durationSeconds === 30;
      const segmentDurations: number[] = requested30s ? [10, 10, 10] : [];
      for (let remaining = requested30s ? 0 : job.durationSeconds; remaining > 0; remaining -= Math.min(10, remaining))
        segmentDurations.push(Math.min(10, remaining));
      const segmentFiles: string[] = [];
      const externalJobIds: string[] = [];
      let continuityReference: string | undefined = job.inputMedia.image || undefined;
      trace('INFO', requested30s ? 'thirty_seconds_fallback_planned' : 'segments_planned', requested30s ? 'Dola không hỗ trợ native 30s/15s; hệ thống sẽ tạo 3 đoạn 10s và ghép thành video 30s.' : `Job ${job.durationSeconds}s sẽ được tạo thành ${segmentDurations.length} đoạn.`, { segmentDurations, native30s, requested30s });
      for (let index = 0; index < segmentDurations.length; index += 1) {
        const segmentNumber = index + 1;
        const segmentDuration = segmentDurations[index]!;
        const baseInput = this.toInput(job);
        const segmentInput: JobInput = {
          ...baseInput,
          prompt: native30s ? promptForNative30s(job.prompt) : segmentDurations.length === 1 ? job.prompt : promptForSegment(job.prompt, segmentNumber, segmentDurations.length, segmentDuration),
          durationSeconds: segmentDuration,
          referenceImages: continuityReference ? [continuityReference] : [],
          extraParams: { ...baseInput.extraParams, ...((native30s || segmentDurations.length > 1) ? { modelAlias: 'seedance_2_5' } : {}) },
        };
        this.setJobState(job.id, JobState.SUBMITTING, 10 + Math.round((index / segmentDurations.length) * 70));
        trace('INFO', 'segment_preparing', `Đang chuẩn bị đoạn ${segmentNumber}/${segmentDurations.length} (${segmentDuration}s).`, { segmentNumber, segmentDuration });
        const submission = await provider.submit(this.toProviderJob(job, account.id, profile.id), segmentInput);
        externalJobIds.push(submission.externalJobId);
        trace('INFO', 'segment_submitted', `Đã gửi đoạn ${segmentNumber}/${segmentDurations.length} đến Dola.`, { segmentNumber, externalJobId: submission.externalJobId });
        this.db.prepare('UPDATE jobs SET provider_metadata_json=?,submitted_at=COALESCE(submitted_at,?),updated_at=? WHERE id=?').run(JSON.stringify({ externalJobIds, segmentCount: segmentDurations.length, currentSegment: segmentNumber }), new Date().toISOString(), new Date().toISOString(), job.id);
        let status = await provider.checkStatus(submission.externalJobId);
        while (!terminal.has(status.state)) {
          const overallProgress = 15 + Math.round(((index + (status.progressPercent ?? 50) / 100) / segmentDurations.length) * 70);
          this.setJobState(job.id, JobState.GENERATING, overallProgress);
          workers.update(worker.id, { heartbeatAt: new Date().toISOString() });
          await wait(3000);
          status = await provider.checkStatus(submission.externalJobId);
        }
        if (status.state !== JobState.DOWNLOADING) throw new Error(status.errorMessage ?? `Provider ended in ${status.state}.`);
        const segmentTarget = path.join(appConfig.tempDir, `${job.id}-segment-${segmentNumber}.mp4`);
        temporaryFiles.add(segmentTarget);
        fs.rmSync(segmentTarget, { force: true });
        trace('INFO', 'segment_download_started', `Đang tải đoạn ${segmentNumber}/${segmentDurations.length}.`, { segmentNumber });
        const output = await provider.downloadResult(submission.externalJobId, segmentTarget);
        segmentFiles.push(output.filePath);
        trace('INFO', 'segment_downloaded', `Đã tải xong đoạn ${segmentNumber}/${segmentDurations.length}.`, { segmentNumber });
        if (segmentNumber < segmentDurations.length) {
          const framePath = path.join(appConfig.tempDir, `${job.id}-continuity-${segmentNumber}.jpg`);
          temporaryFiles.add(framePath);
          if (extractLastFrame(output.filePath, framePath)) {
            continuityReference = framePath;
            trace('INFO', 'continuity_reference_ready', `Đã trích frame cuối làm tham chiếu cho đoạn ${segmentNumber + 1}.`, { segmentNumber, framePath });
          } else {
            trace('WARN', 'continuity_reference_failed', `Không trích được frame cuối; đoạn tiếp theo vẫn chạy bằng prompt liên tục.`, { segmentNumber });
          }
        }
        await provider.cleanup();
      }
      this.setJobState(job.id, JobState.DOWNLOADING, 90);
      const temporaryTarget = path.join(appConfig.tempDir, `${job.id}-final.mp4`);
      temporaryFiles.add(temporaryTarget);
      fs.rmSync(temporaryTarget, { force: true });
      if (segmentFiles.length === 1) fs.copyFileSync(segmentFiles[0]!, temporaryTarget);
      else {
        trace('INFO', 'segments_merging', `Đang ghép ${segmentFiles.length} đoạn thành video ${job.durationSeconds}s.`);
        if (!concatenateVideos(segmentFiles, temporaryTarget)) throw new Error('FFmpeg không thể ghép các đoạn video.');
      }
      const finalProbe = probeMediaFile(temporaryTarget);
      if (job.durationSeconds >= 30 && (finalProbe.durationSeconds === null || finalProbe.durationSeconds < 29)) {
        throw new Error(`Video cuối không đạt thời lượng yêu cầu: ${finalProbe.durationSeconds ?? 'unknown'}s.`);
      }
      const finalOutput = new DownloadManager(this.db).persistDownloadedFile({ jobId: job.id, sourcePath: temporaryTarget, suggestedFilename: `${job.id}.mp4` });
      for (const file of [...segmentFiles, temporaryTarget]) fs.rmSync(file, { force: true });
      temporaryFiles.clear();
      attempts.finishAttempt(attempt.id, { status: JobState.COMPLETED, providerMetadata: { externalJobIds, segmentCount: segmentFiles.length } });
      trace('INFO', 'job_completed', 'Đã tải, ghép, xác minh và lưu video hoàn chỉnh.', { filePath: finalOutput.filePath, segmentCount: segmentFiles.length });
    } catch (error) {
      const code = error instanceof ProviderError ? error.code : 'EXECUTION_FAILED';
      const message = (error instanceof Error ? error.message : String(error)).replace(/\u001b\[[0-9;]*m/g, '');
      this.db.prepare("UPDATE jobs SET status='FAILED',error_code=?,error_message=?,updated_at=? WHERE id=?").run(code, message, new Date().toISOString(), job.id);
      attempts.finishAttempt(attempt.id, { status: JobState.FAILED, errorCode: code, errorMessage: message });
      if (code === 'LOGIN_REQUIRED' || code === 'SESSION_EXPIRED') new AccountRepository(this.db).updateSessionStatus(account.id, 'LOGIN_REQUIRED');
      trace('ERROR', 'job_failed', `Job thất bại tại bước hiện tại: ${message}`, { code });
      logger.error({ jobId, code, error }, 'Production job failed');
    } finally {
      for (const file of temporaryFiles) fs.rmSync(file, { force: true });
      await provider.cleanup().catch(() => {});
      await browserManager.closeProfile(account.browserProfileId).catch(() => {});
      workers.update(worker.id, { state: 'IDLE', accountId: null, jobId: null, heartbeatAt: new Date().toISOString() });
    }
  }

  private provider(id: string): VideoProvider {
    if (id === 'dola') return new DolaProvider();
    if (id === 'mock') return new MockVideoProvider();
    throw new Error(`Unsupported provider: ${id}`);
  }

  private setJobState(id: string, state: JobState, progress: number) {
    this.db.prepare('UPDATE jobs SET status=?,progress=?,updated_at=? WHERE id=?').run(state, progress, new Date().toISOString(), id);
  }

  private toProviderJob(job: JobRecord, accountId: string, profileId: string): Job {
    return { id: job.id, projectId: job.projectId, providerId: job.provider, accountId, profileId, state: job.status, input: this.toInput(job), priority: job.priority, retryCount: job.attemptCount, maxRetries: job.maxAttempts, createdAt: job.createdAt, updatedAt: job.updatedAt, ...(job.startedAt ? { startedAt: job.startedAt } : {}), ...(job.completedAt ? { completedAt: job.completedAt } : {}) };
  }

  private toInput(job: JobRecord): JobInput {
    return { prompt: job.prompt, aspectRatio: job.aspectRatio as JobInput['aspectRatio'], durationSeconds: job.durationSeconds, referenceImages: job.inputMedia.image ? [job.inputMedia.image] : [], ...(job.inputMedia.video ? { referenceVideo: job.inputMedia.video } : {}), ...(job.inputMedia.audio ? { referenceAudio: job.inputMedia.audio } : {}), extraParams: { resolution: job.resolution } };
  }
}
