# Windows deployment

Yêu cầu Node.js 20+, FFmpeg/FFprobe và tùy chọn Python 3.10+. Dùng `npm.cmd` nếu PowerShell chặn `npm.ps1`. `npm.cmd run package` tạo unpacked Windows app trong `release/`; worker Python được copy vào resources. Bản phân phối đầy đủ nên bundle Python/model hoặc hướng dẫn đường dẫn trong Settings. Code signing chưa được cấu hình.
