# HT Downloader v2.0.4

**HT Downloader** là ứng dụng Windows của **HT Studio** dùng để quét, quản lý và tải video từ TikTok, YouTube, Facebook, Instagram, X/Twitter, Reddit, Douyin, Bilibili và nhiều website video khác.

> Chỉ tải nội dung bạn sở hữu hoặc được phép sử dụng. Người dùng có trách nhiệm tuân thủ điều khoản của nền tảng và quy định bản quyền.

## Tải phiên bản mới nhất

- **Bộ cài Windows 64-bit:** [Tải `install.exe`](./Setup/install.exe?raw=1)
- **Phiên bản:** `v2.0.4`
- **SHA-256:** `8CF382386183B7AD98B0DC478E5D379D6B213060BF02D6542B0331A60DD2278C`
- **Hướng dẫn đầy đủ:** [HUONG_DAN_SU_DUNG.md](./HUONG_DAN_SU_DUNG.md)

## Điểm nổi bật

- **Đa nền tảng mạnh mẽ**: Tải video chất lượng cao từ hơn 1.000+ trang web và mạng xã hội lớn (TikTok, YouTube, Facebook, Instagram, X/Twitter, Reddit, Douyin...).
- **Chuyên sâu TikTok**: Hỗ trợ quét hàng loạt video từ link profile / kênh qua `@username`, giải mã `secUid`, trích xuất video gốc sắc nét không dính logo watermark.
- **Tải hàng loạt đa luồng**: Nhập danh sách nhiều liên kết cùng lúc (mỗi dòng một liên kết), hỗ trợ nút dán nhanh từ clipboard.
- **Tùy chỉnh giới hạn quét**: Cho phép chọn số lượng video mới nhất cần quét theo kênh (5, 10, 15, 20, 30, 50 video).
- **Chất lượng gốc cao nhất**: Tự động ghép nối video và âm thanh độ nét cao, xuất định dạng chuẩn MP4 tương thích mọi thiết bị.
- **Quản lý danh sách trực quan**: Bộ lọc thông minh (*Tất cả, Chờ tải, Hoàn tất, Lỗi*) cùng thanh tìm kiếm và hiển thị tiến trình tải trực tiếp.
- **Phím tắt tiện lợi**: `Ctrl + A` để chọn tất cả video, phím `Delete` để hủy chọn nhanh.
- **Kết nối TikTok và Instagram**: Mở cửa sổ đăng nhập riêng, lưu phiên cục bộ và tự khôi phục phiên sau khi mở lại ứng dụng.
- **Bản quyền an toàn**: Khóa cứng bản quyền theo mã phần cứng thiết bị (HWID).
- **Hỗ trợ kỹ thuật 24/7**: Tích hợp sẵn hộp thoại kết nối hỗ trợ trực tiếp qua mã QR Zalo và Telegram.

## Yêu cầu hệ thống

- Hệ điều hành: Windows 10 / Windows 11 (64-bit).
- Kết nối Internet ổn định.
- Dung lượng ổ đĩa trống tối thiểu: 500 MB cho bộ cài đặt và tài nguyên tải video.

## Cài đặt

1. Tải [`Setup/install.exe`](./Setup/install.exe?raw=1).
2. Kiểm tra SHA-256 nếu cần, sau đó chạy `install.exe`.
3. Mở **HT Downloader** từ Desktop hoặc menu Start.
4. Tại màn hình kích hoạt bản quyền, sao chép **Mã thiết bị (HWID)** gửi cho HT Studio để nhận License Key.
5. Dán mã Key bản quyền và bấm **Kích hoạt vào ứng dụng**.

> **Lưu ý Windows SmartScreen**: Khi cài đặt lần đầu trên Windows, SmartScreen có thể hiện cảnh báo bảo vệ. Vui lòng bấm **More info** (Thêm thông tin) → **Run anyway** (Vẫn chạy).

## Cách quét và tải video

1. Sao chép liên kết video hoặc trang hồ sơ cần quét.
2. Dán vào ô **Nguồn video**; có thể nhập nhiều liên kết, mỗi dòng một link.
3. Chọn **Giới hạn quét** nếu đang quét một kênh/hồ sơ.
4. Bấm **Quét liên kết**.
5. Chọn video và chất lượng mong muốn.
6. Chọn thư mục lưu rồi bấm **Tải video**.

## Sử dụng với Instagram

HT Downloader hỗ trợ liên kết Reel, bài đăng video và hồ sơ Instagram.

1. Dán link dạng `https://www.instagram.com/reel/.../`, `https://www.instagram.com/p/.../` hoặc link hồ sơ.
2. Thử **Quét liên kết** trước; nội dung công khai có thể quét mà không cần tài khoản.
3. Nếu Instagram yêu cầu xác thực, bấm nút **Instagram** ở thanh trên cùng và đăng nhập trong cửa sổ Instagram.
4. Khi nút hiển thị `Instagram ✓`, quét lại liên kết.

Phiên Instagram được lưu cục bộ trên máy và chỉ dùng cho yêu cầu tới Instagram. Việc đăng nhập không bảo đảm truy cập được nội dung riêng tư, giới hạn độ tuổi/khu vực hoặc nội dung mà tài khoản không có quyền xem.

## Xử lý sự cố thường gặp

- **Không phát hiện video:** Kiểm tra link còn hoạt động, thử mở link bằng trình duyệt và quét lại.
- **Yêu cầu đăng nhập:** Kết nối đúng tài khoản TikTok hoặc Instagram rồi thử lại.
- **Instagram đã kết nối nhưng không quét được:** Nội dung có thể bị giới hạn tuổi, khu vực, tài khoản riêng tư hoặc quyền xem của tài khoản.
- **Tải thất bại:** Kiểm tra mạng, chọn lại thư mục lưu và thử lại sau ít phút.
- **Không mở được ứng dụng:** Khởi động lại Windows hoặc cài lại bằng bộ cài mới nhất.

## Thay đổi trong v2.0.4

- Bổ sung quét và tải Instagram Reel, bài đăng video và hồ sơ.
- Thêm đăng nhập/đăng xuất Instagram và cookie riêng cho từng nền tảng.
- Tự khôi phục phiên Instagram khi mở lại ứng dụng.
- Thêm cơ chế dự phòng nhận diện luồng video Instagram khi extractor chính thất bại.
- Hiển thị rõ lỗi giới hạn độ tuổi hoặc quyền truy cập.
- Cải thiện nhận diện URL Instagram và thời gian quét hồ sơ.

## Bản quyền & Kênh hỗ trợ

- **Bản quyền**: 1 Máy tính = 1 Bản quyền được khóa cứng theo mã HWID thiết bị.
- **Zalo hỗ trợ**: 0357 642 647 (Nguyễn Lê Trung Hiếu)
- **Telegram hỗ trợ**: [@NLTH_MEDIA](https://t.me/NLTH_MEDIA)

## Phiên bản

Phiên bản phát hành hiện tại: **v2.0.4** — tag Git: `ht-downloader-v2.0.4`.
