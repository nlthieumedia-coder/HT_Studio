# Python media worker

Worker chạy cục bộ, nhận một JSON request trên mỗi dòng stdin và chỉ ghi JSON response lên stdout. Log kỹ thuật được ghi vào stderr.

Thứ tự phát hiện Python 3.10+: `HT_PYTHON_BIN` → Windows `py -3` → `python` → `python3`. Nếu không tìm thấy, Electron trả mã `PYTHON_RUNTIME_MISSING`.

## Cài đặt Windows

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install --upgrade pip
.venv\Scripts\python -m pip install -r python-worker\requirements.txt
$env:HT_PYTHON_BIN = "$PWD\.venv\Scripts\python.exe"
```

Không có model nào được tải trong lúc cài dependency hoặc chạy test. Model chỉ được adapter local mở khi người dùng yêu cầu phiên âm/OCR/embedding. Dependency thiếu trả mã `DEPENDENCY_MISSING`, không tạo kết quả giả.

Các operation chính: `ping`, `transcribe`, `ocr`, `embedding`; các tên tương thích cũ như `transcribe_audio`, `run_ocr`, `create_image_embedding` vẫn được hỗ trợ.
