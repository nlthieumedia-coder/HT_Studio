import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { appConfig } from '../config/app-config.js';
import type { SqliteDatabase } from '../db/database.js';
import type { OutputRecord } from '../db/types.js';
import { JobRepository } from '../db/repositories/JobRepository.js';
import { OutputRepository } from '../db/repositories/OutputRepository.js';
import { ProjectRepository } from '../db/repositories/ProjectRepository.js';
import { ConflictError, NotFoundError, ValidationError } from '../api/errors.js';
import { faststartMp4, mediaToolDiagnostics, probeMediaFile } from './MediaToolkit.js';

const safeName = (name: string) => {
  const clean = path.basename(name.trim());
  if (!clean || clean.includes('..')) throw new ValidationError('Invalid file name.');
  return clean;
};

const ensureNoOverwrite = (target: string) => {
  if (fs.existsSync(target)) throw new ConflictError('Target file already exists.');
};

export class MediaOutputManager {
  private readonly outputs: OutputRepository;
  private readonly jobs: JobRepository;
  private readonly projects: ProjectRepository;

  constructor(database: SqliteDatabase) {
    this.outputs = new OutputRepository(database);
    this.jobs = new JobRepository(database);
    this.projects = new ProjectRepository(database);
  }

  diagnostics() {
    return mediaToolDiagnostics();
  }

  probe(outputId: string): OutputRecord {
    const output = this.require(outputId);
    const metadata = probeMediaFile(output.filePath);
    return this.outputs.updateFileMetadata(output.id, {
      ...output,
      fileSize: metadata.fileSize,
      checksumSha256: metadata.checksumSha256,
      durationSeconds: metadata.durationSeconds,
      width: metadata.width,
      height: metadata.height,
      fps: metadata.fps,
      videoCodec: metadata.videoCodec,
      audioCodec: metadata.audioCodec,
    })!;
  }

  rename(outputId: string, fileName: string): OutputRecord {
    const output = this.require(outputId);
    const targetName = safeName(fileName);
    const target = path.join(path.dirname(output.filePath), targetName);
    ensureNoOverwrite(target);
    fs.renameSync(output.filePath, target);
    return this.refreshPath(output, target);
  }

  move(outputId: string, targetDirectory: string): OutputRecord {
    const output = this.require(outputId);
    const targetDir = path.resolve(targetDirectory);
    fs.mkdirSync(targetDir, { recursive: true });
    const target = path.join(targetDir, output.fileName);
    ensureNoOverwrite(target);
    fs.renameSync(output.filePath, target);
    return this.refreshPath(output, target);
  }

  copy(outputId: string, targetDirectory: string): OutputRecord {
    const output = this.require(outputId);
    const targetDir = path.resolve(targetDirectory);
    fs.mkdirSync(targetDir, { recursive: true });
    const target = path.join(targetDir, output.fileName);
    ensureNoOverwrite(target);
    fs.copyFileSync(output.filePath, target, fs.constants.COPYFILE_EXCL);
    return this.outputs.create({
      jobId: output.jobId,
      filePath: target,
      fileName: path.basename(target),
      durationSeconds: output.durationSeconds,
      width: output.width,
      height: output.height,
      fps: output.fps,
      videoCodec: output.videoCodec,
      audioCodec: output.audioCodec,
      fileSize: output.fileSize,
      checksumSha256: output.checksumSha256,
    });
  }

  openContainingFolder(outputId: string): { opened: boolean; folder: string } {
    const output = this.require(outputId);
    const folder = path.dirname(output.filePath);
    if (process.platform === 'win32') spawn('explorer.exe', [folder], { detached: true, stdio: 'ignore' }).unref();
    else if (process.platform === 'darwin') spawn('open', [folder], { detached: true, stdio: 'ignore' }).unref();
    else spawn('xdg-open', [folder], { detached: true, stdio: 'ignore' }).unref();
    return { opened: true, folder };
  }

  normalizeFaststart(outputId: string): OutputRecord {
    const output = this.require(outputId);
    if (path.extname(output.filePath).toLowerCase() !== '.mp4')
      throw new ValidationError('Faststart normalization is only supported for MP4 files.');
    const temp = `${output.filePath}.faststart.part`;
    ensureNoOverwrite(temp);
    if (!faststartMp4(output.filePath, temp)) {
      if (fs.existsSync(temp)) fs.rmSync(temp, { force: true });
      throw new Error('FFmpeg faststart normalization failed.');
    }
    fs.renameSync(temp, output.filePath);
    return this.probe(output.id);
  }

  exportProjectManifest(projectId: string): { path: string; scenes: number } {
    const project = this.projects.getById(projectId);
    if (!project) throw new NotFoundError('Project not found.');
    const jobs = this.jobs.list({ project: projectId, limit: 1000, offset: 0 }).items;
    const manifestPath = path.join(appConfig.projectsDir, projectId, 'project.json');
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    const manifest = {
      exportedAt: new Date().toISOString(),
      project,
      scenes: jobs.map((job) => ({
        scene: job.sceneNumber,
        prompt: job.prompt,
        inputPaths: job.inputMedia,
        outputPath: this.outputs.getByJob(job.id)[0]?.filePath ?? null,
        generationMetadata: job.providerMetadata,
        status: job.status,
      })),
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    return { path: manifestPath, scenes: jobs.length };
  }

  private refreshPath(output: OutputRecord, target: string): OutputRecord {
    const metadata = probeMediaFile(target);
    return this.outputs.updateFileMetadata(output.id, {
      jobId: output.jobId,
      filePath: target,
      fileName: path.basename(target),
      durationSeconds: metadata.durationSeconds,
      width: metadata.width,
      height: metadata.height,
      fps: metadata.fps,
      videoCodec: metadata.videoCodec,
      audioCodec: metadata.audioCodec,
      fileSize: metadata.fileSize,
      checksumSha256: metadata.checksumSha256,
    })!;
  }

  private require(outputId: string): OutputRecord {
    const output = this.outputs.getById(outputId);
    if (!output) throw new NotFoundError('Output not found.');
    if (!fs.existsSync(output.filePath)) throw new NotFoundError('Output file not found.');
    return output;
  }
}
