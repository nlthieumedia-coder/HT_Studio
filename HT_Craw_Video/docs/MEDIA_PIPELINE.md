# Media pipeline

1. FFprobe: duration, resolution, FPS, codec, audio, size.
2. SHA-256, sampled keyframe hash và first-4MB audio hash.
3. 8 keyframes 480px; không scan từng frame.
4. Candidate retrieval tối đa 100 (Fast) hoặc 300 (Balanced/Deep).
5. Worker tùy chọn: faster-whisper, Tesseract OCR, OpenCLIP, multilingual text embedding.
6. Ranking dùng trọng số trong `src/shared/constants/defaults.ts`.

Cache key gồm content hash + pipeline version + model version. Missing FFmpeg/model trả lỗi thật; unit tests dùng logic thuần, không giả kết quả AI.
