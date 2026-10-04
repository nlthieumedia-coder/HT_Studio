import { z } from "zod";
export const idSchema = z.string().uuid();
export const controlSchema = z.object({
  id: idSchema,
  action: z.enum(["pause", "resume", "cancel", "reindex", "delete"]),
});
export const searchSchema = z.object({
  sourceFile: z.string().min(1),
  datasetIds: z.array(idSchema).min(1),
  mode: z.enum([
    "EXACT_MATCH",
    "NEAR_DUPLICATE",
    "SEMANTIC_SIMILARITY",
    "FORMAT_SIMILARITY",
  ]),
  limit: z.number().int().min(1).max(200),
  level: z.enum(["fast", "balanced", "deep"]),
  enableWhisper: z.boolean(),
  enableOcr: z.boolean(),
});
export const exportSchema = z.object({
  jobId: idSchema,
  format: z.enum(["csv", "xlsx"]),
});
export const feedbackSchema = z.object({
  resultId: idSchema,
  value: z.enum(["relevant", "not_relevant"]),
});
export const settingsSchema = z.object({
  ffmpegPath: z.string().min(1),
  ffprobePath: z.string().min(1),
  pythonPath: z.string().min(1),
  whisperModel: z.string().min(1),
  ocrModel: z.string().min(1),
  datasetFolder: z.string(),
  cacheFolder: z.string(),
  workers: z.number().int().min(1).max(16),
  deepCandidateLimit: z.number().int().min(1).max(100),
  deleteTempFiles: z.boolean(),
  computeMode: z.enum(["cpu", "gpu", "auto"]),
  modelCacheDirectory: z.string(),
});
export const safeUrlSchema = z
  .string()
  .url()
  .refine(
    (v) => ["http:", "https:"].includes(new URL(v).protocol),
    "Only HTTP(S) URLs are allowed",
  );
