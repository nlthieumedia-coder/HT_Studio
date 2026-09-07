# HT Studio

HT Studio là monorepo tập hợp các công cụ hỗ trợ quy trình dựng phim, quản lý media và tự động hóa Adobe Premiere Pro trên Windows.

## Sản phẩm

| Dự án | Phiên bản | Nền tảng | Mô tả |
| --- | ---: | --- | --- |
| [HT_Automation](./HT_Automation/) | 3.0.8 | Premiere Pro UXP | Ghép media, đồng bộ hình/âm thanh, tạo subtitle offline, thêm nhạc nền và video overlay. |
| [HT_BinBuilder](./HT_BinBuilder/) | 1.4.0 | Premiere Pro UXP | Tạo, lưu preset và khôi phục cấu trúc Bin lồng nhau trong project. |
| [HT_Finder](./HT_Finder/) | 2.0.3 | Premiere Pro UXP | Tìm, tải và đưa B-roll từ Pexels, Pixabay, YouTube hoặc Wikimedia vào project. |
| [HT_Downloader](./HT_Downloader/) | 2.0.2 | Windows Desktop | Quét liên kết media và tải video bằng ứng dụng Electron. |

## Yêu cầu hệ thống

- Windows x64.
- Adobe Premiere Pro 26.2 trở lên đối với các panel UXP.
- Node.js LTS khi phát triển hoặc đóng gói dự án.
- PowerShell được dùng bởi các bộ cài và Bridge trên Windows.

Người dùng cuối của các panel UXP không cần cài Node.js, Git, Creative Cloud Desktop hay UXP Developer Tool.

## Cài đặt panel Premiere Pro

Mỗi panel có bộ cài riêng trong thư mục `dist`:

1. Tải và giải nén file `*_Setup_Windows.zip` của sản phẩm.
2. Đóng hoàn toàn Adobe Premiere Pro.
3. Chạy `cong_cu\cai_dat\CAI_DAT_MOT_CLICK.bat`.
4. Mở lại Premiere Pro.
5. Chọn **Window > UXP Plugins** và mở panel tương ứng.

Xem hướng dẫn chi tiết trong README của từng dự án trước khi cài đặt. `HT_Automation` và `HT_Finder` có thêm Bridge chạy nền để xử lý FFmpeg, Whisper hoặc `yt-dlp`.

## Phát triển

Clone repository:

```powershell
git clone https://github.com/nlthieumedia-coder/HT_Studio.git
cd HT_Studio
```

Đóng gói một panel UXP từ thư mục dự án tương ứng:

```powershell
powershell -ExecutionPolicy Bypass -File .\build_release.ps1
```

Phát triển HT Downloader:

```powershell
cd HT_Downloader
npm install
npm run start
```

Các lệnh kiểm tra và đóng gói HT Downloader:

```powershell
npm run typecheck
npm test
npm run build
npm run dist
```

## Cấu trúc repository

```text
HT_Studio/
├── HT_Automation/   # Panel tự động hóa Premiere Pro
├── HT_BinBuilder/   # Panel tạo cấu trúc Bin
├── HT_Downloader/   # Ứng dụng tải media Electron
├── HT_Finder/       # Panel tìm và nhập B-roll
└── Logo/             # Tài nguyên nhận diện chung
```

Các thư mục dependency, cache và kết quả build lớn như `node_modules` hoặc `dist` của HT Downloader không được lưu trong Git. Một số gói phát hành của các panel được quản lý bằng Git LFS.

## Repository

GitHub: [nlthieumedia-coder/HT_Studio](https://github.com/nlthieumedia-coder/HT_Studio)
