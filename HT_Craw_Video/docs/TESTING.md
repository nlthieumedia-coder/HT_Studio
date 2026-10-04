# Testing

Chạy `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd test`, `npm.cmd run build`, `npm.cmd run package`. Unit tests bao phủ import manifest/folder, SHA-256, URL/path security, vector fallback và bốn ranking mode. Integration với FFmpeg/Python cần binary/model local; nếu thiếu phải skip/báo lỗi rõ, không fake thành công.
