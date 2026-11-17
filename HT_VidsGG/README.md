# HT Vids Studio

**HT Vids Studio** là ứng dụng desktop dành cho Windows, giúp quản lý nhiều tài khoản Google và tự động hóa quy trình tạo video bằng Google Vids. Ứng dụng hỗ trợ tạo từng video hoặc xử lý hàng loạt theo chiến dịch, tự phân phối công việc, tải video và lưu kết quả về máy.

> HT Vids Studio là sản phẩm độc lập của HT Studio, không phải sản phẩm chính thức và không được Google tài trợ hoặc xác nhận.

## Tải phiên bản mới nhất

Phiên bản hiện tại: **5.0.3** dành cho **Windows 10/11 x64**.

### [TẢI HT VIDS STUDIO 5.0.3](https://media.githubusercontent.com/media/nlthieumedia-coder/HT_Studio/main/HT_VidsGG/dist/latest/HT-Vids-Studio-Setup-5.0.3-Windows-x64.exe)

- Tên bộ cài: `HT-Vids-Studio-Setup-5.0.3-Windows-x64.exe`
- SHA-256: `4C19183E50B367D6CD50C7AD497C9A84A686EDFC94877AF952047D670A4D1C8B`

Nếu liên kết chưa tải ngay, hãy chờ Git LFS đồng bộ trong ít phút rồi thử lại. Mã nguồn của bản phát hành nằm tại [tag v5.0.3](https://github.com/nlthieumedia-coder/HT_Studio/tree/v5.0.3/HT_VidsGG).

## Ứng dụng làm được gì?

- Quản lý nhiều tài khoản Google bằng các hồ sơ trình duyệt độc lập.
- Kiểm tra gói Google AI và hạn mức tạo video của từng tài khoản.
- Tạo video dọc `9:16` hoặc ngang `16:9`, độ phân giải tùy theo tài khoản.
- Hỗ trợ thời lượng từ **5 đến 20 giây** và ảnh tham chiếu.
- Tạo nhiều video theo danh sách, mỗi dòng có prompt và cấu hình riêng.
- Gom công việc thành chiến dịch, tự lưu prompt, ảnh và video đầu ra.
- Tự phân phối task theo hàng đợi FIFO cho các tài khoản đang sẵn sàng.
- Cho phép chạy, dừng, hủy hoặc chạy lại riêng từng task.
- Theo dõi tiến độ, lỗi và kết quả trong ứng dụng.
- Tự tải MP4, lưu vào kho video và thư mục chiến dịch.
- Kiểm tra phiên bản mới và hỗ trợ cập nhật ngay trong ứng dụng.

## Cài đặt

1. Tải bộ cài từ liên kết ở trên.
2. Chạy file `HT-Vids-Studio-Setup-5.0.3-Windows-x64.exe`.
3. Chọn thư mục cài đặt và hoàn tất trình cài đặt.
4. Mở **HT Vids Studio** từ Desktop hoặc menu Start.
5. Kích hoạt bản quyền, sau đó thêm tài khoản Google để bắt đầu.

### Cảnh báo Windows SmartScreen

Bản phát hành hiện chưa được ký Code Signing nên Windows có thể hiển thị cảnh báo SmartScreen. Chỉ tiếp tục khi bộ cài được tải từ repository chính thức này:

1. Chọn **More info**.
2. Kiểm tra đúng tên file bộ cài.
3. Chọn **Run anyway**.

Bạn có thể kiểm tra mã SHA-256 bằng PowerShell:

```powershell
Get-FileHash .\HT-Vids-Studio-Setup-5.0.3-Windows-x64.exe -Algorithm SHA256
```

## Kích hoạt bản quyền

Mỗi key bản quyền chỉ dùng cho **một máy tính** và được liên kết với mã phần cứng của máy đó.

1. Mở ứng dụng để xem **Mã phần cứng máy tính (HWID)**.
2. Bấm **Sao chép mã** và gửi HWID cho HT Studio.
3. Nhận key bản quyền tương ứng từ HT Studio.
4. Dán key vào ô **Mã key bản quyền** và bấm kích hoạt.

Khi thay máy, cài lại Windows làm thay đổi HWID hoặc cần cấp lại key, hãy gửi HWID mới cho HT Studio. Không chia sẻ key công khai vì key không có tác dụng trên máy khác.

Ứng dụng cần Internet để xác minh bản quyền. Nếu xuất hiện thông báo không thể kết nối máy chủ, hãy kiểm tra mạng, ngày giờ Windows, tường lửa hoặc VPN rồi thử lại.

## Bắt đầu sử dụng

### 1. Thêm tài khoản Google

1. Mở tab **Tài khoản**.
2. Thêm tài khoản mới và mở Chrome từ ứng dụng.
3. Hoàn tất đăng nhập và xác minh hai bước nếu có.
4. Đóng cửa sổ Chrome để ứng dụng lưu trạng thái đăng nhập.
5. Dùng **Kiểm tra gói** và **Kiểm tra lượt** để đọc khả năng của tài khoản.

Mỗi tài khoản sử dụng một profile riêng. Không sao chép profile hoặc tệp thông tin đăng nhập giữa các máy.

### 2. Tạo một video

1. Mở tab **Tạo video**.
2. Nhập prompt và prompt Extend nếu video dài hơn 15 giây.
3. Chọn tỷ lệ, độ phân giải và thời lượng.
4. Thêm tối đa 3 ảnh tham chiếu nếu cần.
5. Chọn tài khoản phù hợp và bắt đầu tạo.
6. Theo dõi tiến độ trong **Hàng đợi** hoặc **Kho video**.

### 3. Tạo video hàng loạt

1. Mở tab **Tạo video hàng loạt**.
2. Tạo hoặc mở một chiến dịch.
3. Thêm các dòng video; mỗi dòng tương ứng với một video.
4. Nhập prompt, ảnh, tỷ lệ, độ phân giải và thời lượng cho từng dòng.
5. Chọn **Tạo video** để chạy ngay hoặc **Thêm vào hàng đợi**.
6. Dùng các nút **Chạy**, **Dừng**, **Hủy** hoặc **Chạy lại** cho từng dòng khi cần.

Ứng dụng tự chọn tài khoản phù hợp dựa trên gói, hạn mức, tỷ lệ, độ phân giải và thời lượng của task. Mỗi tài khoản chỉ xử lý một task tại một thời điểm.

## Nơi lưu video

- Thư mục mặc định: `Downloads\HT Vids Studio`.
- Với chiến dịch, mỗi chiến dịch có thư mục riêng chứa cấu hình, ảnh và video.
- Video hoàn thành cũng xuất hiện trong **Kho video** của ứng dụng.

Bạn có thể đổi thư mục đầu ra trong phần cấu hình. Hãy bảo đảm thư mục còn dung lượng và ứng dụng có quyền ghi.

## Yêu cầu hệ thống

- Windows 10 hoặc Windows 11, kiến trúc x64.
- Google Chrome hoặc Microsoft Edge.
- Kết nối Internet ổn định.
- Tài khoản Google có quyền sử dụng Google Vids và tính năng AI tương ứng.
- Dung lượng trống đủ cho video đầu ra và dữ liệu tạm.

## Xử lý sự cố nhanh

| Hiện tượng | Cách xử lý |
| --- | --- |
| Không kích hoạt được key | Kiểm tra Internet, đúng HWID và đúng key được cấp cho máy. |
| Không thể kết nối máy chủ bản quyền | Tắt VPN/proxy tạm thời, kiểm tra tường lửa và ngày giờ Windows rồi thử lại. |
| Tài khoản yêu cầu đăng nhập | Mở Chrome từ đúng tài khoản trong ứng dụng, đăng nhập xong rồi đóng Chrome. |
| Kiểm tra gói hoặc hạn mức bị timeout | Kiểm tra mạng và thử lại; giao diện Google đôi khi tải chậm hoặc thay đổi. |
| Task không chạy | Kiểm tra tài khoản đang bật, còn hạn mức và hỗ trợ cấu hình của task. |
| Task lỗi hoặc đã hủy | Mở chi tiết lỗi, chỉnh cấu hình rồi dùng **Chạy lại**. |
| Không tìm thấy video | Kiểm tra **Kho video**, thư mục chiến dịch và thư mục đầu ra đã chọn. |
| Không ghi được file | Chọn thư mục khác, kiểm tra dung lượng và quyền của Windows/antivirus. |

Ứng dụng có mục **Kiểm tra hệ thống** để kiểm tra trình duyệt, FFmpeg, quyền ghi, dung lượng và kết nối mạng. Khi cần hỗ trợ, dùng **Xuất chẩn đoán** hoặc **Phiếu hỗ trợ** trong ứng dụng.

## Dữ liệu và quyền riêng tư

- Profile đăng nhập và trạng thái ứng dụng được lưu cục bộ trên máy người dùng.
- Thông tin nhạy cảm được bảo vệ bằng cơ chế bảo mật của Windows.
- Bộ cài không chứa tài khoản, mật khẩu, cookie, ảnh hoặc video của máy phát triển.
- File chẩn đoán tự loại bỏ mật khẩu, cookie, token, prompt, ảnh tham chiếu và video.
- Phiếu hỗ trợ chỉ được gửi khi người dùng chủ động thực hiện.
- Người dùng chịu trách nhiệm về tài khoản Google, nội dung tạo ra và việc tuân thủ điều khoản của Google.

## Cập nhật ứng dụng

Ứng dụng tự kiểm tra phiên bản mới khi khởi động, khi cửa sổ được mở lại và định kỳ trong quá trình sử dụng. Bạn cũng có thể bấm **Kiểm tra phiên bản** ở cuối thanh bên.

Khi có bản mới, ứng dụng hiển thị nội dung thay đổi, tải bộ cài trong nền, kiểm tra dung lượng và SHA-256 trước khi cài đặt. Các phiên bản quá cũ có thể bị yêu cầu cập nhật trước khi tiếp tục sử dụng.

## Điểm mới trong phiên bản 5.0.3

- Tự xác minh lại một lần khi tài khoản không đáp ứng thời lượng video.
- Ghi nhớ thời lượng tối đa đã được xác nhận của từng tài khoản.
- Tự chuyển task sang tài khoản phù hợp khác khi cần.
- Không chọn lại tài khoản cho task vượt quá khả năng đã xác nhận.
- Phân biệt giới hạn thời lượng của model với hạn mức tạo video theo tháng.

Xem mã nguồn đúng bản phát hành tại [v5.0.3](https://github.com/nlthieumedia-coder/HT_Studio/tree/v5.0.3/HT_VidsGG). Các bản cũ được lưu trong [`dist/old`](dist/old).

## Hướng dẫn và hỗ trợ

- [Hướng dẫn sử dụng chi tiết](HUONG_DAN_SU_DUNG.md)
- Kênh Zalo và Telegram hỗ trợ được hiển thị trực tiếp trong ứng dụng.
- Khi báo lỗi, nên gửi kèm mô tả thao tác, ảnh chụp và file chẩn đoán do ứng dụng tạo.

## Giấy phép

Đây là phần mềm thương mại, bảo lưu mọi quyền. Không được sao chép, bán lại, dịch ngược hoặc phân phối lại khi chưa có sự cho phép bằng văn bản của HT Studio.

Ứng dụng đóng gói `GeminiWatermarkTool-Video`, một thành phần bên thứ ba được tài liệu phát hành xác định theo giấy phép MIT. Thông báo bản quyền và thông tin kiểm tra thành phần được lưu cùng bộ cài.
