# CẨM NANG HƯỚNG DẪN SỬ DỤNG - HT VIDS STUDIO (GOOGLE VIDS AUTOMATION)

Chào mừng bạn đến với **HT Vids Studio** – Công cụ tự động hóa sáng tạo video AI chuyên nghiệp trên nền tảng **Google Vids (Google Veo AI)**.

Tài liệu này được tích hợp trực tiếp vào nút **Hướng dẫn** trên giao diện ứng dụng và được lưu trữ tại file này để bạn tra cứu nhanh.

---

## MỤC LỤC
1. [Bắt Đầu Nhanh (Quy trình 4 bước tạo video đầu tiên)](#1-bắt-đầu-nhanh-4-bước-tạo-video-đầu-tiên)
2. [Quản Lý Tài Khoản Google & Tự Động Đăng Nhập 2FA](#2-quản-lý-tài-khoản-google--tự-động-đăng-nhập-2fa)
3. [Nghệ Thuật Viết Prompt & Dùng Ảnh Tham Chiếu (@Image)](#3-nghệ-thuật-viết-prompt--dùng-ảnh-tham-chiếu-image)
4. [Kỹ Thuật Nối Cảnh Extend Mở Rộng 20 Giây](#4-kỹ-thuật-nối-cảnh-extend-mở-rộng-20-giây)
5. [Tạo Video Hàng Loạt Theo Chiến Dịch](#5-tạo-video-hàng-loạt-theo-chiến-dịch)
6. [Quản Lý Hàng Đợi Đa Luồng (Queue Automation)](#6-quản-lý-hàng-đợi-đa-luồng-queue-automation)
7. [Tự Động Xóa Watermark AI](#7-tự-động-xóa-watermark-ai)
8. [Kho Video & Quản Lý File Đầu Ra](#8-kho-video--quản-lý-file-đầu-ra)
9. [Nút Chuông Thông Báo & Xử Lý Nhanh Task Lỗi](#9-nút-chuông-thông-báo--xử-lý-nhanh-task-lỗi)
10. [Câu Hỏi Thường Gặp & Xử Lý Sự Cố (FAQ)](#10-câu-hỏi-thường-gặp--xử-lý-sự-cố-faq)
11. [Kênh Kết Nối & Hỗ Trợ Kỹ Thuật Trực Tiếp](#11-kênh-kết-nối--hỗ-trợ-kỹ-thuật-trực-tiếp)

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
  - Với video **5–15 giây**, chỉ cần nhập kịch bản vào ô Prompt ban đầu. Khi chọn 15 giây, ứng dụng tự kéo thanh thời lượng của Google Vids lên 15s và tạo một video duy nhất.
  - Với video **16–20 giây**, nhập thêm kịch bản nối cảnh vào ô Prompt Extend.
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
5. Tài khoản trùng email sẽ tự động được bỏ qua, không ghi đè mật khẩu và không mở lại profile Chrome. Gmail có khác biệt chữ hoa/thường, dấu chấm, hậu tố `+tag` hoặc miền `googlemail.com` vẫn được nhận diện là cùng một tài khoản.

### 2.3. Xử lý khi Google yêu cầu xác minh bảo mật (Captcha/Điện thoại)
Nếu Google yêu cầu nhập Captcha hoặc bấm số trên điện thoại, bạn chỉ cần bấm nút **Mở Chrome** ở dòng tài khoản đó. Trình duyệt Chrome sẽ xuất hiện trên màn hình, bạn xác minh thủ công một lần rồi đóng cửa sổ lại.

### 2.4. Chọn và bật/tắt tài khoản hàng loạt
1. Mở tab **Tài khoản**, sau đó dùng menu **Chọn nhanh**.
2. Chọn nhóm cần xử lý: đang bật, đang tắt, sẵn sàng, đang chạy, cần đăng nhập, còn lượt hoặc hết lượt.
3. Bấm **Bật hàng loạt** hoặc **Tắt hàng loạt**. Bạn vẫn có thể tích chọn từng tài khoản thủ công.
4. Tài khoản đang chạy task, đang đăng nhập hoặc đang kiểm tra sẽ được bỏ qua để tránh gián đoạn tiến trình.

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

Google Vids hiện hỗ trợ tạo trực tiếp tối đa 15 giây. Video 5–15 giây chỉ dùng một lượt Create và không cần Prompt Extend. Để tạo video 20 giây liền mạch:
1. **Ô Prompt 0s - 10s:** Mô tả bối cảnh và hành động mở đầu.
2. **Ô Prompt Extend 10s - 20s:** Mô tả hành động tiếp diễn từ tư thế hoặc góc máy kết thúc của đoạn 10s trước.
3. Hệ thống sẽ tự động:
   - Tạo đoạn 10 giây đầu tiên.
   - Bấm **Extend**, đưa prompt nối tiếp vào và render đoạn 2.
   - Chèn vào timeline và kích hoạt lệnh **Expand video to fill the scene**.
   - Xuất file video hoàn chỉnh 20 giây đồng nhất tỉ lệ và âm thanh.

---

## 5. TẠO VIDEO HÀNG LOẠT THEO CHIẾN DỊCH

Tab **Tạo video hàng loạt** dùng để chuẩn bị nhiều video trên cùng một màn hình theo dạng bảng.

1. Bấm **Tạo mới**, nhập tên chiến dịch và chọn thư mục gốc. Ứng dụng tạo một thư mục riêng cho chiến dịch, bên trong có cấu hình chiến dịch, ảnh tham chiếu và video đầu ra.
2. Bấm **Thêm video** để tạo dòng mới. Mỗi dòng tương ứng với một video và có prompt, ảnh tham chiếu, tỷ lệ khung hình, độ phân giải, thời lượng cùng trạng thái riêng. Có thể chọn tối đa 3 ảnh JPG, PNG hoặc WEBP, mỗi ảnh không quá 10 MB. Khi thêm ảnh, ô này hiển thị **Đang thêm ảnh…** rồi cập nhật thumbnail mà không tải lại toàn bộ bảng.
3. Có thể dán một prompt dài gồm nhiều đoạn hoặc nhiều dòng trực tiếp vào ô prompt. Toàn bộ nội dung vẫn nằm trong dòng hiện tại và không tự sinh task mới.
4. Dùng phần **Cài đặt mặc định** để áp dụng nhanh tỷ lệ, độ phân giải, thời lượng, tùy chọn xóa watermark và thư mục xuất cho các video được chọn. Sau đó vẫn có thể sửa riêng từng dòng.
5. Bấm **Thêm vào hàng đợi** để lưu các video sẵn sàng vào hàng chờ, hoặc bấm **Tạo video** để chạy ngay.
6. Khi bắt đầu chạy, ứng dụng không chuyển sang tab **Hàng đợi**. Nút tạo đổi thành nút **Dừng** màu đỏ để thể hiện trạng thái đang xử lý.
7. Bấm **Dừng** nếu muốn hủy toàn bộ task đang chờ và đang chạy. Các tiến trình trình duyệt liên quan sẽ được đóng và chiến dịch được mở khóa để chỉnh sửa tiếp.

Trong lúc xử lý, cột **Trạng thái** của mỗi dòng cập nhật trực tiếp từ hàng đợi, gồm bản nháp, đang chờ, đang tạo theo phần trăm, hoàn thành hoặc lỗi. Thanh bước phía trên hiển thị tiến độ trung bình của chiến dịch; bước **3. Kiểm tra & tạo** sáng khi đang chạy và chuyển dấu hoàn thành khi tất cả video đã xong.

Ảnh tham chiếu được sao chép vào đúng thư mục của dòng video trong chiến dịch. Khi thay ảnh, ứng dụng tự dọn ảnh và thumbnail cũ do ứng dụng quản lý; nếu quá trình nhập lỗi, các file chép dở cũng được xóa để không tích lũy dữ liệu rác.

Mỗi chiến dịch nên dùng một tên dễ nhận biết. Không tự ý di chuyển hoặc đổi tên các thư mục con khi chiến dịch đang chạy vì ứng dụng cần đúng đường dẫn để lưu ảnh và video.

---

## 6. QUẢN LÝ HÀNG ĐỢI ĐA LUỒNG (QUEUE AUTOMATION)

- **Cơ chế tự phân tài khoản rảnh:** Khi bạn xếp hàng chục video vào tab **Hàng đợi**, hệ thống sẽ tự động tìm kiếm các tài khoản Google đang rảnh để chạy tác vụ.
- **Thứ tự FIFO:** Task vào hàng đợi trước được xét chạy trước. Khi một tài khoản hoàn thành và rảnh, hệ thống tự lấy task cũ nhất mà tài khoản đó có thể xử lý; task bấm **Chạy lại** được đưa xuống cuối hàng.
- **Không xung đột:** Mỗi tài khoản chạy trong môi trường trình duyệt tách biệt, đảm bảo tiến trình render độc lập.
- **Các thao tác quản lý:**
  - **Bắt đầu:** Khởi động task đang ở trạng thái chờ (waiting).
  - **Chạy lại (Retry):** Thử lại ngay tác vụ bị gián đoạn hoặc lỗi quota.
  - **Chỉnh sửa:** Cập nhật lại prompt, tên file hoặc cấu hình trước khi chạy.
  - **Xóa:** Hủy bỏ tác vụ khỏi danh sách.
- Khi kiểm tra hàng loạt, ngưỡng quota tối thiểu được lấy theo thời lượng video đang chọn. Nếu tài khoản trước đó bị tự tắt vì ngưỡng này nhưng quota còn đủ cho video mới, ứng dụng sẽ bật lại tài khoản đó khi thêm task; tài khoản bị bạn tắt thủ công không bị bật lại.

---

## 7. TỰ ĐỘNG XÓA WATERMARK AI

- Khi tích chọn **Tự động xóa watermark Veo**, ngay sau khi tải video từ Google Vids về máy:
- AlphaJudge ML xác định cường độ logo theo video, sau đó reverse alpha khôi phục điểm ảnh nền và AI cleanup làm sạch phần logo còn dư. Cấu hình được cân bằng ở mức 120% để tránh tạo mảng màu do xử lý quá mạnh.
- Nếu mẫu logo chưa được nhận diện, ứng dụng tự chuyển sang FFmpeg delogo để giữ tương thích với video Google Vids cũ.
- Tệp chỉ được thay thế sau khi ứng dụng xác nhận đầu ra giữ nguyên kích thước và thời lượng; âm thanh gốc được bảo toàn.

---

## 8. KHO VIDEO & QUẢN LÝ FILE ĐẦU RA

- Toàn bộ video thành phẩm được lưu trong thư mục cấu hình (mặc định là `Videos` của máy tính).
- Tên file được tự động đánh số thứ tự và sinh mã ngẫu nhiên duy nhất: `task-X-YYYYMMDD_random.mp4`.
- Tại tab **Kho video**, bạn có thể:
  - Xem thumbnail và thông số chi tiết (độ phân giải, thời lượng, ngày tạo).
  - Bấm **Mở file** để phát video bằng trình xem mặc định của Windows.
  - Bấm **Xem trong thư mục** để mở đúng thư mục chứa file trong Windows File Explorer.

---

## 9. NÚT CHUÔNG THÔNG BÁO & XỬ LÝ NHANH TASK LỖI

Nút hình **Chiếc chuông 🔔** ở góc trên bên phải thanh tiêu đề tích hợp trung tâm thông báo thời gian thực:
- **Chấm đỏ kèm số lượng**: Báo hiệu số lượng task gặp sự cố cần sửa (hoặc video đã tạo xong).
- Khi bấm vào chuông:
  - **Với task lỗi**: Hiển thị rõ nguyên nhân lỗi (quota, mạng, phiên...), cung cấp nút **"🔄 Chạy lại"** ngay lập tức và nút **"✏️ Sửa kịch bản"** để đưa thẳng bạn vào màn hình chỉnh sửa thông số.
  - **Với task hoàn thành**: Cung cấp nút xem video trực tiếp hoặc mở thư mục chứa file.
  - Có nút **"Chạy lại tất cả lỗi"** giúp bạn chạy lại toàn bộ hàng loạt chỉ với 1 cú click.

---

## 10. CÂU HỎI THƯỜNG GẶP & XỬ LÝ SỰ CỐ (FAQ)

### ❓ Google báo lỗi "Generating video failed" hoặc quota tạm thời đạt giới hạn?
Google Vids áp dụng định mức quota theo giờ hoặc theo ngày cho từng tài khoản. Bạn chỉ cần bấm **Chạy lại (Retry)** sau 10 - 20 phút, hoặc thêm nhiều tài khoản Google vào tab Tài khoản để hệ thống tự động luân phiên.

### ❓ Tại sao tài khoản có trạng thái "NOT_LOGGED_IN"?
Nghĩa là tài khoản chưa được đăng nhập trên profile riêng của ứng dụng. Bạn chỉ cần bấm nút **"Mở Chrome"** ở dòng tài khoản đó, đăng nhập Google một lần rồi đóng cửa sổ lại.

### ❓ Video tải về lưu ở đâu?
Video được lưu tại đường dẫn hiển thị ở ô **Thư mục lưu video** tại tab Tạo video. Bạn có thể thay đổi đường dẫn này bằng nút chọn thư mục bất kỳ lúc nào.

### ❓ Làm sao biết ứng dụng đã có phiên bản mới?
Bạn có thể bấm **Kiểm tra phiên bản** bên dưới thông tin phiên bản ở cuối sidebar để chủ động kiểm tra ngay. Trong lúc kiểm tra, nút hiển thị trạng thái xử lý; sau đó ứng dụng sẽ báo đang dùng bản mới nhất, đã tìm thấy bản mới hoặc chưa thể kết nối máy chủ.

Nếu không bấm nút, ứng dụng vẫn tự kiểm tra kho phát hành chính thức khi khởi động, mỗi 5 phút trong tiến trình nền, khi bạn quay lại cửa sổ và khi mạng kết nối lại. Nếu có bản mới, popup tiếng Việt sẽ xuất hiện ngay trong phiên đang chạy mà không cần tải lại hoặc tắt mở phần mềm.

Mọi phiên bản mới đều là cập nhật bắt buộc. Popup cập nhật khóa giao diện, không có nút đóng hoặc **Để sau**. Từ phiên bản 3.0.1, bấm **Tải & cập nhật ngay** để tải bộ cài trong nền mà không mở trình duyệt. Thanh tiến độ hiển thị phần trăm, dung lượng và tốc độ tải. Sau khi ứng dụng xác minh SHA-256 thành công, bấm **Đóng bản cũ & mở bản mới** để cài đặt im lặng và tự khởi động phiên bản mới.

### ❓ Nút Donate dùng để làm gì?
Nút **Donate** trên thanh tiêu đề mở popup chứa mã QR và thông tin chuyển khoản để bạn có thể tự nguyện ủng hộ quá trình phát triển HT Studio. Ngoài ra, một meme robot cà phê nhỏ sẽ xuất hiện ngẫu nhiên mỗi 10–20 phút trong khoảng trống sidebar; bấm vào meme để xem mã QR và lời cảm ơn, hoặc bấm `×` để đóng. Việc ủng hộ không bắt buộc và không ảnh hưởng đến chức năng hoặc quyền lợi của key bản quyền đã kích hoạt.

### ❓ Máy khác chạy lỗi thì cần làm gì?

1. Bấm **Kiểm tra hệ thống** ở cuối sidebar.
2. Xử lý các mục màu đỏ như thiếu Chrome/Edge, thiếu công cụ video, không có quyền ghi hoặc ổ đĩa còn dưới 1 GB.
3. Cập nhật Chrome/Edge nếu ứng dụng báo trình duyệt quá cũ.
4. Đăng nhập lại từng tài khoản Google trên chính máy đang sử dụng; không sao chép profile hay tệp credential từ máy khác.
5. Nếu lỗi vẫn còn, bấm **Xuất chẩn đoán** và gửi tệp ZIP cho bộ phận hỗ trợ. ZIP không chứa mật khẩu, cookie, token, prompt, ảnh hoặc video.

Thư mục xuất mặc định trên mỗi máy là `Downloads\HT Vids Studio`. Ứng dụng sẽ kiểm tra quyền ghi trước khi nhận task.

### ❓ Làm sao để gửi lỗi cho tác giả xử lý nhanh nhất?
Bạn hãy mở tab **Nhật ký**, sao chép đoạn log báo lỗi hoặc chụp ảnh màn hình, sau đó bấm nút **Hỗ trợ** ở thanh menu để gửi trực tiếp qua Zalo hoặc Telegram.

---

## 11. KÊNH KẾT NỐI & HỖ TRỢ KỸ THUẬT TRỰC TIẾP

Khi cần giải đáp thắc mắc, yêu cầu nâng cấp tính năng hoặc hỗ trợ kỹ thuật, bạn có thể kết nối trực tiếp với tác giả qua hai kênh chính thức:

- 📱 **Zalo:** Quét mã QR tại mục **Hỗ trợ** (Tài khoản: **Hiếu đây rồi**).
- ✈️ **Telegram:** **[@NLTH_MEDIA](https://t.me/NLTH_MEDIA)** (Hỗ trợ 24/7).

*(Chỉ cần bấm nút **Hỗ trợ** ở góc trái dưới cùng ứng dụng để hiển thị mã QR quét bằng điện thoại).*
