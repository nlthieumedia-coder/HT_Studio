# HT Craw Video — FREE_LOCAL_MODE

Ứng dụng Electron tìm video trùng, gần trùng, cùng chủ đề hoặc cùng format trong dữ liệu người dùng sở hữu. Mọi phân tích chạy cục bộ; không dùng cloud AI, API trả phí, bypass đăng nhập/CAPTCHA/DRM, hay lưu mật khẩu.

> FREE_LOCAL_MODE chỉ tìm kiếm trong nguồn dữ liệu cục bộ hoặc nguồn do người dùng cung cấp. Không thể tìm toàn bộ Facebook/Instagram nếu không có dataset hay API được cấp quyền hợp lệ.

## Cài đặt Windows

1. Cài Node.js 20+, Python 3.10+ và FFmpeg; bảo đảm `node`, `python`, `ffmpeg`, `ffprobe` có trong PATH.
2. Chạy `npm.cmd install`.
3. Tùy nhu cầu AI local: `python -m venv .venv`, `.venv\Scripts\python -m pip install -r python-worker\requirements.txt`.
4. Chạy dev: `npm.cmd run dev`. Build: `npm.cmd run build`. Đóng gói: `npm.cmd run package`.

Mô hình Whisper/OpenCLIP/SentenceTransformer được tải vào bộ nhớ đệm cục bộ ở lần dùng đầu tiên (hoặc chép sẵn và chọn thư mục lưu mô hình). Có thể đổi đường dẫn Python và mô hình trong Cài đặt. Nếu tiến trình xử lý lỗi, kiểm tra đường dẫn Python, chạy trực tiếp `python -u python-worker\app\main.py`, rồi kiểm tra thư viện phụ thuộc; ứng dụng vẫn dùng quy trình FFmpeg/dấu vân tay và báo rõ bộ chuyển đổi chưa sẵn sàng.

## Sử dụng

Quản lý kho dữ liệu → Nhập thư mục/CSV/JSON → chờ lập chỉ mục hoàn tất. Tìm kiếm mới → chọn video mẫu, kho dữ liệu, một trong bốn chế độ và mức phân tích → Bắt đầu. Kết quả tìm kiếm hiển thị điểm/bằng chứng và cho phép xuất CSV/XLSX. CSV/JSON nhận các trường kỹ thuật `file_path`, `source_url`, `platform`, `account_name`, `account_url`, `caption`, `hashtags`, `published_at`.

Xem [FREE_LOCAL_MODE](docs/FREE_LOCAL_MODE.md), [kiến trúc](docs/ARCHITECTURE.md), [pipeline](docs/MEDIA_PIPELINE.md), [triển khai Windows](docs/DEPLOYMENT_WINDOWS.md) và [trạng thái](docs/IMPLEMENTATION_STATUS.md).
