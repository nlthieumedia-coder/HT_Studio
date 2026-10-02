HT PAGENEW - HƯỚNG DẪN SỬ DỤNG
================================

1. GIỚI THIỆU
--------------
HT PageNew là ứng dụng hỗ trợ quản lý nhiều hồ sơ Chromium, Fanpage Facebook,
lịch chạy và theo dõi phiên xem Feed/Reels.

Ứng dụng chỉ thực hiện thao tác xem và cuộn nội dung. Người dùng tự đăng nhập
Facebook và tự xử lý CAPTCHA, mã xác minh hoặc yêu cầu bảo mật của Facebook.


2. CHỨC NĂNG CHÍNH
------------------
- Tạo nhiều hồ sơ trình duyệt độc lập.
- Mỗi hồ sơ có thể sử dụng một proxy riêng.
- Lưu nhiều Fanpage theo tên và đường dẫn Facebook.
- Chạy bằng Trang cá nhân hoặc Fanpage do người dùng chọn.
- Tự động xem Feed và Reels trong thời gian đã cấu hình.
- Tự chuyển Reel khi video gần phát hết.
- Tạo lịch IN/OUT riêng cho từng Fanpage.
- Theo dõi trạng thái: Đang chờ, Đang chạy, Hoàn thành, Cần xác minh và Lỗi.
- Tự đóng Chromium khi phiên kết thúc bình thường.
- Gửi thông báo và điều khiển phiên qua Telegram.


3. THÊM HỒ SƠ VÀ ĐĂNG NHẬP
--------------------------
1. Mở tab "Hồ sơ tài khoản".
2. Chọn "Thêm Hồ Sơ Mới".
3. Nhập tên hồ sơ và proxy nếu có.
4. Kiểm tra proxy, sau đó lưu hồ sơ.
5. Bấm nút "FB" để mở Chromium của hồ sơ.
6. Đăng nhập Facebook thủ công và hoàn thành xác minh nếu Facebook yêu cầu.
7. Không đóng ứng dụng trong khi đang có phiên chạy.

Mỗi hồ sơ sử dụng một thư mục dữ liệu Chromium riêng. Không dùng cùng một hồ
sơ Chromium trong nhiều tiến trình cùng lúc.


4. CẤU HÌNH FANPAGE
-------------------
1. Trong tab "Hồ sơ tài khoản", bấm "Cấu hình Page" tại hồ sơ cần dùng.
2. Nhập tên Fanpage và đường dẫn Facebook chính xác.
3. Lưu cấu hình.

Nếu hồ sơ không có Fanpage hợp lệ, hệ thống luôn chạy bằng Trang cá nhân.
Tên Page và link Page chỉ được cấu hình tại tab Hồ sơ; thời gian chạy được cấu
hình riêng tại tab Lịch chạy.


5. CHẠY NGAY
------------
1. Chọn Trang cá nhân hoặc một Fanpage trong danh sách của hồ sơ.
2. Chọn thời lượng.
3. Bấm "Chạy ngay".
4. Theo dõi cột "Trạng thái thực thi".

Khi chạy Fanpage, hệ thống sẽ mở menu tài khoản Facebook, chọn danh sách đầy
đủ các hồ sơ/Page, chọn đúng Page và xác minh danh tính trước khi lướt.
Nếu không xác minh được đúng Page, phiên sẽ dừng thay vì chạy nhầm tài khoản.

Bấm "Dừng ngay" để kết thúc phiên trước thời hạn.


6. CẤU HÌNH LỊCH CHẠY
---------------------
1. Mở tab "Lịch chạy".
2. Chọn hồ sơ cần cấu hình.
3. Chọn Fanpage.
4. Đặt giờ IN và OUT.
5. Xác nhận và lưu lịch.

Các lịch trong cùng một hồ sơ không nên trùng thời gian vì một hồ sơ chỉ có
thể chạy một danh tính Facebook tại một thời điểm.

Bộ lập lịch hoạt động khi ứng dụng đang mở. Không cần mở môi trường phát triển,
nhưng không được thoát hoàn toàn ứng dụng nếu muốn lịch tiếp tục chạy.


