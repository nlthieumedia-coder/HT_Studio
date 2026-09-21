import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Download } from 'playwright';
import { appConfig } from '../config/app-config.js';
import type { SqliteDatabase } from '../db/database.js';
import type { JobRecord, OutputRecord } from '../db/types.js';
import { JobRepository } from '../db/repositories/JobRepository.js';
import { OutputRepository } from '../db/repositories/OutputRepository.js';
import { ConflictError, NotFoundError } from '../api/errors.js';
import { probeMediaFile } from './MediaToolkit.js';

export type DownloadStatus = 'PENDING' | 'DOWNLOADING' | 'VERIFYING' | 'COMPLETED' | 'FAILED';

export interface DownloadTracker {
  id: string;
  jobId: string;
  temporaryFile: string;
  finalOutputFile: string;
  status: DownloadStatus;
  bytes: number;
  startedAt: string;
  completedAt: string | null;
  error?: string;
}

interface PersistDownloadInput {
  jobId: string;
  sourcePath: string;
  suggestedFilename?: string;
}

interface BrowserDownloadInput {
  jobId: string;
  download: Download;
  suggestedFilename?: string;
}

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.mkv']);

export class DownloadManager {
  private readonly jobs: JobRepository;
  private readonly outputs: OutputRepository;
  private readonly trackers = new Map<string, DownloadTracker>();

  constructor(
    private readonly database: SqliteDatabase,
    private readonly projectsDir = appConfig.projectsDir,
  ) {
    this.jobs = new JobRepository(database);
    this.outputs = new OutputRepository(database);
  }

  getTracker(jobId: string): DownloadTracker | undefined {
    return this.trackers.get(jobId);
  }

  async saveBrowserDownload(input: BrowserDownloadInput): Promise<OutputRecord> {
    const { job, finalPath, temporaryPath } = this.prepareTarget(input.jobId, input.suggestedFilename);
    const tracker = this.startTracker(job.id, temporaryPath, finalPath);
    try {
      tracker.status = 'DOWNLOADING';
      await input.download.saveAs(temporaryPath);
      return this.finalize(job, temporaryPath, finalPath, tracker);
    } catch (error) {
      tracker.status = 'FAILED';
      tracker.error = error instanceof Error ? error.message : 'Download failed.';
      this.cleanupFile(temporaryPath);
      throw error;
    }
  }

  persistDownloadedFile(input: PersistDownloadInput): OutputRecord {
    const { job, finalPath, temporaryPath } = this.prepareTarget(input.jobId, input.suggestedFilename);
    const tracker = this.startTracker(job.id, temporaryPath, finalPath);
    try {
      tracker.status = 'DOWNLOADING';
      fs.copyFileSync(input.sourcePath, temporaryPath, fs.constants.COPYFILE_EXCL);
      return this.finalize(job, temporaryPath, finalPath, tracker);
    } catch (error) {
      tracker.status = 'FAILED';
      tracker.error = error instanceof Error ? error.message : 'Download failed.';
      this.cleanupFile(temporaryPath);
      throw error;
    }
  }

  reserveOutputPath(job: JobRecord, suggestedFilename?: string): { finalPath: string; fileName: string } {
    const outputDir = this.outputDirectory(job.projectId);
    fs.mkdirSync(outputDir, { recursive: true });
    const extension = this.safeExtension(suggestedFilename);
    const baseName = `SCENE_${String(job.sceneNumber).padStart(4, '0')}`;
    let version = 1;
    while (true) {
      const fileName = version === 1 ? `${baseName}${extension}` : `${baseName}_v${version}${extension}`;
      const finalPath = path.join(outputDir, fileName);
      if (!fs.existsSync(finalPath) && !fs.existsSync(`${finalPath}.part`)) return { finalPath, fileName };
      version += 1;
    }
  }

  private prepareTarget(jobId: string, suggestedFilename?: string) {
    const job = this.jobs.getById(jobId);
    if (!job) throw new NotFoundError('Job not found.');
    const { finalPath } = this.reserveOutputPath(job, suggestedFilename);
    const temporaryPath = `${finalPath}.part`;
    if (fs.existsSync(temporaryPath)) throw new ConflictError('Temporary output file already exists.');
    return { job, finalPath, temporaryPath };
  }

  private startTracker(jobId: string, temporaryPath: string, finalPath: string): DownloadTracker {
    const tracker: DownloadTracker = {
      id: randomUUID(),
      jobId,
      temporaryFile: temporaryPath,
      finalOutputFile: finalPath,
      status: 'PENDING',
      bytes: 0,
      startedAt: new Date().toISOString(),
      completedAt: null,
    };
    this.trackers.set(jobId, tracker);
    return tracker;
  }

  private finalize(
    job: JobRecord,
    temporaryPath: string,
    finalPath: string,
    tracker: DownloadTracker,
  ): OutputRecord {
    tracker.status = 'VERIFYING';
    this.assertValidFile(temporaryPath);
    fs.renameSync(temporaryPath, finalPath);
    const probe = probeMediaFile(finalPath);
    try {
      const output = this.database.transaction(() => {
        const record = this.outputs.create({
          jobId: job.id,
          filePath: finalPath,
          fileName: path.basename(finalPath),
          durationSeconds: probe.durationSeconds,
          width: probe.width,
          height: probe.height,
          fps: probe.fps,
          videoCodec: probe.videoCodec,
          audioCodec: probe.audioCodec,
          fileSize: probe.fileSize,
          checksumSha256: probe.checksumSha256,
        });
        this.database
          .prepare(
            "UPDATE jobs SET status='COMPLETED',progress=100,completed_at=?,updated_at=? WHERE id=?",
          )
          .run(new Date().toISOString(), new Date().toISOString(), job.id);
        return record;
      })();
      tracker.status = 'COMPLETED';
      tracker.bytes = probe.fileSize;
      tracker.completedAt = new Date().toISOString();
      return output;
    } catch (error) {
      tracker.status = 'FAILED';
      tracker.error = error instanceof Error ? error.message : 'Failed to record output.';
      this.cleanupFile(finalPath);
      throw error;
    }
  }

  private outputDirectory(projectId: string): string {
    return path.join(this.projectsDir, projectId, 'outputs');
  }

  private safeExtension(suggestedFilename?: string): string {
    const extension = suggestedFilename ? path.extname(suggestedFilename).toLowerCase() : '';
    return VIDEO_EXTENSIONS.has(extension) ? extension : '.mp4';
  }

  private assertValidFile(filePath: string): void {
    if (!fs.existsSync(filePath)) throw new Error('Downloaded file does not exist.');
    if (this.fileSize(filePath) <= 0) throw new Error('Downloaded file is empty.');
  }

  private fileSize(filePath: string): number {
    return fs.statSync(filePath).size;
  }

  private cleanupFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      // The failed download remains visible for operator inspection if cleanup cannot remove it.
    }
  }
}
