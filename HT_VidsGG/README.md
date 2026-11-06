# HT Vids Studio

**HT Vids Studio** là ứng dụng desktop dành cho Windows, hỗ trợ quản lý nhiều tài khoản và tự động hóa quy trình tạo video bằng Google Vids.

> Đây là sản phẩm độc lập của HT Studio, không phải sản phẩm chính thức và không được Google tài trợ hoặc xác nhận.

## ⬇️ Tải và cài đặt

Phiên bản hiện tại: **2.0.9**

### [BẤM VÀO ĐÂY ĐỂ TẢI BỘ CÀI HT VIDS STUDIO 2.0.9 CHO WINDOWS x64](https://github.com/nlthieumedia-coder/HT_Studio/raw/refs/heads/main/HT_VidsGG/dist/latest/HT-Vids-Studio-Setup-2.0.9-Windows-x64.exe)

Nếu nút trên không hoạt động, dùng [đường dẫn tải trực tiếp dự phòng](dist/latest/HT-Vids-Studio-Setup-2.0.9-Windows-x64.exe). Các bản trước được lưu riêng trong [`dist/old`](dist/old) để đối chiếu khi cần.

Mã SHA-256: `1BAAFE6ECE02BD190AC2D3E493809F2D6B99BA2204AD43A6E4556805331B2DF4`

1. Tải và chạy file `HT-Vids-Studio-Setup-2.0.9-Windows-x64.exe`.
2. Chọn thư mục cài đặt và hoàn tất các bước trong trình cài đặt.
3. Mở **HT Vids Studio** từ shortcut Desktop hoặc menu Start.
4. Nhập key bản quyền do HT Studio cung cấp.
5. Thêm tài khoản Google, đăng nhập và bắt đầu tạo video.

Windows SmartScreen có thể cảnh báo khi bản phát hành chưa được ký Code Signing. Chỉ chọn **More info → Run anyway** khi file được tải từ repository chính thức của HT Studio.

## Chức năng chính

- Quản lý nhiều tài khoản Google bằng các profile trình duyệt độc lập.
- Thêm và thao tác hàng loạt nhiều tài khoản.
- Chọn nhanh tài khoản theo trạng thái và bật hoặc tắt hàng loạt ngay trong tab **Tài khoản**.
- Kiểm tra gói Google AI của từng tài khoản hoặc kiểm tra hàng loạt.
- Kiểm tra riêng hạn mức tạo video còn lại, không phụ thuộc chức năng kiểm tra gói.
- Chạy các tác vụ kiểm tra bằng Chromium ẩn; đăng nhập và xác minh bảo mật vẫn sử dụng cửa sổ Chrome thông thường.
- So sánh hạn mức của từng tài khoản với **thời lượng video đang yêu cầu**; tài khoản chỉ bị tạm tắt khi số giây còn lại không đủ.
- Ưu tiên tài khoản có hạn mức khớp chính xác với thời lượng task và vẫn tiếp tục tạo khi Google hiển thị cảnh báo nhưng số dư còn đủ.
- Nhập thời lượng video linh hoạt từ **5 đến 20 giây**, không bị khóa tại một mốc cố định.
- Hỗ trợ video dọc `9:16` và video ngang `16:9`; Canvas chỉ được đổi khi bắt đầu tạo video.
- Nhập prompt, prompt Extend, ảnh tham chiếu và độ phân giải trên cùng màn hình.
- Tạo task chờ, chạy ngay hoặc chạy hàng loạt trên các tài khoản đang khả dụng.
- Tự phân phối hàng đợi; mỗi tài khoản chỉ xử lý một task tại một thời điểm.
- Theo dõi tiến độ, xem lỗi, sửa và chạy lại task.
- Tự tải video MP4 và hỗ trợ xóa watermark AI.
- Kho video, trình xem video và bảng thống kê theo ngày.
- Kích hoạt bản quyền theo mã máy và kiểm tra trạng thái bản quyền từ xa.
- Tự kiểm tra phiên bản mới từ kho phát hành chính thức và hiển thị popup có nút tải trực tiếp; ứng dụng không tự cài đặt hoặc làm gián đoạn task đang chạy.
- Hỗ trợ đặt phiên bản tối thiểu bắt buộc; bản thấp hơn mức này bị khóa giao diện cho tới khi người dùng tải bản mới.
- Nút **Donate** trên thanh tiêu đề mở nhanh popup ủng hộ HT Studio; việc ủng hộ hoàn toàn tự nguyện và không ảnh hưởng quyền lợi bản quyền.

## Quy trình sử dụng nhanh

