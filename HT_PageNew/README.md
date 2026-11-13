# HT PageNew

**HT PageNew** là ứng dụng desktop dành cho Windows, dùng Chromium riêng cho từng hồ sơ để quản lý phiên xem Facebook Feed/Reels, Fanpage, lịch chạy và thông báo Telegram.

> Đây là sản phẩm độc lập của HT Studio, không phải sản phẩm chính thức và không được Facebook/Meta tài trợ hoặc xác nhận.

## ⬇️ Tải và cài đặt

Phiên bản hiện tại: **1.0.3**

### [BẤM VÀO ĐÂY ĐỂ TẢI BỘ CÀI HT PAGENEW 1.0.3 CHO WINDOWS x64](https://media.githubusercontent.com/media/nlthieumedia-coder/HT_Studio/main/HT_PageNew/release/HT-PageNew-Setup-1.0.3-Windows-x64.exe)

Mã SHA-256: `E8C887E08BDDE1F2C8CBD84F2E097C20BDABEE2B708D89683849B679B24278BB`

1. Tải và chạy file `HT-PageNew-Setup-1.0.3-Windows-x64.exe`.
2. Chọn thư mục cài đặt và hoàn tất các bước trong trình cài đặt.
3. Mở **HT PageNew** từ shortcut Desktop hoặc menu Start.
4. Sao chép mã máy và nhập key bản quyền do HT Studio cung cấp.
5. Tạo hồ sơ, đăng nhập Facebook thủ công và cấu hình Page hoặc lịch chạy.

Windows SmartScreen có thể cảnh báo khi bản phát hành chưa được ký Code Signing. Chỉ chọn **More info → Run anyway** khi file được tải từ repository chính thức của HT Studio.

## Chức năng chính

- Quản lý nhiều hồ sơ Facebook bằng các thư mục Chromium độc lập.
- Cấu hình Trang cá nhân, Fanpage, proxy và thời lượng chạy riêng cho từng hồ sơ.
- Chạy Feed/Reels ngay hoặc tự động theo nhiều khung giờ đã lên lịch.
- Điều khiển và nhận thông báo qua Telegram.
- Kích hoạt bản quyền theo mã máy, kiểm tra trạng thái key từ xa và hỗ trợ thu hồi khi cần.
- Kiểm tra phiên bản trên GitHub, tải bộ cài và xác minh SHA-256 trước khi cập nhật.
- Gửi phiếu hỗ trợ kèm ảnh chụp và nhận phản hồi của admin ngay trong ứng dụng.
- Tích hợp trung tâm Hướng dẫn, Liên hệ admin, Donate và lời nhắc ủng hộ tự nguyện.

## Phiên bản 1.0.3

- Đồng bộ màu sắc, kích thước, sidebar, topbar, bảng và biểu mẫu với HT Vids Studio.
- Chuyển toàn bộ popup Hướng dẫn, Hỗ trợ, Donate và Kiểm tra phiên bản sang giao diện HT Vids Studio.
- Cập nhật màn hình kiểm tra mã máy, xác minh bản quyền và kích hoạt key theo HWID.
- Bổ sung popup liên hệ admin bằng mã QR Zalo và Telegram ngay tại màn hình kích hoạt.
- Hoàn thiện quản lý key và phiếu hỗ trợ dùng chung Google Sheets với HT Vids Studio.
- Giữ cơ chế kiểm tra phiên bản, tải bản cập nhật và xác minh SHA-256 trước khi cài đặt.
- Sửa nhãn phiên bản để luôn hiển thị phiên bản HT PageNew thay vì phiên bản Electron khi chạy ứng dụng.

## Yêu cầu hệ thống

- Windows 10 hoặc Windows 11 x64.
- Kết nối Internet ổn định.
- Tối thiểu 1 GB dung lượng ổ đĩa trống cho ứng dụng và dữ liệu hồ sơ.
- Tài khoản Facebook hợp lệ; người dùng tự quản lý quyền truy cập Trang cá nhân/Fanpage.
- Proxy và Telegram là tùy chọn, chỉ cần thiết khi người dùng bật các chức năng tương ứng.

Ứng dụng không lưu mật khẩu Facebook và không tự giải hoặc bỏ qua CAPTCHA/2FA. Người dùng đăng nhập, xác minh thủ công và chịu trách nhiệm sử dụng tài khoản đúng quyền hạn, chính sách của Facebook.

Khi cập nhật bản mới:

1. Dừng các phiên đang chạy và thoát HT PageNew.
2. Chạy bộ cài phiên bản mới. Không cần gỡ bản cũ trước nếu cài cùng vị trí.
3. Mở ứng dụng, kiểm tra hồ sơ, Page và lịch đã lưu.
4. Giữ bản cài cũ cho đến khi xác nhận bản mới hoạt động ổn định.

Dữ liệu hồ sơ Chromium nằm trong vùng dữ liệu người dùng của Windows, không nằm trong thư mục cài đặt. Không tự ý sao chép hoặc dùng chung một hồ sơ trên hai máy.

## Tạo hồ sơ và đăng nhập Facebook

