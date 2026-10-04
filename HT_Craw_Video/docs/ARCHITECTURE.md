# Architecture

Renderer React chỉ gọi typed preload API. Electron main validate IPC bằng Zod, sở hữu SQLite/Drizzle, connector, job orchestration và subprocess. `MediaAnalysisEngine` phối hợp FFprobe/FFmpeg, fingerprint, cache và Python JSONL worker. Candidate retrieval giảm 100–300 ứng viên trước deep-analysis; fallback hiện tại xếp hạng cosine/fingerprint trong process và không crash khi HNSWlib không có.

Luồng: import → SHA-256/dedup → metadata → thumbnail/keyframes/audio fingerprint → SQLite/cache. Search → phân tích mẫu → cheap candidate filter → optional local AI cho top candidates → weighted ranking → evidence/results.
