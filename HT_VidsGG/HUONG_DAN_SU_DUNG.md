# CẨM NANG HƯỚNG DẪN SỬ DỤNG - HT VIDS STUDIO (GOOGLE VIDS AUTOMATION)

Chào mừng bạn đến với **HT Vids Studio** – Công cụ tự động hóa sáng tạo video AI chuyên nghiệp trên nền tảng **Google Vids (Google Veo AI)**.

Tài liệu này được tích hợp trực tiếp vào nút **Hướng dẫn** trên giao diện ứng dụng và được lưu trữ tại file này để bạn tra cứu nhanh.

---

## MỤC LỤC
1. [Bắt Đầu Nhanh (Quy trình 4 bước tạo video đầu tiên)](#1-bắt-đầu-nhanh-4-bước-tạo-video-đầu-tiên)
2. [Quản Lý Tài Khoản Google & Tự Động Đăng Nhập 2FA](#2-quản-lý-tài-khoản-google--tự-động-đăng-nhập-2fa)
3. [Nghệ Thuật Viết Prompt & Dùng Ảnh Tham Chiếu (@Image)](#3-nghệ-thuật-viết-prompt--dùng-ảnh-tham-chiếu-image)
4. [Kỹ Thuật Nối Cảnh Extend Mở Rộng 20 Giây](#4-kỹ-thuật-nối-cảnh-extend-mở-rộng-20-giây)
5. [Quản Lý Hàng Đợi Đa Luồng (Queue Automation)](#5-quản-lý-hàng-đợi-đa-luồng-queue-automation)
6. [Tự Động Xóa Watermark AI (Delogo)](#6-tự-động-xóa-watermark-ai-delogo)
7. [Kho Video & Quản Lý File Đầu Ra](#7-kho-video--quản-lý-file-đầu-ra)
8. [Câu Hỏi Thường Gặp & Xử Lý Sự Cố (FAQ)](#8-câu-hỏi-thường-gặp--xử-lý-sự-cố-faq)
9. [Kênh Kết Nối & Hỗ Trợ Kỹ Thuật Trực Tiếp](#9-kênh-kết-nối--hỗ-trợ-kỹ-thuật-trực-tiếp)

---

## 1. BẮT ĐẦU NHANH (4 BƯỚC TẠO VIDEO ĐẦU TIÊN)

Chỉ mất chưa đầy 2 phút để thiết lập và nhận video hoàn chỉnh dài 20 giây:

- **Bước 1: Chuẩn bị tài khoản Google AI**
  - Vào tab **Tài khoản** trên thanh menu bên trái.
  - Thêm tài khoản Google đã kích hoạt gói Google Vids / Gemini Advanced.
  - Bấm **Mở Chrome** để đăng nhập lần đầu tiên. Đóng Chrome khi hoàn tất để ứng dụng ghi nhớ phiên.
- **Bước 2: Chuẩn bị ảnh tham chiếu (Tùy chọn)**
  - Chuyển sang tab **Tạo video**.
  - Kéo thả hoặc chọn tối đa 3 ảnh nhân vật/sản phẩm (JPG/PNG). Hệ thống sẽ tự gán nhãn: `@Image1`, `@Image2`, `@Image3`.
- **Bước 3: Soạn kịch bản & Cấu hình video**
  - Nhập kịch bản cho **10 giây đầu** vào ô Prompt ban đầu.
  - Nhập kịch bản nối cảnh cho **10 giây tiếp theo** vào ô Prompt Extend.
  - Chọn tỉ lệ khung hình: **9:16 (Dọc TikTok/Reels/Shorts)** hoặc **16:9 (Ngang YouTube)**.
  - Chọn độ phân giải (720p hoặc 1080p) và tích chọn **Tự động xóa watermark Veo**.
- **Bước 4: Bắt đầu tạo video**
  - Bấm nút **Tạo video 20 giây & tải xuống** để chạy ngay.
  - Hoặc bấm **Thêm vào hàng đợi** để hệ thống chạy ngầm liên tục nhiều video.

---

## 2. QUẢN LÝ TÀI KHOẢN GOOGLE & TỰ ĐỘNG ĐĂNG NHẬP 2FA

### 2.1. Cơ chế Profile Chrome độc lập & Bảo mật DPAPI
- Mỗi tài khoản Google được lưu trong một thư mục Profile Chrome riêng biệt trong `%LOCALAPPDATA%`.
- Hoàn toàn **không ảnh hưởng** đến trình duyệt Chrome cá nhân hàng ngày của bạn.
- Mật khẩu và mã khóa 2FA TOTP được mã hóa bằng chuẩn **Windows DPAPI** trực tiếp trên phần cứng máy tính của bạn, không gửi đi bất kỳ máy chủ bên ngoài nào.

### 2.2. Thêm hàng loạt tài khoản (Bulk Add)
1. Tại tab **Tài khoản**, bấm nút **Thêm hàng loạt**.
2. Nhập danh sách tài khoản theo định dạng:
   ```text
   email1@gmail.com | matkhau1 | JBSWY3DPEHPK3PXP | recovery1@gmail.com
   email2@gmail.com:matkhau2:4S654S654S654S65:recovery2@gmail.com
   email3@gmail.com	matkhau3	JBSWY3DPEHPK3PXP	recovery3@gmail.com
   ```
   *(Hỗ trợ phân cách bằng dấu gạch đứng `|`, hai chấm `:`, tab hoặc dấu phẩy)*.
3. Bấm **Thêm & Tự động đăng nhập**.
4. Trình duyệt ngầm sẽ tự động:
   - Điền Email & Mật khẩu.
   - Tự động sinh mã 2FA 6 số thời gian thực từ khóa TOTP Secret Key và điền vào bước xác minh.
   - Kiểm tra gói Google Vids và lưu phiên đăng nhập vĩnh viễn.

### 2.3. Xử lý khi Google yêu cầu xác minh bảo mật (Captcha/Điện thoại)
Nếu Google yêu cầu nhập Captcha hoặc bấm số trên điện thoại, bạn chỉ cần bấm nút **Mở Chrome** ở dòng tài khoản đó. Trình duyệt Chrome sẽ xuất hiện trên màn hình, bạn xác minh thủ công một lần rồi đóng cửa sổ lại.

---

## 3. NGHỆ THUẬT VIẾT PROMPT & DÙNG ẢNH THAM CHIẾU (@IMAGE)

### 3.1. Cấu trúc Prompt chuẩn 4 phần
Một prompt điện ảnh chất lượng cao cần đủ 4 thành tố:
1. **Chủ thể (Subject):** Nhân vật, độ tuổi, trang phục, diện mạo hoặc vật thể chính.
2. **Hành động (Action):** Chuyển động nhẹ nhàng, bước đi, nụ cười, cử chỉ tay chân mượt mà.
3. **Bối cảnh & Ánh sáng (Setting & Lighting):** Địa điểm, thời gian trong ngày (hoàng hôn, đêm neon), ánh sáng vàng dịu (golden hour, soft cinematic light).
4. **Góc máy & Chất lượng (Camera & Style):** Cận cảnh (close-up), góc quay flycam (drone shot), 4k ultra-detailed, photorealistic, 24fps film grain.

### 3.2. Giữ đồng nhất nhân vật với `@Image1`, `@Image2`, `@Image3`
Khi tải ảnh lên khung Ảnh tham chiếu:
- Ảnh 1 được gán thẻ `@Image1`.
- Ảnh 2 được gán thẻ `@Image2`.
- Ảnh 3 được gán thẻ `@Image3`.

**Ví dụ Prompt:**
> *"Cận cảnh khuôn mặt nhân vật giống hệt **@Image1** đang mỉm cười tự tin nhìn vào ống kính, mái tóc khẽ bay trong gió nhẹ, phía sau là phố cổ Hà Nội mùa thu với những tia nắng vàng xuyên qua tán cây, cinematic lighting, photorealistic 8k."*

---

## 4. KỸ THUẬT NỐI CẢNH EXTEND MỞ RỘNG 20 GIÂY

Google Vids mặc định sinh ra clip 10 giây. Để tạo video 20 giây liền mạch:
1. **Ô Prompt 0s - 10s:** Mô tả bối cảnh và hành động mở đầu.
2. **Ô Prompt Extend 10s - 20s:** Mô tả hành động tiếp diễn từ tư thế hoặc góc máy kết thúc của đoạn 10s trước.
3. Hệ thống sẽ tự động:
   - Tạo đoạn 10 giây đầu tiên.
   - Bấm **Extend**, đưa prompt nối tiếp vào và render đoạn 2.
   - Chèn vào timeline và kích hoạt lệnh **Expand video to fill the scene**.
   - Xuất file video hoàn chỉnh 20 giây đồng nhất tỉ lệ và âm thanh.

---

## 5. QUẢN LÝ HÀNG ĐỢI ĐA LUỒNG (QUEUE AUTOMATION)

- **Cơ chế tự phân tài khoản rảnh:** Khi bạn xếp hàng chục video vào tab **Hàng đợi**, hệ thống sẽ tự động tìm kiếm các tài khoản Google đang rảnh để chạy tác vụ.
- **Không xung đột:** Mỗi tài khoản chạy trong môi trường trình duyệt tách biệt, đảm bảo tiến trình render độc lập.
- **Các thao tác quản lý:**
  - **Bắt đầu:** Khởi động task đang ở trạng thái chờ (waiting).
  - **Chạy lại (Retry):** Thử lại ngay tác vụ bị gián đoạn hoặc lỗi quota.
  - **Chỉnh sửa:** Cập nhật lại prompt, tên file hoặc cấu hình trước khi chạy.
  - **Xóa:** Hủy bỏ tác vụ khỏi danh sách.
- Khi kiểm tra hàng loạt, ngưỡng quota tối thiểu được lấy theo thời lượng video đang chọn. Nếu tài khoản trước đó bị tự tắt vì ngưỡng này nhưng quota còn đủ cho video mới, ứng dụng sẽ bật lại tài khoản đó khi thêm task; tài khoản bị bạn tắt thủ công không bị bật lại.

---

## 6. TỰ ĐỘNG XÓA WATERMARK AI (DELOGO)

- Khi tích chọn **Tự động xóa watermark Veo**, ngay sau khi tải video từ Google Vids về máy:
- Bộ lọc tích hợp (FFmpeg delogo) sẽ tự động nhận diện tọa độ logo ở góc dưới (cả tỉ lệ 9:16 và 16:9).
- Làm mờ và hòa trộn hoàn toàn logo thương hiệu vào khung cảnh xung quanh mà không làm giảm độ phân giải hay biến dạng khung hình.

---

## 7. KHO VIDEO & QUẢN LÝ FILE ĐẦU RA

- Toàn bộ video thành phẩm được lưu trong thư mục cấu hình (mặc định là `Videos` của máy tính).
- Tên file được tự động đánh số thứ tự và sinh mã ngẫu nhiên duy nhất: `task-X-YYYYMMDD_random.mp4`.
- Tại tab **Kho video**, bạn có thể:
  - Xem thumbnail và thông số chi tiết (độ phân giải, thời lượng, ngày tạo).
  - Bấm **Mở file** để phát video bằng trình xem mặc định của Windows.
  - Bấm **Xem trong thư mục** để mở đúng thư mục chứa file trong Windows File Explorer.

---

## 8. NÚT CHUÔNG THÔNG BÁO & XỬ LÝ NHANH TASK LỖI

Nút hình **Chiếc chuông 🔔** ở góc trên bên phải thanh tiêu đề tích hợp trung tâm thông báo thời gian thực:
- **Chấm đỏ kèm số lượng**: Báo hiệu số lượng task gặp sự cố cần sửa (hoặc video đã tạo xong).
- Khi bấm vào chuông:
  - **Với task lỗi**: Hiển thị rõ nguyên nhân lỗi (quota, mạng, phiên...), cung cấp nút **"🔄 Chạy lại"** ngay lập tức và nút **"✏️ Sửa kịch bản"** để đưa thẳng bạn vào màn hình chỉnh sửa thông số.
  - **Với task hoàn thành**: Cung cấp nút xem video trực tiếp hoặc mở thư mục chứa file.
  - Có nút **"Chạy lại tất cả lỗi"** giúp bạn chạy lại toàn bộ hàng loạt chỉ với 1 cú click.

---

## 9. CÂU HỎI THƯỜNG GẶP & XỬ LÝ SỰ CỐ (FAQ)

### ❓ Google báo lỗi "Generating video failed" hoặc quota tạm thời đạt giới hạn?
Google Vids áp dụng định mức quota theo giờ hoặc theo ngày cho từng tài khoản. Bạn chỉ cần bấm **Chạy lại (Retry)** sau 10 - 20 phút, hoặc thêm nhiều tài khoản Google vào tab Tài khoản để hệ thống tự động luân phiên.

### ❓ Tại sao tài khoản có trạng thái "NOT_LOGGED_IN"?
Nghĩa là tài khoản chưa được đăng nhập trên profile riêng của ứng dụng. Bạn chỉ cần bấm nút **"Mở Chrome"** ở dòng tài khoản đó, đăng nhập Google một lần rồi đóng cửa sổ lại.

### ❓ Video tải về lưu ở đâu?
Video được lưu tại đường dẫn hiển thị ở ô **Thư mục lưu video** tại tab Tạo video. Bạn có thể thay đổi đường dẫn này bằng nút chọn thư mục bất kỳ lúc nào.

### ❓ Làm sao để gửi lỗi cho tác giả xử lý nhanh nhất?
Bạn hãy mở tab **Nhật ký**, sao chép đoạn log báo lỗi hoặc chụp ảnh màn hình, sau đó bấm nút **Hỗ trợ** ở thanh menu để gửi trực tiếp qua Zalo hoặc Telegram.

---

## 10. KÊNH KẾT NỐI & HỖ TRỢ KỸ THUẬT TRỰC TIẾP

Khi cần giải đáp thắc mắc, yêu cầu nâng cấp tính năng hoặc hỗ trợ kỹ thuật, bạn có thể kết nối trực tiếp với tác giả qua hai kênh chính thức:

- 📱 **Zalo:** Quét mã QR tại mục **Hỗ trợ** (Tài khoản: **Hiếu đây rồi**).
- ✈️ **Telegram:** **[@NLTH_MEDIA](https://t.me/NLTH_MEDIA)** (Hỗ trợ 24/7).

*(Chỉ cần bấm nút **Hỗ trợ** ở góc trái dưới cùng ứng dụng để hiển thị mã QR quét bằng điện thoại).*
