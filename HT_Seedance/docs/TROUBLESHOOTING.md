# Troubleshooting — HT Dola Studio 1.0.0

- **Automation OFFLINE:** mở lại ứng dụng, kiểm tra cổng loopback; service chỉ bind `127.0.0.1` và dùng token runtime.
- **Browser chưa sẵn sàng:** chạy kiểm tra/cài Chromium trong Settings/System Health.
- **FFmpeg lỗi:** cấu hình FFmpeg/FFprobe hợp lệ; đường dẫn sai chỉ tạo chẩn đoán, không làm app crash.
- **Job INTERRUPTED:** Inspect trước khi Retry để tránh gửi generation trùng.
- **Khôi phục:** dùng Maintenance/Recovery Mode và backup đã xác minh; không sửa SQLite thủ công.
- **SmartScreen:** bản 1.0.0 chưa ký số; chỉ chạy installer có SHA-256 khớp `SHA256SUMS.txt`.