1. Vào tab **Tài khoản** và thêm một hoặc nhiều tài khoản Google.
2. Mở Chrome để đăng nhập nếu tài khoản chưa có phiên đăng nhập hợp lệ.
3. Dùng biểu tượng **Kiểm tra gói** để đọc loại tài khoản Standard, Pro hoặc Ultra.
4. Dùng biểu tượng **Kiểm tra lượt** để đọc khả năng và số giây tạo video còn lại.
5. Vào màn hình tạo video, nhập prompt, thời lượng, tỷ lệ khung hình và ảnh tham chiếu nếu cần.
6. Chọn chạy ngay hoặc đưa task vào hàng đợi.
7. Theo dõi kết quả trong **Hàng đợi**, **Kho video** hoặc thư mục đầu ra.

Các nút thao tác trong box tài khoản sử dụng biểu tượng để giao diện gọn hơn. Di chuột lên biểu tượng để xem tên chức năng; nút tắt tài khoản được đặt ở vị trí cuối nhằm hạn chế thao tác nhầm.

## Kiểm tra tài khoản hàng loạt

- Chọn các tài khoản cần xử lý trong tab **Tài khoản**.
- Dùng menu **Chọn nhanh** để chọn toàn bộ tài khoản đang bật, đang tắt, sẵn sàng, đang chạy, cần đăng nhập, còn lượt hoặc hết lượt.
- Chọn **Bật hàng loạt** hoặc **Tắt hàng loạt**; hệ thống tự bỏ qua tài khoản đang bận để không làm gián đoạn task.
- Chọn **Kiểm tra gói hàng loạt** để cập nhật loại gói.
- Chọn **Kiểm tra lượt hàng loạt** để cập nhật hạn mức tạo video.
- Nếu hệ thống xác định tài khoản đã hết lượt hoặc không đủ số giây cho thời lượng đang chọn, tài khoản đó sẽ tự chuyển sang trạng thái tắt.
- Tài khoản từng bị tự tắt vì ngưỡng quota sẽ được bật lại khi nhận task ngắn hơn mà số dư vẫn đủ; tài khoản do người dùng tắt thủ công không bị tự bật.
- Lỗi tạm thời do mạng, timeout hoặc giao diện Google thay đổi không được coi là bằng chứng tài khoản đã hết lượt.

## Yêu cầu hệ thống

- Windows 10 hoặc Windows 11 x64.
- Google Chrome.
- Kết nối Internet ổn định.
- Tài khoản Google có quyền truy cập Google Vids và tính năng AI tương ứng.

## Dữ liệu và quyền riêng tư

- Profile đăng nhập và trạng thái ứng dụng được lưu cục bộ trong AppData trên máy người dùng.
- Mỗi tài khoản sử dụng một profile trình duyệt riêng.
- Thông tin nhạy cảm được bảo vệ bằng cơ chế bảo mật của Windows và không được đóng kèm trong repository công khai.
- Bộ cài không chứa tài khoản, mật khẩu, ảnh đầu vào hoặc video của máy phát triển.
- Người dùng chịu trách nhiệm về tài khoản Google, nội dung tạo ra và việc tuân thủ điều khoản của Google.

## Bản quyền

Mỗi key được liên kết với một mã máy. Ứng dụng xác minh trạng thái khi khởi động, khi cửa sổ được focus và định kỳ trong quá trình sử dụng. Hãy liên hệ HT Studio khi đổi máy hoặc cần cấp lại bản quyền.

## Xử lý sự cố nhanh

- **Chưa đăng nhập:** mở Chrome từ nút tương ứng, hoàn tất đăng nhập/2FA rồi đóng cửa sổ Chrome để lưu profile.
- **Kiểm tra bị timeout:** kiểm tra mạng và thử lại; Google Vids có thể tải chậm hoặc thay đổi giao diện.
- **Không còn đủ lượt:** xem số giây còn lại trong box tài khoản; hệ thống đối chiếu trực tiếp với thời lượng video đang chọn.
- **Task đứng sau khi tải ảnh:** phiên bản 2.0.5 hỗ trợ giao diện `Image1/Image2` và luồng `Add → Upload`; hãy bấm Chạy lại nếu task được tạo từ phiên bản cũ.
- **Task tạo video lỗi:** mở thông báo hoặc hàng đợi để xem chi tiết, sau đó sửa và chạy lại task.
- **Không thấy video đầu ra:** kiểm tra Kho video và thư mục tải xuống đã chọn trong ứng dụng.

Hướng dẫn chi tiết nằm trong [HUONG_DAN_SU_DUNG.md](HUONG_DAN_SU_DUNG.md) và được tích hợp trực tiếp trong ứng dụng.

## Cập nhật phiên bản

