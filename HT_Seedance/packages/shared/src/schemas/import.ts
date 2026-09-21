import { z } from 'zod';

export const ImportSourceTypeSchema=z.enum(['CSV','XLSX','TXT','FOLDER']);
export const ImportModeSchema=z.enum(['STRICT','LENIENT']);
export const SceneModeSchema=z.enum(['AUTO','USE_SOURCE','APPEND_AFTER_EXISTING']);
export const ImportFieldSchema=z.enum(['IGNORE','scene','prompt','image','video','audio','duration','aspectRatio','resolution','provider','priority','maxAttempts']);
export const ImportIssueCodeSchema=z.enum(['MISSING_PROMPT','INVALID_DURATION','INVALID_ASPECT_RATIO','INVALID_RESOLUTION','UNKNOWN_PROVIDER','MEDIA_FILE_NOT_FOUND','UNSUPPORTED_MEDIA','DUPLICATE_SCENE','SCENE_CONFLICT','INVALID_PATH','EMPTY_ROW','UNSUPPORTED_SOURCE']);
export const ImportAnalyzeSchema=z.object({sourceType:ImportSourceTypeSchema,sourcePath:z.string().trim().min(1).max(4000),sheet:z.string().trim().max(200).optional(),textMode:z.enum(['LINE','PARAGRAPH']).default('LINE'),includeSubfolders:z.boolean().default(false),mapping:z.record(ImportFieldSchema).optional(),sceneMode:SceneModeSchema.default('APPEND_AFTER_EXISTING'),mode:ImportModeSchema.default('STRICT')});
export const ImportCommitSchema=z.object({sessionId:z.string().uuid()});
export type ImportSourceType=z.infer<typeof ImportSourceTypeSchema>; export type ImportMode=z.infer<typeof ImportModeSchema>; export type SceneMode=z.infer<typeof SceneModeSchema>; export type ImportField=z.infer<typeof ImportFieldSchema>; export type ImportIssueCode=z.infer<typeof ImportIssueCodeSchema>; export type ImportAnalyzeInput=z.infer<typeof ImportAnalyzeSchema>;
export interface ImportValidationIssue{row:number;code:ImportIssueCode;message:string;severity:'ERROR'|'WARNING'}
export interface ImportPreviewRow{row:number;sceneNumber:number|null;prompt:string;image?:string|undefined;video?:string|undefined;audio?:string|undefined;durationSeconds:number;aspectRatio:string;resolution:string;provider:string;priority:number;status:'VALID'|'WARNING'|'ERROR'}
export interface ImportSession{ id:string;projectId:string;sourceType:ImportSourceType;sourcePath:string;sourceName:string;detectedColumns:string[];sheets?:Array<{name:string;rows:number;columns:string[]}>|undefined;mapping:Record<string,ImportField>;rows:ImportPreviewRow[];issues:ImportValidationIssue[];mode:ImportMode;sceneMode:SceneMode;createdAt:string;committedAt?:string; }
export interface ImportResult{sessionId:string;total:number;imported:number;skipped:number;warnings:number;errors:number}
