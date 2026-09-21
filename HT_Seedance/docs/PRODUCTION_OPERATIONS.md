# Production Operations

1. Tạo backup đã xác minh và kiểm tra System Health.
2. Chỉ chọn job `QUEUED` hoặc `FAILED` đủ điều kiện rồi tạo Production Run.
3. Giữ Pilot Mode mặc định: 10 jobs, 1 worker, 1 active job. Chạy Preflight và chỉ Start khi `READY`.
4. Theo dõi status, workers, accounts, provider circuit, timeline, stuck jobs và thống kê; ETA chỉ là ước tính.
5. **Pause After Current** ngăn cấp job mới. **Stop Production** chuyển sang `STOPPING`, không đánh dấu trạng thái chưa rõ là failed.
6. `LOGIN_REQUIRED` cô lập account. Circuit mở chuyển run sang `PAUSED_PROVIDER_INCIDENT`; điều tra trước khi resume.
7. Không retry mù `FORM_CHANGED`, `AMBIGUOUS_CONTROL`, `LOGIN_REQUIRED`, `MODEL_NOT_AVAILABLE`, `SUBMISSION_STATE_UNKNOWN`.
8. Sau restart, run hoạt động thành `INTERRUPTED`; chỉ recover queue an toàn và review job không chắc chắn.
9. Tạo manifest, failed CSV và support bundle. Bundle không chứa cookie, token, mật khẩu, profile hoặc session storage.
10. Live smoke chỉ do operator khởi chạy bằng phiên được ủy quyền, một workflow tối thiểu.
