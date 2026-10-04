# Implementation status

## 2026-09-18 — rebuild 2.0

- Phase 0–3: hoàn tất scaffold, config, database/migration, typed IPC, dataset import/dedup, FFmpeg metadata/thumbnail/keyframes, fingerprints và versioned cache.
- Phase 4: JSONL worker có adapter thật cho faster-whisper, Tesseract, OpenCLIP, text embedding; cosine fallback có sẵn. Máy kiểm thử hiện chưa nhận Python trong PATH.
- Phase 5–6: UI search, progress/cancel, 4 modes, ranking/evidence, feedback, CSV/XLSX và dashboard/settings đã nối IPC thật.
- Phase 7: lint, typecheck, 11 unit tests, production build, Windows unpacked package, launch smoke test và `npm audit --omit=dev` (0 vulnerability) đều pass. Facebook/Instagram đúng chủ đích `NOT_CONNECTED`; không có platform-wide discovery.

## Phase A — Python worker và vector retrieval

- Python 3.11.9 được dùng qua `.venv`; runtime detection theo `HT_PYTHON_BIN` → `.venv` → `py -3` → `python` → `python3`.
- JSONL worker thật đã pass ping và OCR; thiếu model Whisper/OpenCLIP trả `DEPENDENCY_MISSING`, không tự tải model.
- HNSWlib không build trên Windows vì thiếu MSVC Build Tools, nên hệ thống dùng exact cosine `VectorIndex` thật.
- Vector retrieval đã nối sau cheap fingerprint ranking; cache key gồm content hash, model version và vector dimension.
- 21/21 unit tests, lint, typecheck và build pass. Smoke test import/index/exact/vector/export pass.