- Từ phiên bản **2.0.6**, ứng dụng kiểm tra bản mới khi khởi động, khi người dùng quay lại cửa sổ và định kỳ trong lúc sử dụng.
- Khi có bản mới, popup sẽ hiển thị phiên bản hiện tại, phiên bản mới, nội dung thay đổi và nút **Tải phiên bản mới**.
- Với cập nhật thông thường, chọn **Để sau** sẽ tạm ẩn thông báo trong 12 giờ rồi nhắc lại.
- Với cập nhật bắt buộc, popup không có nút đóng hoặc **Để sau** và người dùng không thể tiếp tục thao tác trên phiên bản cũ.
- Ứng dụng chỉ mở đường dẫn tải chính thức trên GitHub; không tự tải, tự cài hoặc tự đóng task đang chạy.

> Người đang sử dụng 2.0.5 trở xuống cần tải 2.0.6 thủ công một lần. Từ 2.0.6 trở đi, ứng dụng mới có khả năng tự thông báo các phiên bản tiếp theo.

> Lưu ý chuyển tiếp: 2.0.6 và 2.0.7 chưa có mã khóa cập nhật bắt buộc, nên vẫn có thể chọn **Để sau** khi được mời lên 2.0.8. Sau khi đã cài 2.0.8, mọi bản thấp hơn mức hỗ trợ tối thiểu do HT Studio công bố sẽ bị khóa bắt buộc cập nhật.

## Phiên bản 2.0.9

- Thay huy hiệu **PRO TRỌN ĐỜI** trên thanh tiêu đề bằng nút **Donate**.
- Cho phép mở ngay popup ủng hộ với mã QR và thông tin chuyển khoản khi bấm nút.
- Giữ nguyên đầy đủ chức năng và quyền lợi bản quyền; việc ủng hộ hoàn toàn tự nguyện.
- Chuyển bản phát hành chính sang bộ cài Windows Setup và bắt buộc các bản 2.0.8 trở xuống cập nhật lên 2.0.9.

## Phiên bản 2.0.8

- Thêm trường `minimumSupportedVersion` vào thông tin phát hành.
- Khóa toàn bộ giao diện khi phiên bản hiện tại thấp hơn mức hỗ trợ tối thiểu.
- Không cho đóng popup bằng nút X, phím Esc, bấm ra ngoài hoặc lựa chọn nhắc lại sau.
- Giữ popup sau khi mở trang tải và ghi nhớ yêu cầu bắt buộc cho các lần khởi động sau.

## Phiên bản 2.0.7

- Thêm menu chọn nhanh tài khoản theo nhiều trạng thái vận hành và hạn mức.
- Bổ sung nút bật lại hàng loạt cho các tài khoản đang tắt.
- Không gửi lệnh bật/tắt tới tài khoản đang chạy, đang đăng nhập hoặc đang kiểm tra.
- Đồng bộ lại lựa chọn sau khi thao tác hàng loạt để giao diện luôn phản ánh đúng trạng thái.

## Phiên bản 2.0.6

- Bổ sung kiểm tra cập nhật tự động qua tệp thông tin phiên bản công khai trên GitHub.
- Thêm popup tiếng Việt với ghi chú phát hành, nút tải trực tiếp và lựa chọn nhắc lại sau.
- Giới hạn tần suất kiểm tra để không làm phiền hoặc ảnh hưởng hiệu năng.
- Chỉ chấp nhận đường dẫn cập nhật thuộc repository HT Studio trên GitHub.

## Phiên bản 2.0.5

- Ưu tiên tài khoản có số giây hạn mức khớp chính xác với thời lượng video và tiếp tục tạo khi hạn mức vẫn đủ.
- Thích nghi giao diện tải ảnh mới của Google Vids, nhận diện `Image1/Image2` và luồng `Add → Upload` để tránh đứng task.
- Chuyển lỗi kỹ thuật dài thành thông báo tiếng Việt ngắn gọn, có mã nhận biết và hướng xử lý phù hợp.
- Tự chuyển đổi các lỗi cũ đã lưu từ phiên bản trước sang định dạng dễ hiểu.

## Phiên bản 2.0.4

- Bổ sung kiểm tra gói và kiểm tra lượt tạo video hàng loạt.
- Chuyển các luồng kiểm tra tài khoản sang Chromium ẩn.
- Cho phép nhập thời lượng video từ 5 đến 20 giây.
- Tự tắt tài khoản không đủ tối thiểu 10 giây tạo video sau kiểm tra hàng loạt.
- Tối giản nút thao tác tài khoản bằng biểu tượng và tooltip.
- Dọn dẹp mã chết và các bản đóng gói cũ; giữ nguyên luồng sử dụng ổn định.

## Hỗ trợ

Kênh Zalo và Telegram hỗ trợ được hiển thị trực tiếp trong ứng dụng.

## Giấy phép

Phần mềm thương mại, bảo lưu mọi quyền. Không được sao chép, bán lại, dịch ngược hoặc phân phối lại khi chưa có sự cho phép bằng văn bản của HT Studio.
