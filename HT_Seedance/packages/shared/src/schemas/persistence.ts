import { z } from 'zod';
import { JobState } from '../enums/job-state.js';

export const VIDEO_PROVIDERS = ['dola', 'mock'] as const;
export const VIDEO_DURATIONS = [5, 10, 15, 20, 30] as const;
export const VIDEO_ASPECT_RATIOS = ['9:16', '16:9', '1:1', '4:5'] as const;
export const VIDEO_RESOLUTIONS = ['480p', '720p', '1080p'] as const;
export const DEFAULT_PROJECT_SETTINGS = { provider: 'dola', durationSeconds: 30, aspectRatio: '9:16', resolution: '720p' } as const;
export const formatSceneNumber = (sceneNumber: number): string => `SCENE_${String(sceneNumber).padStart(4, '0')}`;
const VideoDurationSchema = z.number().int().refine((value) => VIDEO_DURATIONS.includes(value as typeof VIDEO_DURATIONS[number]), 'Unsupported video duration.');

export const ProjectStatusSchema = z.enum(['ACTIVE', 'ARCHIVED']);
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const BrowserProfileStatusSchema = z.enum(['AVAILABLE', 'IN_USE', 'DISABLED', 'ERROR']);
export type BrowserProfileStatus = z.infer<typeof BrowserProfileStatusSchema>;

export const AccountSessionStatusSchema = z.enum(['UNKNOWN', 'AUTHENTICATED', 'LOGIN_REQUIRED', 'ERROR']);
export type AccountSessionStatus = z.infer<typeof AccountSessionStatusSchema>;

export const WorkerStateSchema = z.enum(['IDLE', 'STARTING', 'BUSY', 'WAITING', 'STOPPING', 'STOPPED', 'OFFLINE', 'ERROR']);
export type WorkerState = z.infer<typeof WorkerStateSchema>;

export const InputMediaSchema = z.object({
  image: z.string().min(1).optional(),
  video: z.string().min(1).optional(),
  audio: z.string().min(1).optional(),
});
export type InputMedia = z.infer<typeof InputMediaSchema>;

export const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const ProjectCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).default(''),
  outputDirectory: z.string().trim().max(1000).nullable().optional(),
  defaultProvider: z.enum(VIDEO_PROVIDERS).default(DEFAULT_PROJECT_SETTINGS.provider),
  defaultDurationSeconds: VideoDurationSchema.default(DEFAULT_PROJECT_SETTINGS.durationSeconds),
  defaultAspectRatio: z.enum(VIDEO_ASPECT_RATIOS).default(DEFAULT_PROJECT_SETTINGS.aspectRatio),
  defaultResolution: z.enum(VIDEO_RESOLUTIONS).default(DEFAULT_PROJECT_SETTINGS.resolution),
});
export const ProjectUpdateSchema = ProjectCreateSchema.partial().refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

export const AccountCreateSchema = z.object({
  displayName: z.string().trim().min(1).max(160),
  provider: z.string().trim().refine((value) => VIDEO_PROVIDERS.includes(value.toLowerCase() as typeof VIDEO_PROVIDERS[number]), 'Unsupported video provider.'),
  browserProfileId: z.string().uuid().nullable().optional(),
  enabled: z.boolean().default(true),
});
export const AccountUpdateSchema = AccountCreateSchema.partial().refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

export const JobCreateSchema = z.object({
  projectId: z.string().uuid(),
  sceneNumber: z.number().int().positive(),
  provider: z.string().trim().min(1).max(80),
  accountId: z.string().uuid().nullable().optional(),
  prompt: z.string().trim().min(1).max(20000),
  inputMedia: InputMediaSchema.default({}),
  durationSeconds: VideoDurationSchema.default(DEFAULT_PROJECT_SETTINGS.durationSeconds),
  aspectRatio: z.enum(VIDEO_ASPECT_RATIOS).default(DEFAULT_PROJECT_SETTINGS.aspectRatio),
  resolution: z.string().trim().refine((value) => VIDEO_RESOLUTIONS.includes(value as typeof VIDEO_RESOLUTIONS[number]), 'Unsupported video resolution.').default(DEFAULT_PROJECT_SETTINGS.resolution),
  status: z.nativeEnum(JobState).default(JobState.DRAFT),
  priority: z.number().int().min(-1000).max(1000).default(0),
  maxAttempts: z.number().int().positive().max(100).default(3),
});
export const JobUpdateSchema = JobCreateSchema.omit({ projectId: true }).partial().refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

export const JobListQuerySchema = PaginationSchema.extend({
  project: z.string().uuid().optional(),
  status: z.nativeEnum(JobState).optional(),
  account: z.string().uuid().optional(),
  provider: z.string().trim().min(1).optional(),
  aspectRatio: z.enum(VIDEO_ASPECT_RATIOS).optional(),
  search: z.string().trim().max(200).optional(),
});
export const ProjectListQuerySchema = PaginationSchema.extend({
  status: ProjectStatusSchema.optional(),
  search: z.string().trim().max(200).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'name']).default('createdAt'),
  sortDirection: z.enum(['asc', 'desc']).default('desc'),
});

export const JobIdListSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(1000) });
export const BulkJobUpdateSchema = JobIdListSchema.extend({
  changes: z.object({ provider: z.enum(VIDEO_PROVIDERS).optional(), durationSeconds: JobCreateSchema.shape.durationSeconds.optional(), aspectRatio: z.enum(VIDEO_ASPECT_RATIOS).optional(), resolution: z.enum(VIDEO_RESOLUTIONS).optional() }).refine((value) => Object.keys(value).length > 0, 'At least one change is required.'),
});
export const JobReorderSchema = z.object({ direction: z.enum(['up', 'down']) });
export const ProjectDeleteSchema = z.object({ confirmRecords: z.preprocess((value) => value === 'true' || value === true ? true : value, z.literal(true).optional()) });
export const AccountListQuerySchema = PaginationSchema.extend({
  sessionStatus: AccountSessionStatusSchema.optional(),
  provider: z.string().trim().min(1).optional(),
  search: z.string().trim().max(200).optional(),
});

export type ProjectCreateInput = z.input<typeof ProjectCreateSchema>;
export type ProjectUpdateInput = z.infer<typeof ProjectUpdateSchema>;
export type AccountCreateInput = z.infer<typeof AccountCreateSchema>;
export type AccountUpdateInput = z.infer<typeof AccountUpdateSchema>;
export type JobCreateInput = z.infer<typeof JobCreateSchema>;
export type JobUpdateInput = z.infer<typeof JobUpdateSchema>;
export type JobListQuery = z.infer<typeof JobListQuerySchema>;
export type ProjectListQuery = z.infer<typeof ProjectListQuerySchema>;
export type AccountListQuery = z.infer<typeof AccountListQuerySchema>;
