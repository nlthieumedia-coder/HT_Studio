import type { Settings } from '../types';
export const PIPELINE_VERSION='2.0.0';
export const MODEL_VERSION='local-v1';
export const FREE_LOCAL_NOTICE='Chế độ cục bộ miễn phí chỉ tìm kiếm trong dữ liệu trên máy hoặc nguồn do người dùng cung cấp.';
export const VIDEO_EXTENSIONS=new Set(['.mp4','.mov','.mkv','.webm','.avi','.m4v']);
export const DEFAULT_SETTINGS:Settings={ffmpegPath:'ffmpeg',ffprobePath:'ffprobe',pythonPath:'python',whisperModel:'small',ocrModel:'vie+eng',datasetFolder:'',cacheFolder:'',workers:2,deepCandidateLimit:30,deleteTempFiles:true,computeMode:'auto',modelCacheDirectory:''};
export const RANKING_WEIGHTS={semantic:{transcript:.45,caption:.25,visual:.20,ocr:.10},duplicate:{visual:.40,audio:.30,keyframe:.20,timeline:.10},format:{scene:.35,keyframe:.25,camera:.20,text:.10,audio:.10}} as const;
