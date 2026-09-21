# Known Issues — v1.0.0 Internal Release

## P0

Không có.

## P1

Không có.

## P2

Không có.

## P3

### KI-2026-09-21-001 — Installer chưa ký số

- Severity: P3
- Status: ACCEPTED_KNOWN_LIMITATION
- Impact: Windows SmartScreen có thể cảnh báo; bản build không đủ điều kiện public distribution theo policy mặc định.
- Workaround: Chỉ phân phối qua kênh nội bộ được kiểm soát và xác minh SHA-256 trước khi chạy.
- Release blocking: No — chỉ áp dụng cho INTERNAL / PRIVATE release.

### KI-2026-09-21-002 — Clean Windows VM lifecycle chưa thực thi

- Severity: P3
- Status: DEFERRED_NON_BLOCKING / ENVIRONMENT_LIMITATION
- Impact: Install, upgrade, uninstall và reinstall chưa được chứng minh trên một Windows VM sạch độc lập.
- Workaround: Chạy `scripts/test-windows-release-lifecycle.ps1`, sau đó thực hiện checklist clean-VM trong `docs/RELEASE_POLICY.md` trước public distribution.
- Release blocking: No — packaged artifact, metadata, checksum, runtime resources và path audit đã PASS cho internal release.

### KI-2026-09-21-003 — Authorized live Dola smoke validation bị hoãn

- Severity: P3
- Status: DEFERRED_NON_BLOCKING
- Impact: Chưa có bằng chứng end-to-end từ provider thật cho lần closure này.
- Workaround: Operator dùng phiên được ủy quyền để chạy đúng một smoke workflow tối thiểu; không stress, bypass hoặc tự động tạo tài khoản.
- Release blocking: No — local fixtures, provider safe-failure và MockVideoProvider là release validation cho internal release.

### KI-2026-09-21-004 — Soak 2 giờ và 6 giờ chưa chạy

- Severity: P3
- Status: DEFERRED_NON_BLOCKING
- Impact: Chưa có dữ liệu qualification dài hạn 2–6 giờ.
- Workaround: Chạy `pnpm test:soak -- --duration=2h` hoặc `--duration=6h` trên workstation mục tiêu.
- Release blocking: No — soak bắt buộc 30 phút đã PASS 195 chu kỳ, không duplicate/lost/orphan.
