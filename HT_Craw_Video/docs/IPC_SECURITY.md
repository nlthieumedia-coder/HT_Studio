# IPC and security

BrowserWindow bật `contextIsolation`, tắt `nodeIntegration`, bật sandbox/CSP. Preload chỉ expose allowlist hẹp. Main process validate payload bằng Zod; renderer không có shell/database. Subprocess dùng `spawn`/`execFile` với args array và `shell:false` mặc định. URL chỉ HTTP(S), file được canonicalize trước khi mở, worker bị kill khi app đóng và AbortController thực hiện cancel.