1. Mở **Hồ sơ tài khoản** → **Thêm Hồ Sơ Mới**.
2. Nhập tên hồ sơ và proxy nếu sử dụng.
3. Bấm **Test Proxy**, xác nhận IP và trạng thái kết nối.
4. Lưu hồ sơ rồi bấm **FB** để mở Chromium của hồ sơ đó.
5. Đăng nhập Facebook thủ công; hoàn tất CAPTCHA, 2FA hoặc checkpoint nếu Facebook yêu cầu.
6. Đóng Chromium rồi mở lại bằng nút **FB** để kiểm tra phiên đăng nhập được giữ.

Mỗi hồ sơ có thư mục Chromium độc lập. Không mở cùng một hồ sơ bằng nhiều tiến trình Chromium cùng lúc.

## Cấu hình Fanpage

1. Tại **Hồ sơ tài khoản**, bấm **Cấu hình Page**.
2. Nhập đúng tên hiển thị và đường dẫn Facebook của Page.
3. Thêm các Page cần quản lý rồi lưu.

Phần này chỉ lưu tên và link Page; lịch được cấu hình riêng trong tab **Lịch chạy**. Nếu hồ sơ không có Fanpage, hệ thống mặc định chạy bằng **Trang cá nhân**.

Tài khoản Facebook phải có quyền truy cập Page và Page phải xuất hiện trong **See all profiles/Xem tất cả trang cá nhân**.

## Chạy ngay

1. Chọn **Trang cá nhân** hoặc Fanpage trong dòng hồ sơ.
2. Chọn thời lượng.
3. Bấm **Chạy ngay**.
4. Theo dõi trạng thái: **Đang chờ**, **Đang chạy**, **Đã hoàn thành**, **Cần xác minh** hoặc **Lỗi**.

Khi chạy Fanpage, ứng dụng chỉ bắt đầu cuộn sau khi xác nhận đã chuyển đúng danh tính Page. Nếu không xác nhận được, phiên sẽ dừng để tránh chạy nhầm tài khoản. Bấm **Dừng ngay** nếu muốn kết thúc sớm.

## Thêm, sửa và xóa lịch

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

## Nhật ký và theo dõi

Tab **Lịch đã lên** hiển thị lịch theo ngày/khung giờ. Tab **Nhật ký hoạt động** ghi hồ sơ, danh tính, thời điểm bắt đầu/kết thúc và nguyên nhân dừng.

Nhật ký không ghi cookie, token hoặc mật khẩu Facebook/proxy. Khi báo lỗi, nên chụp lại dòng nhật ký mới nhất và thời điểm xảy ra lỗi.

## Telegram

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

## Xử lý sự cố

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

## Sao lưu và an toàn dữ liệu

- Không chia sẻ thư mục hồ sơ Chromium, Bot Token, proxy hoặc thông tin đăng nhập.
- Không xóa dữ liệu ứng dụng nếu chưa sao lưu và chưa xác định rõ mục đích.
- Trước cập nhật lớn, ghi lại danh sách hồ sơ, Page và lịch quan trọng.
- Luôn dừng phiên trước khi tắt máy hoặc cập nhật ứng dụng.

## Quy ước phiên bản

Phiên bản tăng lần lượt `1.0.1` đến `1.0.9`, sau đó chuyển sang `2.0.1` đến `2.0.9`, rồi `3.0.1` và tiếp tục tương tự.

## Kiểm tra trước khi sử dụng thực tế

Trước khi sử dụng thực tế, hãy kiểm tra đăng nhập, proxy, danh sách Page, lịch chạy, Telegram và nhật ký trên một tài khoản thử nghiệm. Kết quả build kỹ thuật không thay thế kiểm tra vận hành thực tế.
## Dịch vụ nền tảng HT Studio

HT PageNew tích hợp các chức năng dùng chung từ HT Vids Studio:

- Kích hoạt key theo mã máy và kiểm tra lại khi khởi động, focus cửa sổ và mỗi 5 phút.
- Quản lý key, khóa/thu hồi từ xa và phiếu hỗ trợ qua Google Sheets/Drive.
- Kiểm tra phiên bản trên GitHub mỗi 5 phút; tải bộ cài, xác minh SHA-256 rồi mới cho phép cài.
- Trung tâm hướng dẫn có thông tin liên hệ admin, donate và lời nhắc donate tự nguyện.
- Gửi phiếu hỗ trợ kèm tối đa 3 ảnh hoặc ảnh chụp cửa sổ; nhận phản hồi admin trong ứng dụng.

Dịch vụ bản quyền và Google Sheets do HT Studio quản lý; người dùng không cần triển khai máy chủ riêng.

## Bản quyền

Mỗi key được liên kết với một mã máy. Ứng dụng xác minh trạng thái khi khởi động, khi cửa sổ được focus và định kỳ trong quá trình sử dụng. Hãy liên hệ HT Studio khi đổi máy hoặc cần cấp lại bản quyền.

## Hỗ trợ

- **Zalo:** 0357 642 647 — Nguyễn Lê Trung Hiếu
- **Telegram:** [@NLTH_MEDIA](https://t.me/NLTH_MEDIA)
- Có thể mở **Hỗ trợ** trong ứng dụng để gửi phiếu kèm tối đa 3 ảnh và nhận phản hồi từ admin.

## Giấy phép

Phần mềm thương mại, bảo lưu mọi quyền. Không được sao chép, bán lại, dịch ngược hoặc phân phối lại khi chưa có sự cho phép bằng văn bản của HT Studio.
