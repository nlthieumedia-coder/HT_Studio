import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
export const datasets = sqliteTable("datasets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sourceType: text("source_type").notNull(),
  rootPath: text("root_path"),
  itemCount: integer("item_count").notNull().default(0),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
export const datasetItems = sqliteTable("dataset_items", {
  id: text("id").primaryKey(),
  datasetId: text("dataset_id")
    .notNull()
    .references(() => datasets.id, { onDelete: "cascade" }),
  filePath: text("file_path"),
  sourceUrl: text("source_url"),
  platform: text("platform"),
  accountName: text("account_name"),
  accountUrl: text("account_url"),
  caption: text("caption"),
  hashtags: text("hashtags"),
  publishedAt: text("published_at"),
  fileHash: text("file_hash"),
  duration: real("duration"),
  width: integer("width"),
  height: integer("height"),
  fps: real("fps"),
  thumbnailPath: text("thumbnail_path"),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
});
export const mediaFeatures = sqliteTable("media_features", {
  id: text("id").primaryKey(),
  datasetItemId: text("dataset_item_id")
    .notNull()
    .references(() => datasetItems.id, { onDelete: "cascade" }),
  perceptualHash: text("perceptual_hash"),
  audioFingerprint: text("audio_fingerprint"),
  transcript: text("transcript"),
  ocrText: text("ocr_text"),
  visualEmbeddingPath: text("visual_embedding_path"),
  textEmbeddingPath: text("text_embedding_path"),
  sceneJson: text("scene_json"),
  featureVersion: text("feature_version").notNull(),
  createdAt: text("created_at").notNull(),
});
export const searchJobs = sqliteTable("search_jobs", {
  id: text("id").primaryKey(),
  sourceFile: text("source_file").notNull(),
  searchMode: text("search_mode").notNull(),
  datasetIds: text("dataset_ids").notNull(),
  status: text("status").notNull(),
  progress: real("progress").notNull(),
  currentStep: text("current_step").notNull(),
  candidateCount: integer("candidate_count").notNull(),
  deepAnalysisCount: integer("deep_analysis_count").notNull(),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull(),
  completedAt: text("completed_at"),
});
export const matchResults = sqliteTable("match_results", {
  id: text("id").primaryKey(),
  searchJobId: text("search_job_id")
    .notNull()
    .references(() => searchJobs.id, { onDelete: "cascade" }),
  datasetItemId: text("dataset_item_id")
    .notNull()
    .references(() => datasetItems.id, { onDelete: "cascade" }),
  matchType: text("match_type").notNull(),
  totalScore: real("total_score").notNull(),
  visualScore: real("visual_score").notNull(),
  audioScore: real("audio_score").notNull(),
  transcriptScore: real("transcript_score").notNull(),
  ocrScore: real("ocr_score").notNull(),
  timelineScore: real("timeline_score").notNull(),
  evidenceJson: text("evidence_json").notNull(),
  confidence: text("confidence").notNull(),
  feedback: text("feedback"),
  createdAt: text("created_at").notNull(),
});
export const processingMetrics = sqliteTable("processing_metrics", {
  id: text("id").primaryKey(),
  jobId: text("job_id").notNull(),
  bytesRead: integer("bytes_read").notNull(),
  bytesWritten: integer("bytes_written").notNull(),
  processingSeconds: real("processing_seconds").notNull(),
  gpuSeconds: real("gpu_seconds").notNull(),
  modelCalls: integer("model_calls").notNull(),
  deepAnalysisCount: integer("deep_analysis_count").notNull(),
  createdAt: text("created_at").notNull(),
});
export const analysisCache = sqliteTable("analysis_cache", {
  id: text("id").primaryKey(),
  contentHash: text("content_hash").notNull(),
  sourcePath: text("source_path").notNull(),
  pipelineVersion: text("pipeline_version").notNull(),
  modelVersion: text("model_version").notNull(),
  metadataJson: text("metadata_json"),
  fingerprintJson: text("fingerprint_json"),
  transcriptJson: text("transcript_json"),
  ocrJson: text("ocr_json"),
  embeddingPath: text("embedding_path"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
