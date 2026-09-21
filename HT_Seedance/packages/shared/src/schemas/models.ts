import { z } from 'zod';
import { JobState } from '../enums/job-state.js';

export const JobStateSchema = z.nativeEnum(JobState);

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const JobInputSchema = z.object({
  prompt: z.string().min(1),
  negativePrompt: z.string().optional(),
  aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:3', '3:4']).default('16:9'),
  durationSeconds: z.number().int().positive().default(5),
  referenceImages: z.array(z.string()).default([]),
  referenceVideo: z.string().optional(),
  referenceAudio: z.string().optional(),
  extraParams: z.record(z.unknown()).default({}),
});

export const JobOutputSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  filePath: z.string(),
  fileSize: z.number().int().nonnegative(),
  duration: z.number().optional(),
  mimeType: z.string().default('video/mp4'),
  resolution: z.string().optional(),
  thumbnailPath: z.string().optional(),
  createdAt: z.string().datetime(),
});

export const JobAttemptSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  attemptNumber: z.number().int().positive(),
  status: JobStateSchema,
  workerId: z.string().optional(),
  errorMessage: z.string().optional(),
  errorStack: z.string().optional(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
});

export const JobSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  providerId: z.string(),
  accountId: z.string().optional(),
  profileId: z.string().optional(),
  state: JobStateSchema,
  input: JobInputSchema,
  priority: z.number().int().default(0),
  retryCount: z.number().int().nonnegative().default(0),
  maxRetries: z.number().int().nonnegative().default(3),
  output: JobOutputSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
});

export const AccountSchema = z.object({
  id: z.string().uuid(),
  providerId: z.string(),
  email: z.string().email(),
  alias: z.string().optional(),
  profileId: z.string(),
  isAuthenticated: z.boolean().default(false),
  lastAuthenticatedAt: z.string().datetime().optional(),
  quotaUsage: z.record(z.unknown()).default({}),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const BrowserProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  storagePath: z.string(),
  userAgent: z.string().optional(),
  viewport: z.object({ width: z.number(), height: z.number() }).default({ width: 1280, height: 720 }),
  isLocked: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const ProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  isEnabled: z.boolean().default(true),
  supportedAspectRatios: z.array(z.string()),
  maxDurationSeconds: z.number(),
  requiresAuth: z.boolean().default(true),
});

export const WorkerSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  status: z.enum(['IDLE', 'BUSY', 'OFFLINE', 'ERROR']),
  currentJobId: z.string().uuid().optional(),
  profileId: z.string().optional(),
  startedAt: z.string().datetime(),
  lastHeartbeatAt: z.string().datetime(),
});

export const ApplicationSettingsSchema = z.object({
  dataDirectory: z.string(),
  downloadsDirectory: z.string(),
  maxConcurrentJobs: z.number().int().positive().default(2),
  autoDownloadResults: z.boolean().default(true),
  ffmpegPath: z.string().optional(),
  logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  servicePort: z.number().int().positive().default(3001),
  serviceHost: z.string().default('127.0.0.1'),
});

export const LogEntrySchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  level: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']),
  module: z.string(),
  message: z.string(),
  context: z.record(z.unknown()).optional(),
});

export type Project = z.infer<typeof ProjectSchema>;
export type JobInput = z.infer<typeof JobInputSchema>;
export type JobOutput = z.infer<typeof JobOutputSchema>;
export type JobAttempt = z.infer<typeof JobAttemptSchema>;
export type Job = z.infer<typeof JobSchema>;
export type Account = z.infer<typeof AccountSchema>;
export type BrowserProfile = z.infer<typeof BrowserProfileSchema>;
export type Provider = z.infer<typeof ProviderSchema>;
export type Worker = z.infer<typeof WorkerSchema>;
export type ApplicationSettings = z.infer<typeof ApplicationSettingsSchema>;
export type LogEntry = z.infer<typeof LogEntrySchema>;
