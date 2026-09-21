import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { JobState, type BrowserProfile, type Job, type JobInput, type JobOutput } from '@ht-dola/shared';
import type {
  ProviderJobStatusResult,
  ProviderJobSubmissionResult,
  ProviderSessionValidation,
} from '@ht-dola/shared';
import { BaseProvider } from '../base/base-provider.js';

type MockStatus = 'SUBMITTED' | 'GENERATING' | 'COMPLETED' | 'FAILED';

interface MockJobState {
  jobId: string;
  submittedAt: number;
  status: MockStatus;
  polls: number;
}

const tinyMp4LikePayload = Buffer.from([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32,
  0x00, 0x00, 0x00, 0x00, 0x6d, 0x70, 0x34, 0x32, 0x69, 0x73, 0x6f, 0x6d,
  0x00, 0x00, 0x00, 0x08, 0x66, 0x72, 0x65, 0x65, 0x00, 0x00, 0x00, 0x10,
  0x6d, 0x64, 0x61, 0x74, 0x48, 0x54, 0x5f, 0x44, 0x4f, 0x4c, 0x41, 0x5f,
  0x52, 0x43, 0x31, 0x0a,
]);

export class MockVideoProvider extends BaseProvider {
  readonly id = 'mock';
  readonly name = 'Mock Video Provider';
  readonly version = '1.0.0';
  private readonly jobs = new Map<string, MockJobState>();

  override async initialize(_profile: BrowserProfile): Promise<void> {
    return Promise.resolve();
  }

  override async validateSession(_profile: BrowserProfile): Promise<ProviderSessionValidation> {
    return { isValid: true, userEmail: 'mock@local.test', quotaRemaining: 1_000_000 };
  }

  override async prepareJob(_job: Job, input: JobInput): Promise<void> {
    if (!input.prompt.trim()) throw new Error('Mock provider requires a prompt.');
    for (const mediaPath of [input.referenceVideo, input.referenceAudio, ...input.referenceImages].filter(Boolean)) {
      if (mediaPath && !fs.existsSync(mediaPath)) throw new Error(`Input media does not exist: ${mediaPath}`);
    }
  }

  override async submit(job: Job, input: JobInput): Promise<ProviderJobSubmissionResult> {
    await this.prepareJob(job, input);
    const externalJobId = `mock-${job.id}-${randomUUID()}`;
    this.jobs.set(externalJobId, {
      jobId: job.id,
      submittedAt: Date.now(),
      status: 'SUBMITTED',
      polls: 0,
    });
    return {
      externalJobId,
      initialState: JobState.GENERATING,
      metadata: { provider: this.id, dryRun: true, promptLength: input.prompt.length },
    };
  }

  override async checkStatus(externalJobId: string): Promise<ProviderJobStatusResult> {
    const state = this.jobs.get(externalJobId);
    if (!state) return { externalJobId, state: JobState.INTERRUPTED, errorMessage: 'Unknown mock job.' };
    state.polls += 1;
    state.status = state.polls >= 2 ? 'COMPLETED' : 'GENERATING';
    return {
      externalJobId,
      state: state.status === 'COMPLETED' ? JobState.DOWNLOADING : JobState.GENERATING,
      progressPercent: state.status === 'COMPLETED' ? 95 : Math.min(90, state.polls * 35),
    };
  }

  override async downloadResult(externalJobId: string, targetPath: string): Promise<JobOutput> {
    const state = this.jobs.get(externalJobId);
    if (!state) throw new Error('Unknown mock job.');
    if (state.status !== 'COMPLETED') throw new Error('Mock job is not complete.');
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, tinyMp4LikePayload);
    const stats = fs.statSync(targetPath);
    return {
      id: randomUUID(),
      jobId: state.jobId,
      filePath: targetPath,
      fileSize: stats.size,
      mimeType: 'video/mp4',
      createdAt: new Date().toISOString(),
    };
  }

  override async cleanup(): Promise<void> {
    this.jobs.clear();
  }
}
