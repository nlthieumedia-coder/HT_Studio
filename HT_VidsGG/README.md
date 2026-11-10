# HT Vids Studio

**HT Vids Studio** là ứng dụng desktop dành cho Windows, hỗ trợ quản lý nhiều tài khoản và tự động hóa quy trình tạo video bằng Google Vids.

> Đây là sản phẩm độc lập của HT Studio, không phải sản phẩm chính thức và không được Google tài trợ hoặc xác nhận.

## ⬇️ Tải và cài đặt

Phiên bản hiện tại: **3.0.8**

### [BẤM VÀO ĐÂY ĐỂ TẢI BỘ CÀI HT VIDS STUDIO 3.0.8 CHO WINDOWS x64](https://github.com/nlthieumedia-coder/HT_Studio/releases/download/v3.0.8/HT-Vids-Studio-Setup-3.0.8-Windows-x64.exe)

Nếu nút trên không hoạt động, dùng [máy chủ media dự phòng](https://media.githubusercontent.com/media/nlthieumedia-coder/HT_Studio/main/HT_VidsGG/dist/latest/HT-Vids-Studio-Setup-3.0.8-Windows-x64.exe). Xem đầy đủ nội dung phát hành tại [GitHub Release v3.0.8](https://github.com/nlthieumedia-coder/HT_Studio/releases/tag/v3.0.8). Các bản trước được lưu riêng trong [`dist/old`](dist/old) để đối chiếu khi cần.

Mã SHA-256: `47954BFDAF076364A00730EF48A6942924C193FD20F63A07C0A70B43A024C7B6`

1. Tải và chạy file `HT-Vids-Studio-Setup-3.0.8-Windows-x64.exe`.
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
- Nhập thời lượng video linh hoạt từ **5 đến 20 giây**; video 5–15 giây được tạo trực tiếp bằng một lượt, chỉ 16–20 giây mới cần Extend.
- Hỗ trợ video dọc `9:16` và video ngang `16:9`; Canvas chỉ được đổi khi bắt đầu tạo video.
- Nhập prompt, prompt Extend, ảnh tham chiếu và độ phân giải trên cùng màn hình.
- Tạo nhiều video theo dạng bảng tại tab **Tạo video hàng loạt**; mỗi dòng có prompt, ảnh tham chiếu, tỷ lệ, độ phân giải và thời lượng riêng. Ảnh được nhập song song, hiển thị bằng thumbnail nhẹ và không tải lại toàn bộ bảng.
- Quản lý nội dung theo **chiến dịch**; mỗi chiến dịch có thư mục độc lập để lưu cấu hình, ảnh và video đầu ra.
- Dán prompt nhiều dòng vào đúng một ô mà không tự sinh thêm task.
- Tạo task chờ, chạy ngay hoặc chạy hàng loạt trên các tài khoản đang khả dụng.
- Khi chạy, ứng dụng giữ nguyên tab hiện tại và đổi nút **Tạo video** thành **Dừng**; nút Dừng hủy toàn bộ task đang chờ hoặc đang chạy.
- Tự phân phối hàng đợi theo FIFO: task vào trước chạy trước; mỗi tài khoản chỉ xử lý một task tại một thời điểm.
- Theo dõi tiến độ, xem lỗi, sửa và chạy lại task.
- Tự tải video MP4; ưu tiên xóa watermark Gemini/Veo bằng AlphaJudge ML, reverse alpha và AI cleanup để hạn chế nhòe, đồng thời tự dùng chế độ tương thích khi cần.
- Kho video, trình xem video và bảng thống kê theo ngày.
- Kích hoạt bản quyền theo mã máy và kiểm tra trạng thái bản quyền từ xa.
- Có nút **Kiểm tra phiên bản** nhỏ gọn bên dưới thông tin phiên bản ở cuối sidebar; nếu không thao tác, ứng dụng vẫn tự kiểm tra khi khởi động, mỗi 5 phút, khi cửa sổ được focus và khi mạng kết nối lại.
- Hỗ trợ đặt phiên bản tối thiểu bắt buộc; bản thấp hơn mức này bị khóa giao diện cho tới khi người dùng tải bản mới.
- Nút **Donate** trên thanh tiêu đề và meme cà phê xuất hiện định kỳ trong sidebar mở nhanh mã QR ủng hộ HT Studio; việc ủng hộ hoàn toàn tự nguyện và không ảnh hưởng quyền lợi bản quyền.

## Quy trình sử dụng nhanh

1. Vào tab **Tài khoản** và thêm một hoặc nhiều tài khoản Google.
2. Mở Chrome để đăng nhập nếu tài khoản chưa có phiên đăng nhập hợp lệ.
3. Dùng biểu tượng **Kiểm tra gói** để đọc loại tài khoản Standard, Pro hoặc Ultra.
4. Dùng biểu tượng **Kiểm tra lượt** để đọc khả năng và số giây tạo video còn lại.
5. Vào **Tạo video** để tạo một video hoặc **Tạo video hàng loạt** để làm việc theo chiến dịch và danh sách nhiều dòng.
6. Nhập prompt, thời lượng, tỷ lệ khung hình, độ phân giải và ảnh tham chiếu nếu cần.
7. Chọn chạy ngay hoặc đưa task vào hàng đợi. Khi chạy ngay, bạn vẫn ở nguyên màn hình hiện tại và có thể bấm **Dừng** để hủy toàn bộ tiến trình.
8. Theo dõi kết quả trong **Hàng đợi**, **Kho video** hoặc thư mục đầu ra của chiến dịch.

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
- Có thể bấm **Kiểm tra phiên bản** bên dưới thông tin phiên bản ở cuối sidebar bất cứ lúc nào. Nút hiển thị trạng thái kiểm tra và thông báo rõ khi ứng dụng đã là bản mới nhất, có bản mới hoặc không thể kết nối.
- Khi có bản mới, popup sẽ hiển thị phiên bản hiện tại, phiên bản mới, nội dung thay đổi và nút **Tải phiên bản mới**.
- Mọi phiên bản mới đều là cập nhật bắt buộc. Popup không có nút đóng hoặc **Để sau** và người dùng không thể tiếp tục thao tác trên phiên bản cũ.
- Từ phiên bản **3.0.1**, ứng dụng tải bộ cài trong nền mà không mở trình duyệt, hiển thị phần trăm/dung lượng/tốc độ và xác minh SHA-256.
- Khi tải xong, bấm **Đóng bản cũ & mở bản mới** để ứng dụng cài đặt im lặng rồi tự khởi động phiên bản mới.

> Người đang sử dụng 2.0.5 trở xuống cần tải 2.0.6 thủ công một lần. Từ 2.0.6 trở đi, ứng dụng mới có khả năng tự thông báo các phiên bản tiếp theo.

> Các bản trước 3.0.1 chưa có bộ tải nền nên cần thực hiện luồng tải cũ một lần để chuyển tiếp. Từ 3.0.1 trở đi, toàn bộ quá trình tải và cài cập nhật diễn ra trong ứng dụng.

## Phiên bản 3.0.8

- Chuyển bộ phân phối hàng đợi sang FIFO: task vào trạng thái chờ trước luôn được xét chạy trước task mới hơn.
- Mỗi khi tài khoản rảnh, hệ thống tự nhận task cũ nhất tương thích; nhiều tài khoản rảnh nhận lần lượt các task đầu hàng.
- Ghi riêng thời điểm task vào hàng đợi để việc làm mới giao diện hoặc chỉnh sửa không đảo thứ tự; task chạy lại được đưa xuống cuối hàng.
- Giữ tương thích với task của phiên bản cũ bằng thời gian tạo và số thứ tự task, đồng thời không để ưu tiên quota làm task mới vượt task cũ.

## Phiên bản 3.0.7

- Chuyển nút **Kiểm tra phiên bản** thành điều khiển nhỏ gọn bên dưới thông tin phiên bản ở cuối sidebar để không đè lên các box hoặc thanh thao tác.
- Thêm meme robot cà phê xuất hiện ngẫu nhiên mỗi 10–20 phút trong khoảng trống sidebar, không khóa và không che nội dung đang làm việc.
- Cho phép bấm trực tiếp vào meme để mở mã QR cùng lời cảm ơn đóng góp; hỗ trợ đóng lời nhắc, tự hẹn lần sau và tạm ẩn trong 8 giờ.
- Dọn event handler và CSS của popup nổi cũ, đồng thời tự làm sạch thư mục build và staging sau khi đóng gói.

## Phiên bản 3.0.6

- Tích hợp GeminiWatermarkTool-Video để tự nhận diện logo, ước lượng cường độ bằng AlphaJudge ML, khôi phục bằng reverse alpha và làm sạch phần dư bằng AI denoise 120%; giữ chế độ ổn định và FFmpeg delogo làm các phương án dự phòng.
- Kiểm tra kích thước, thời lượng và tính hợp lệ của video trước khi thay tệp gốc; có cơ chế khôi phục nếu bước thay tệp gặp lỗi.
- Giữ nguyên âm thanh gốc bằng bước remux riêng và tự thử cả profile logo Gemini/Veo hiện tại lẫn profile Google Vids thế hệ trước.
- Cập nhật giao diện và hướng dẫn để hiển thị đúng chế độ xóa logo ML + AI mới.

## Phiên bản 3.0.5

- Đồng bộ giới hạn mới của Google Vids: khi chọn 15 giây, ứng dụng kéo thanh **Video duration** lên 15s và chỉ tạo một video duy nhất.
- Video 5–15 giây dùng một lần Create; chỉ video 16–20 giây mới chạy thêm bước Extend.
- Thêm nút **Kiểm tra phiên bản** ở góc dưới bên phải để người dùng chủ động kiểm tra cập nhật ngay.
- Hiển thị spinner và phản hồi rõ khi đang kiểm tra, đang dùng bản mới nhất, có bản mới hoặc không thể kết nối máy chủ.
- Tự điều chỉnh vị trí nút trong tab **Tạo video hàng loạt** để không che thanh thao tác phía dưới.
- Giữ nguyên kiểm tra tự động khi khởi động, khi focus, khi mạng kết nối lại và mỗi 5 phút.
- Loại bỏ timer kiểm tra trùng ở renderer; chỉ tiến trình chính duy trì một bộ hẹn giờ nền 5 phút.

## Phiên bản 3.0.4

- Sửa nút **Thêm ảnh** ở tab **Tạo video hàng loạt** để bấm được ở mọi vị trí trong nút, kể cả phần chữ bên trong.
- Nhập tối đa 3 ảnh song song, tạo thumbnail nhẹ 320 px và chỉ cập nhật ô ảnh vừa thao tác nên bảng không còn đứng đơ.
- Hiển thị trạng thái **Đang thêm ảnh…**, giới hạn 10 MB mỗi ảnh và tự dọn file nhập dở hoặc ảnh cũ đã được thay thế.
- Tuần tự hóa việc tự lưu chiến dịch để dữ liệu mới không bị một lượt lưu cũ ghi đè khi thao tác nhanh.
- Tăng tốc thao tác tài khoản hàng loạt bằng cách gom các lượt làm mới giao diện và cập nhật bật/tắt trong một lần ghi dữ liệu.
- Sửa nhận diện gói Google AI khi tên gói Pro hoặc Ultra hiển thị tách dòng trên Google One; việc kiểm tra gói không còn chờ các bước kiểm tra quota không liên quan.
- Dọn import và mã không sử dụng, đồng thời bổ sung kiểm thử cho luồng nhập và dọn ảnh chiến dịch.

## Phiên bản 3.0.3

- Tự động nhận diện và bỏ qua tài khoản trùng; không ghi đè thông tin đăng nhập hoặc mở lại Chrome cho tài khoản đã tồn tại.
- Chuẩn hóa Gmail theo chữ hoa/thường, dấu chấm, hậu tố `+tag` và miền `googlemail.com` để nhận diện đúng cùng một tài khoản.
- Kiểm tra gói Thường, Google AI Pro hoặc Google AI Ultra trực tiếp tại trang Google One Home của đúng profile đang đăng nhập.
- Không còn gán nhầm gói Thường khi trang Google timeout; chỉ cập nhật loại gói khi có bằng chứng rõ ràng.
- Thêm tiến trình kiểm tra cập nhật nền mỗi 5 phút, khi focus cửa sổ và khi mạng kết nối lại; không cần tải lại hoặc khởi động lại ứng dụng để thấy popup.
- Dọn các import, biến và mã không còn được sử dụng trước khi đóng gói.

## Phiên bản 3.0.2

- Cập nhật cột trạng thái của từng dòng chiến dịch theo hàng đợi trong thời gian thực.
- Hiển thị rõ `Bản nháp`, `Đang chờ`, `Đang tạo %`, `Hoàn thành`, `Lỗi` và `Đã hủy`.
- Thêm thanh tiến độ nhỏ cho từng video đang chờ hoặc đang chạy.
- Thanh nối bước 2 → bước 3 phản ánh tiến độ trung bình của các task thuộc chiến dịch.
- Bước **3. Kiểm tra & tạo** sáng khi đang xử lý, chuyển dấu `✓` khi hoàn tất toàn bộ hoặc hiển thị số task lỗi.
- Giữ trạng thái đồng nhất khi nhiều video chạy song song và tránh kết quả cũ ghi đè kết quả realtime mới.

## Phiên bản 3.0.1

- Tải installer trực tiếp trong ứng dụng, không mở Chrome hoặc trình duyệt mặc định.
- Hiển thị thanh tiến độ cùng phần trăm, dung lượng đã tải, tổng dung lượng và tốc độ tải.
- Kiểm tra dung lượng và SHA-256; tự hủy file không đầy đủ hoặc sai mã xác minh.
- Sau khi tải xong, popup chuyển thành **Đóng bản cũ & mở bản mới**.
- Chạy bộ cài NSIS ở chế độ im lặng, đóng phiên bản hiện tại và tự mở phiên bản mới.
- Giữ nguyên cơ chế cập nhật bắt buộc, không có nút đóng hoặc **Để sau**.

## Phiên bản 3.0.0

- Thêm tab **Tạo video hàng loạt** với danh sách dạng bảng, hỗ trợ cấu hình riêng cho từng video.
- Thêm cơ chế **chiến dịch**; mỗi chiến dịch có thư mục độc lập chứa cấu hình, ảnh tham chiếu và video đầu ra.
- Cho phép dán prompt có nhiều dòng vào đúng một ô prompt mà không tự tạo thêm task.
- Giữ người dùng tại tab hiện tại khi bắt đầu tạo video; nút tạo chuyển thành nút **Dừng** trong suốt quá trình chạy.
- Nút **Dừng** hủy toàn bộ task đang chờ hoặc đang chạy và giải phóng trạng thái bận của chiến dịch.
- Sửa popup tạo chiến dịch hiển thị lặp, đồng thời tinh chỉnh giao diện và thanh thao tác dưới theo thiết kế mới.
- Bắt buộc cập nhật mỗi khi có phiên bản mới và loại bỏ hoàn toàn tùy chọn **Để sau** khỏi popup cập nhật.

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

Ứng dụng đóng gói `GeminiWatermarkTool-Video`, một thành phần bên thứ ba được tài liệu phát hành xác định theo giấy phép MIT. Thông báo bản quyền, phiên bản và mã SHA-256 được lưu cùng thành phần trong thư mục `bin` của bộ cài.
