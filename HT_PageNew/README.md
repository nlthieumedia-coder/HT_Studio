# HT PageNew 2.0.2

HT PageNew là ứng dụng Windows dùng Chromium riêng cho từng hồ sơ để quản lý phiên xem Facebook Feed/Reels, Fanpage, lịch chạy và thông báo Telegram.

Ứng dụng không lưu mật khẩu Facebook và không tự giải hoặc bỏ qua CAPTCHA/2FA. Người dùng đăng nhập, xác minh thủ công và chịu trách nhiệm sử dụng tài khoản đúng quyền hạn, chính sách của Facebook.

## 1. Cài đặt và cập nhật

Trong thư mục `release` có hai bản, chỉ cần chọn **một**:

- `HT PageNew Setup 2.0.2.exe`: bản cài đặt, phù hợp sử dụng lâu dài.
- `HT PageNew 2.0.2.exe`: bản portable, mở trực tiếp để thử nhanh.

Khi cập nhật bản mới:

1. Dừng các phiên đang chạy và thoát HT PageNew.
2. Chạy bộ cài phiên bản mới. Không cần gỡ bản cũ trước nếu cài cùng vị trí.
3. Mở ứng dụng, kiểm tra hồ sơ, Page và lịch đã lưu.
4. Giữ bản cài cũ cho đến khi xác nhận bản mới hoạt động ổn định.

Dữ liệu hồ sơ Chromium nằm trong vùng dữ liệu người dùng của Windows, không nằm trong thư mục cài đặt. Không tự ý sao chép hoặc dùng chung một hồ sơ trên hai máy.

## 2. Tạo hồ sơ và đăng nhập Facebook

1. Mở **Hồ sơ tài khoản** → **Thêm Hồ Sơ Mới**.
2. Nhập tên hồ sơ và proxy nếu sử dụng.
3. Bấm **Test Proxy**, xác nhận IP và trạng thái kết nối.
4. Lưu hồ sơ rồi bấm **FB** để mở Chromium của hồ sơ đó.
5. Đăng nhập Facebook thủ công; hoàn tất CAPTCHA, 2FA hoặc checkpoint nếu Facebook yêu cầu.
6. Đóng Chromium rồi mở lại bằng nút **FB** để kiểm tra phiên đăng nhập được giữ.

Mỗi hồ sơ có thư mục Chromium độc lập. Không mở cùng một hồ sơ bằng nhiều tiến trình Chromium cùng lúc.

## 3. Cấu hình Fanpage

1. Tại **Hồ sơ tài khoản**, bấm **Cấu hình Page**.
2. Nhập đúng tên hiển thị và đường dẫn Facebook của Page.
3. Thêm các Page cần quản lý rồi lưu.

Phần này chỉ lưu tên và link Page; lịch được cấu hình riêng trong tab **Lịch chạy**. Nếu hồ sơ không có Fanpage, hệ thống mặc định chạy bằng **Trang cá nhân**.

Tài khoản Facebook phải có quyền truy cập Page và Page phải xuất hiện trong **See all profiles/Xem tất cả trang cá nhân**.

## 4. Chạy ngay

1. Chọn **Trang cá nhân** hoặc Fanpage trong dòng hồ sơ.
2. Chọn thời lượng.
3. Bấm **Chạy ngay**.
4. Theo dõi trạng thái: **Đang chờ**, **Đang chạy**, **Đã hoàn thành**, **Cần xác minh** hoặc **Lỗi**.

Khi chạy Fanpage, ứng dụng chỉ bắt đầu cuộn sau khi xác nhận đã chuyển đúng danh tính Page. Nếu không xác nhận được, phiên sẽ dừng để tránh chạy nhầm tài khoản. Bấm **Dừng ngay** nếu muốn kết thúc sớm.

## 5. Thêm, sửa và xóa lịch

### Thêm lịch

1. Mở **Lịch chạy** và chọn hồ sơ.
2. Chọn Trang cá nhân hoặc các Fanpage cần chạy.
3. Thêm một hoặc nhiều khung giờ **IN/OUT**.
4. Xác nhận và lưu.

Một danh tính có thể có nhiều khung giờ trong ngày. Hệ thống không cho phép các khung giờ trong cùng một hồ sơ chồng lấn vì một hồ sơ chỉ chạy được một danh tính tại một thời điểm.

### Sửa lịch

1. Mở **Lịch đã lên**.
2. Tìm đúng hồ sơ, danh tính và khung giờ.
3. Bấm **Sửa lịch**, điều chỉnh IN/OUT rồi lưu.

### Xóa lịch

1. Mở **Lịch đã lên**.
2. Bấm **Xóa lịch** ở đúng dòng cần xóa.
3. Xác nhận thao tác.

