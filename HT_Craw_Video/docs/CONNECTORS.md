# Connectors

`LocalDatasetConnector` đọc folder đệ quy và CSV/JSON. `UserProvidedUrlConnector` chuẩn hóa HTTP(S), chỉ kiểm tra URL người dùng cung cấp, không login/bypass/crawl nền tảng. Facebook và Instagram trả `NOT_CONNECTED`; chúng không tạo dữ liệu giả và chỉ có thể bật với credentials/quyền API hợp lệ trong một triển khai sau.
