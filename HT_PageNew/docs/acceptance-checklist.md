# Checklist nghiệm thu HT PageNew trên máy thật

> Dùng bản `release/HT PageNew Setup 1.0.3.exe` hoặc bản portable. Không chạy `npm start`. Bộ lập lịch hoạt động khi tiến trình HT PageNew đang chạy; nếu thoát hẳn ứng dụng thì lịch không chạy bù.

## Chuẩn bị

- [ ] Cài/mở ứng dụng, kiểm tra Task Manager có tiến trình **HT PageNew** và không có `vite`/`node` phục vụ cổng 5173.
- [ ] Đặt múi giờ Windows là **(UTC+07:00) Bangkok, Hanoi, Jakarta** và giờ hệ thống chính xác.
- [ ] Dùng một tài khoản/Page thử nghiệm được phép sử dụng; không dùng hồ sơ mẫu có sẵn làm bằng chứng.

## 1. Thêm hồ sơ và kiểm tra proxy

1. Vào **Hồ sơ → Thêm Hồ Sơ Mới**, nhập tên nhận biết và proxy thật (`host:port:user:password` hoặc URL proxy), rồi lưu.
2. Bấm **Test Proxy**.

Đạt khi:

- [ ] Hồ sơ mới xuất hiện và vẫn còn sau khi đóng/mở lại ứng dụng.
- [ ] Proxy tốt hiện `Live`, IP/quốc gia/độ trễ hợp lý.
- [ ] Proxy sai hoặc tắt hiện `Dead/Lỗi`, không báo thành công giả.
- [ ] Nếu không dùng proxy, ứng dụng ghi rõ dùng IP máy; không coi đây là proxy đã kiểm tra.

## 2. Đăng nhập Facebook thủ công, chọn Page, đóng/mở lại

1. Bấm **FB**, tự đăng nhập trong cửa sổ trình duyệt được mở cho đúng hồ sơ. Không nhập mật khẩu vào giao diện HT PageNew.
2. Hoàn tất 2FA/CAPTCHA nếu Facebook yêu cầu, kiểm tra đã vào được Feed.
3. Quay lại ứng dụng, bấm **Đổi Page chọn**, chọn đúng Page.
4. Đóng cửa sổ trình duyệt và thoát HT PageNew; mở lại bản đóng gói, bấm **FB** ở đúng hồ sơ.

Đạt khi:

- [ ] Đúng tài khoản vẫn đăng nhập (Facebook có thể chủ động bắt đăng nhập lại; trường hợp đó ghi **không đạt/chưa ổn định**, không kết luận lưu phiên thành công).
- [ ] Page đã chọn vẫn còn sau khi mở lại.
- [ ] Hai hồ sơ khác nhau không dùng lẫn phiên đăng nhập.
- [ ] Cửa sổ được mở bằng Chromium tích hợp. Bản phát hành đã kiểm tra chứa Chromium 153.0.8010.12.

## 3. Chạy ngay phiên ngắn

1. Chọn thời lượng **1 phút (Test)** và bấm **Chạy ngay**.
2. Quan sát cửa sổ Facebook và đồng hồ độc lập trên điện thoại/Windows.

Đạt khi:

- [ ] Trạng thái chuyển **Đang chạy**; Feed được cuộn theo chế độ chỉ đọc.
- [ ] Với phiên 1 phút, việc chuyển sang Reels chưa được bảo đảm vì logic chỉ chuyển sau khoảng 2 phút. Muốn nghiệm thu cả Feed và Reels, chạy ít nhất **5 phút**.
- [ ] Phiên tự dừng sát thời lượng cấu hình (ghi sai lệch thực tế); trạng thái chuyển **Đã hoàn thành**.
- [ ] Không Like/Comment/Share/Follow/đăng bài.

## 4. Chạy phiên theo lịch

1. Trong **Lịch chạy**, đặt thời điểm cách hiện tại 2–3 phút, chọn đúng thứ hôm nay, thời lượng 1 phút, bật hồ sơ và bật lịch.
2. Giữ ứng dụng chạy; có thể chuyển tab hoặc thu nhỏ cửa sổ. Không thoát tiến trình.

Đạt khi:

- [ ] Đến phút đã hẹn, phiên tự bắt đầu đúng một lần.
- [ ] Không chạy trùng nếu hồ sơ đã có phiên đang chạy.
- [ ] Sau khi kết thúc, có nhật ký bắt đầu/kết thúc và lần chạy kế tiếp được tính trong tương lai.
- [ ] Thoát hẳn ứng dụng trước giờ hẹn thì phiên không chạy; mở lại sau giờ hẹn không chạy bù. Đây là hành vi hiện tại, không phải dịch vụ nền Windows.

## 5. Mất proxy và yêu cầu xác minh

### Proxy mất kết nối

1. Dùng proxy thử nghiệm rồi tắt proxy/chặn kết nối trước khi bấm **Chạy ngay**.
2. Nếu muốn thử mất kết nối giữa phiên, ngắt proxy khi phiên đang chạy và quan sát.

Đạt khi:

- [ ] Mất proxy trước phiên: ứng dụng từ chối chạy, trạng thái **Lỗi**, không thử đăng nhập liên tục.
- [ ] Mất proxy giữa phiên: ghi lại hành vi thực tế. Hiện ứng dụng chưa có kiểm tra proxy định kỳ giữa phiên, nên mục này **chưa được xác nhận đạt** cho đến khi thử thật.

### Facebook yêu cầu xác minh

1. Chỉ thực hiện khi Facebook tự hiển thị checkpoint/2FA/CAPTCHA; không cố tình gây khóa tài khoản.
2. Không hoàn tất xác minh trong luồng tự động; xử lý thủ công trong cửa sổ Facebook.

Đạt khi:

- [ ] Phiên dừng, trạng thái **Cần xác minh**, không tự nhập thông tin hoặc thử lại liên tục.
- [ ] Sau khi xác minh thủ công, bấm **Đã xác minh**; ứng dụng chỉ chạy lại khi phiên không còn ở trang checkpoint/login.

## 6. Nhật ký và Dừng ngay

1. Bắt đầu phiên 5 phút; sau 20–30 giây bấm **Dừng ngay**.
2. Mở tab **Nhật ký**.

Đạt khi:

- [ ] Cuộn dừng trong vài giây và trạng thái không còn **Đang chạy**.
- [ ] Log có hồ sơ, Page, giờ bắt đầu/kết thúc, thời lượng thực tế và lý do `Người dùng bấm Dừng ngay`.
- [ ] Log không chứa cookie, token, mật khẩu Facebook, mật khẩu proxy hay nội dung Feed/Reels.
- [ ] Bấm Dừng ngay lần hai khi không có phiên phải báo không tìm thấy phiên, không tạo kết quả thành công giả.

## Biên bản kết quả

Ghi cho từng mục: `Đạt / Không đạt / Chưa kiểm tra thực tế`, thời gian thử, tên hồ sơ thử, phiên bản `1.0.3`, sai lệch thời gian và ảnh chụp nếu có. Chỉ đánh dấu **Đạt** sau khi quan sát trên tài khoản/proxy thật.