Chỉ khung giờ được chọn bị xóa; các lịch khác của cùng Trang cá nhân hoặc Fanpage vẫn được giữ nguyên.

### Điều kiện để lịch tự chạy

- HT PageNew phải đang mở; có thể thu nhỏ nhưng không được thoát hẳn.
- Hồ sơ và lịch phải đang bật.
- Windows phải đúng ngày, giờ và múi giờ `Asia/Bangkok (UTC+7)`.
- Không có phiên khác đang sử dụng cùng hồ sơ.
- Ứng dụng không chạy bù lịch đã bỏ lỡ khi máy hoặc ứng dụng tắt.

## 6. Nhật ký và theo dõi

Tab **Lịch đã lên** hiển thị lịch theo ngày/khung giờ. Tab **Nhật ký hoạt động** ghi hồ sơ, danh tính, thời điểm bắt đầu/kết thúc và nguyên nhân dừng.

Nhật ký không ghi cookie, token hoặc mật khẩu Facebook/proxy. Khi báo lỗi, nên chụp lại dòng nhật ký mới nhất và thời điểm xảy ra lỗi.

## 7. Telegram

### Kích hoạt

1. Tạo bot bằng `@BotFather` và lấy Bot Token.
2. Mở cuộc trò chuyện với bot, gửi `/start`.
3. Lấy Chat ID, nhập Bot Token và Chat ID trong **Telegram & Thông báo**.
4. Bấm kiểm tra kết nối rồi gửi `/menu` cho bot.

Không chia sẻ Bot Token hoặc Chat ID.

### Các thao tác chính

Bot dùng nút chọn, không yêu cầu nhớ tên Page:

- Chạy Trang cá nhân hoặc Fanpage.
- Thêm Fanpage.
- Thêm lịch cho Trang cá nhân hoặc Fanpage.
- Xem **Lịch đã lên**.
- Sửa lịch bằng nút `✏️`.
- Xóa lịch bằng nút `🗑` và xác nhận.
- Xem phiên đang chạy hoặc dừng phiên.

Lịch thêm/sửa/xóa từ Telegram được lưu vào cùng dữ liệu của ứng dụng. Mở hoặc bấm **Làm mới** để kiểm tra giao diện sau khi thao tác từ bot.

## 8. Xử lý sự cố

### Proxy yêu cầu đăng nhập hoặc mất kết nối

- Kiểm tra đúng định dạng proxy và bấm **Test Proxy**.
- Không mở hai cửa sổ dùng cùng hồ sơ.
- Nếu proxy mất giữa phiên, xem nhật ký và kiểm tra lại IP trước khi chạy tiếp.

### Facebook yêu cầu CAPTCHA/2FA

- Hoàn tất thủ công trong đúng cửa sổ Chromium của hồ sơ.
- Chờ Facebook về trang chủ rồi kiểm tra lại đăng nhập.
- Không chạy lại liên tục khi Facebook vẫn đang yêu cầu xác minh.

### Không tìm thấy hoặc không chuyển được Fanpage

- Kiểm tra đúng tên/link Page đã lưu.
- Mở Facebook thủ công, xác nhận Page xuất hiện trong **See all profiles**.
- Kiểm tra tài khoản còn quyền quản trị/truy cập Page.
- Nếu Facebook vừa thay đổi giao diện, lưu ảnh màn hình và dòng nhật ký mới nhất để đối chiếu.

### Reels không phát hoặc không chuyển

- Thử mở và phát một Reel thủ công.
- Kiểm tra proxy có tải được video hay không.
- Phiên ngắn một phút có thể chưa tới giai đoạn Reels; dùng phiên thử ít nhất năm phút.

## 9. Sao lưu và an toàn dữ liệu

- Không chia sẻ thư mục hồ sơ Chromium, Bot Token, proxy hoặc thông tin đăng nhập.
- Không xóa dữ liệu ứng dụng nếu chưa sao lưu và chưa xác định rõ mục đích.
- Trước cập nhật lớn, ghi lại danh sách hồ sơ, Page và lịch quan trọng.
- Luôn dừng phiên trước khi tắt máy hoặc cập nhật ứng dụng.

## 10. Quy ước phiên bản

Phiên bản tăng lần lượt `1.0.1` đến `1.0.9`, sau đó chuyển sang `2.0.1` đến `2.0.9`, rồi `3.0.1` và tiếp tục tương tự.

## 11. Kiểm tra trước khi sử dụng thực tế

Thực hiện checklist tại [docs/acceptance-checklist.md](docs/acceptance-checklist.md). Chỉ đánh dấu **Đạt** sau khi đã quan sát trên tài khoản và proxy thật; kết quả build kỹ thuật không thay thế kiểm tra thực tế.