7. TRẠNG THÁI VÀ NHẬT KÝ
------------------------
- Đang chờ: Hồ sơ sẵn sàng nhưng chưa chạy.
- Đang chạy: Chromium đang thực hiện phiên Feed/Reels.
- Đã hoàn thành: Phiên đã chạy đủ thời lượng.
- Cần xác minh: Facebook yêu cầu đăng nhập, CAPTCHA hoặc mã xác minh.
- Lỗi: Proxy, trình duyệt, danh tính Page hoặc kết nối gặp sự cố.

Trong lúc chạy, giao diện hiển thị Feed/Reels và thời gian còn lại. Tab
"Nhật ký hoạt động" lưu thời gian bắt đầu, kết thúc và nguyên nhân dừng.
Ứng dụng không ghi mật khẩu Facebook, cookie hoặc token vào nhật ký.


8. TELEGRAM
-----------
Sau khi cấu hình Bot Token và Chat ID trong tab "Telegram & Thông báo", gửi:

    /menu

Bot sẽ hiển thị các nút:
- Chạy Fanpage
- Thêm lịch
- Thêm Fanpage
- Dừng phiên
- Danh sách Page
- Đang chạy

Khi chạy Page, người dùng chỉ cần chọn hồ sơ, tick Page, chọn thời lượng và
xác nhận. Khi tạo lịch, chọn Page, giờ IN, phút và thời lượng để tính giờ OUT.

Với một Fanpage hoàn toàn mới, cần nhập một lần theo định dạng:

    Tên Fanpage | Link Facebook

Bot chỉ phản hồi đúng Chat ID đã lưu trong ứng dụng.


9. XỬ LÝ SỰ CỐ
--------------
Proxy yêu cầu tên đăng nhập và mật khẩu:
- Kiểm tra proxy đã nhập đủ IP, cổng, tài khoản và mật khẩu.
- Dùng nút "Test Proxy" trước khi chạy.

Facebook yêu cầu CAPTCHA hoặc xác minh:
- Thực hiện thủ công trong đúng cửa sổ Chromium của hồ sơ.
- Chờ trang chủ Facebook tải xong rồi kiểm tra đăng nhập lại.
- Ứng dụng không tự giải hoặc bỏ qua CAPTCHA.

Chọn sai hoặc không tìm thấy Fanpage:
- Kiểm tra tên và link Page đã lưu.
- Đảm bảo tài khoản Facebook có quyền truy cập Page.
- Mở Facebook thủ công và kiểm tra Page xuất hiện trong "See all profiles".

Reels không phát:
- Kiểm tra kết nối proxy.
- Thử phát một Reel thủ công để xác nhận Facebook tải được video.
- Xem Nhật ký hoạt động để biết phiên có bị dừng do proxy hoặc xác minh không.


10. LƯU Ý AN TOÀN
-----------------
- Không chia sẻ Bot Token, Chat ID, proxy hoặc dữ liệu đăng nhập.
- Không sao chép thư mục hồ sơ Chromium cho người khác.
- Không mở đồng thời cùng một hồ sơ bằng hai cửa sổ Chromium khác nhau.
- Nên sử dụng thời lượng và lịch hợp lý.
- Tuân thủ điều khoản sử dụng và yêu cầu bảo mật của Facebook.


11. CẤU TRÚC DỰ ÁN
------------------
- assets/branding: logo, icon Windows và tài liệu nhận diện.
- docs: tài liệu nghiệm thu.
- extensions/atp-cookie: extension Chromium được đóng gói cùng ứng dụng.
- public: tài nguyên web công khai như favicon.
- scripts: công cụ chạy phát triển và dọn build.
- src: giao diện và dịch vụ phía renderer.
- tests/technical: các bài kiểm thử kỹ thuật.
- dist: giao diện production được tạo tự động.
- release: bộ cài và bản portable được tạo tự động.


12. QUY ƯỚC PHIÊN BẢN
----------------------
- Các bản cập nhật tăng lần lượt: 1.0.1, 1.0.2, ... đến 1.0.9.
- Sau 1.0.9, phiên bản tiếp theo là 2.0.1; sau 2.0.9 là 3.0.1 và tiếp tục tương tự.
