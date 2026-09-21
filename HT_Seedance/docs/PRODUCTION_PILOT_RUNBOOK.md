# Production Pilot Runbook

Không tự chuyển cấp:

1. 1 job live smoke được operator xác nhận.
2. 10 jobs / 1 worker → review.
3. 25 jobs / 1 worker → review.
4. 50 jobs / 1–2 workers theo policy → review và restart recovery.
5. 100 jobs / worker count an toàn → review.

Trước mỗi cấp: verified backup, Preflight `READY`, đủ disk, account authenticated, provider circuit closed, FFprobe/browser ready. Dừng tăng cấp nếu có P0/P1, duplicate/lost, output invalid lọt qua hoặc provider không chắc chắn.
