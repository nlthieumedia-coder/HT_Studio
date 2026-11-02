# Google Sheets bản quyền riêng cho HT Downloader

Hệ thống này hoàn toàn độc lập với `HT_VidsGG`:

- Tên sản phẩm: `HT_DOWNLOADER`
- Prefix key: `HTDOWN-`
- Prefix HWID: `HTD-`
- Salt, URL Web App và dữ liệu khách hàng riêng

## 1. Tạo Google Sheet mới

1. Mở <https://sheets.google.com> và tạo một **Bảng tính trống**.
2. Đặt tên file: `HT_Downloader_Keys`.
3. Đổi tên sheet đầu tiên thành `Licenses`.
4. Không dùng lại hoặc sao chép sheet `HT_Vids_Keys` của VidsGG.

## 2. Cài Apps Script riêng

1. Chọn **Tiện ích mở rộng → Apps Script**.
2. Xóa code mẫu.
3. Sao chép toàn bộ nội dung file [GoogleAppsScript.js](./GoogleAppsScript.js) vào trình soạn thảo.
4. Lưu dự án với tên `HT Downloader License Server`.
5. Quay lại Sheet, tải lại trang rồi chọn menu **HT Downloader License → Khởi tạo / chuẩn hóa bảng**.

Script sẽ tạo các cột:

| Cột | Nội dung |
|---|---|
| A | STT |
| B | Mã Key HT Downloader |
| C | Khách hàng |
| D | Trạng thái |
| E | HWID `HTD-XXXX-XXXX` |
| F | Ngày kích hoạt |
| G | Ghi chú |

## 3. Triển khai Web App

1. Trong Apps Script chọn **Triển khai → Tùy chọn triển khai mới**.
2. Loại: **Ứng dụng web**.
3. Mô tả: `HT Downloader License Cloud`.
4. Thực thi dưới dạng: **Tôi**.
5. Quyền truy cập: **Bất kỳ ai**.
6. Triển khai và sao chép URL dạng `https://script.google.com/macros/s/.../exec`.

## 4. Kết nối riêng với ứng dụng

Mở [resources/license-config.json](../resources/license-config.json) và điền URL mới:

```json
{
  "licenseServerUrl": "https://script.google.com/macros/s/DEPLOYMENT_ID_MOI/exec",
  "serverName": "HT Downloader Google Sheets License Cloud",
  "product": "HT_DOWNLOADER"
}
```

Sau đó chạy:

```powershell
npm.cmd run build
```

Có thể cấu hình tạm khi phát triển bằng biến môi trường riêng `HT_DOWNLOADER_LICENSE_API_URL`.

## 5. Cấp key cho khách

1. Khách sao chép HWID từ màn hình kích hoạt, ví dụ `HTD-1234-ABCD`.
2. Tạo dòng mới trong sheet, nhập tên khách ở cột C.
3. Dán HWID vào cột E.
4. Script tự sinh key `HTDOWN-...` ở cột B và đặt trạng thái `READY`.
5. Gửi key cho khách. Khi kích hoạt thành công, trạng thái chuyển thành `ACTIVE`.

Các trạng thái hỗ trợ: `UNUSED`, `READY`, `ACTIVE`, `BLOCKED`, `REVOKED`, `RESET`.

Key `HTVIDS-...` và HWID `HT-...` của VidsGG sẽ bị HT Downloader từ chối.
