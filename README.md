# HT Studio

![HT Studio](./Logo/logo.png)

HT Studio là monorepo tập hợp các công cụ Windows phục vụ dựng phim, quản lý media, tự động hóa Adobe Premiere Pro, tìm kiếm video cục bộ và vận hành các quy trình nội dung qua trình duyệt.

> Mỗi sản phẩm là một dự án độc lập. Hãy mở README trong thư mục tương ứng trước khi cài đặt hoặc phát triển.

## Danh sách sản phẩm

| Dự án | Phiên bản | Nền tảng | Chức năng chính |
| --- | ---: | --- | --- |
| [HT_Automation](./HT_Automation/) | 3.0.8 | Premiere Pro UXP | Ghép media, đồng bộ video/audio, tạo subtitle offline, thêm nhạc nền và video overlay. |
| [HT_BinBuilder](./HT_BinBuilder/) | 1.4.0 | Premiere Pro UXP | Tạo, lưu preset và khôi phục cấu trúc Bin lồng nhau trong project Premiere. |
| [HT_Finder](./HT_Finder/) | 2.0.3 | Premiere Pro UXP | Tìm, tải và nhập B-roll từ Pexels, Pixabay, YouTube hoặc Wikimedia. |
| [HT_Downloader](./HT_Downloader/) | 2.0.3 | Electron/Windows | Quét URL, nhận diện nguồn media và tải video về máy. |
| [HT_Craw_Video](./HT_Craw_Video/) | 2.0.0 | Electron/Windows | Tìm video trùng, gần trùng, cùng chủ đề hoặc cùng định dạng trong dữ liệu cục bộ. |
| [HT_PageNew](./HT_PageNew/) | 2.0.2 | Electron/Windows | Quản lý hồ sơ Chromium, Fanpage, Feed/Reels, lịch chạy và thông báo Telegram. |
| [HT_Seedance](./HT_Seedance/) | 1.0.0 | Tauri/Windows | Quản lý quy trình tạo video qua phiên trình duyệt được người dùng cấp quyền. |

## Nhóm công cụ Premiere Pro

### HT Automation

Panel tự động hóa quy trình dựng, hỗ trợ ghép nhiều cặp media, căn thời lượng video theo audio, tạo subtitle bằng Whisper cục bộ, thêm nhạc/overlay và theo dõi tiến trình trực tiếp.

- Tài liệu: [HT_Automation/README.md](./HT_Automation/README.md)
- Yêu cầu: Windows x64, Adobe Premiere Pro 26.2 trở lên.
- Bộ cài: `HT_Automation/dist/HT_Automation_Setup_Windows.zip`.

### HT BinBuilder

Panel tạo cấu trúc Bin cha/con từ danh sách đường dẫn, đọc cấu trúc project hiện tại, tránh tạo trùng và lưu preset cá nhân.

- Tài liệu: [HT_BinBuilder/README.md](./HT_BinBuilder/README.md)
- Yêu cầu: Windows x64, Adobe Premiere Pro 26.2 trở lên.
- Bộ cài: `HT_BinBuilder/dist/HT_BinBuilder_Setup_Windows.zip`.

### HT Finder

Panel tìm B-roll, chọn chất lượng, tải media vào thư mục dự án và tự đưa vào Bin Premiere. Pexels/Pixabay cần API key; YouTube và Wikimedia sử dụng Bridge cục bộ.

- Tài liệu: [HT_Finder/README.md](./HT_Finder/README.md)
- Yêu cầu: Windows x64, Adobe Premiere Pro 26.2 trở lên.
- Bộ cài: `HT_Finder/dist/HT_Finder_Setup_Windows.zip`.

### Cài panel UXP trên máy người dùng

1. Tải và giải nén gói `*_Setup_Windows.zip` của sản phẩm.
2. Đóng hoàn toàn Adobe Premiere Pro.
3. Chạy `cong_cu\cai_dat\CAI_DAT_MOT_CLICK.bat`.
4. Mở Premiere Pro.
5. Chọn **Window → UXP Plugins** và mở panel tương ứng.

Người dùng cuối không cần cài Node.js, Git, Creative Cloud Desktop hoặc UXP Developer Tool. HT Automation và HT Finder có Bridge riêng cho các tác vụ FFmpeg, Whisper hoặc `yt-dlp`.

## Ứng dụng Windows Desktop

### HT Downloader

Ứng dụng tải media an toàn bằng Electron. Hệ thống chuẩn hóa URL, phân tích metadata, kiểm tra nguồn, chọn chất lượng và quản lý tiến trình tải.

```powershell
cd HT_Downloader
npm install
npm run start
```

Kiểm tra và đóng gói:

```powershell
npm run typecheck
npm test
npm run build
npm run dist
```

### HT Craw Video

Ứng dụng phân tích video hoàn toàn cục bộ. Hỗ trợ dấu vân tay hình/âm thanh, OCR, transcript, vector embedding, tìm kiếm tương đồng và xuất CSV/XLSX. Ứng dụng không tìm toàn bộ Internet nếu người dùng không cung cấp dataset hoặc API hợp lệ.

- Hướng dẫn: [HT_Craw_Video/README.md](./HT_Craw_Video/README.md)
- Kiến trúc: [HT_Craw_Video/docs/ARCHITECTURE.md](./HT_Craw_Video/docs/ARCHITECTURE.md)
- Triển khai Windows: [HT_Craw_Video/docs/DEPLOYMENT_WINDOWS.md](./HT_Craw_Video/docs/DEPLOYMENT_WINDOWS.md)

```powershell
cd HT_Craw_Video
npm install
npm test
npm run typecheck
npm run dev
```

Yêu cầu bổ sung: Python 3.10+ và FFmpeg. Các mô hình AI tùy chọn được tải và lưu cục bộ.

### HT PageNew

Ứng dụng quản lý nhiều hồ sơ Chromium độc lập, proxy, Trang cá nhân/Fanpage, phiên Feed/Reels, lịch đa khung giờ và điều khiển qua Telegram.

- Hướng dẫn đầy đủ: [HT_PageNew/README.md](./HT_PageNew/README.md)
- Checklist nghiệm thu: [HT_PageNew/docs/acceptance-checklist.md](./HT_PageNew/docs/acceptance-checklist.md)

```powershell
cd HT_PageNew
npm install
npm run dev:app
```

Đóng gói Windows:

```powershell
npm run dist
```

Ứng dụng không lưu mật khẩu Facebook và không tự giải hoặc bỏ qua CAPTCHA/2FA. Người dùng phải đăng nhập, xác minh thủ công và sử dụng tài khoản đúng quyền hạn.

### HT Seedance / HT Dola Studio

Ứng dụng Tauri + React với backend Fastify, SQLite và Playwright để quản lý project, tài khoản, hàng đợi và phiên tạo video thông qua phiên trình duyệt được người dùng cấp quyền.

- Tài liệu: [HT_Seedance/README.md](./HT_Seedance/README.md)
- Yêu cầu phát triển: Node.js 20+, pnpm 9 và Rust/Tauri khi build desktop.

```powershell
cd HT_Seedance
corepack enable
pnpm install
pnpm typecheck
pnpm test
pnpm dev
```

Build ứng dụng Windows:

```powershell
pnpm prepare:windows-sidecar
pnpm build:windows
```

## Bắt đầu phát triển

Clone repository:

```powershell
git clone https://github.com/nlthieumedia-coder/HT_Studio.git
cd HT_Studio
```

Khuyến nghị:

- Dùng Windows 10/11 x64.
- Dùng Node.js 20 LTS trở lên.
- Chạy lệnh trong đúng thư mục dự án vì mỗi sản phẩm có dependency và quy trình build riêng.
- Không commit `.env`, token, cookie, hồ sơ trình duyệt, database người dùng, cache hoặc thư mục `node_modules`.
- Chạy test/typecheck của dự án trước khi commit.

## Cấu trúc repository

```text
HT_Studio/
├── HT_Automation/   # Panel tự động hóa Premiere Pro
├── HT_BinBuilder/   # Panel tạo cấu trúc Bin
├── HT_Finder/       # Panel tìm và nhập B-roll
├── HT_Downloader/   # Ứng dụng tải media
├── HT_Craw_Video/   # Tìm kiếm tương đồng video cục bộ
├── HT_PageNew/      # Quản lý hồ sơ Facebook và lịch chạy
├── HT_Seedance/     # Quản lý quy trình tạo video
└── Logo/            # Tài nguyên nhận diện chung
```

## Dữ liệu, bảo mật và giới hạn

- Dữ liệu đăng nhập và hồ sơ trình duyệt phải được giữ trên máy người dùng.
- Không đưa token, API key, cookie, mật khẩu, proxy thật hoặc database cá nhân lên Git.
- Không sử dụng các công cụ để vượt CAPTCHA, DRM hoặc cơ chế bảo mật của nền tảng.
- Chỉ tự động hóa tài khoản, Page, media và nguồn dữ liệu mà người dùng có quyền truy cập.
- Các thư mục build/cache lớn không được theo dõi; một số bộ cài hợp lệ được quản lý bằng Git LFS.

## Kiểm tra chất lượng

Các dự án desktop cung cấp script riêng, thông thường gồm:

```powershell
npm run typecheck
npm test
npm run build
```

Với HT Seedance, dùng `pnpm typecheck`, `pnpm test` và `pnpm build`. Với panel UXP, chạy `build_release.ps1` trong thư mục sản phẩm và kiểm tra bộ cài trên Premiere Pro thật.

## Repository

- GitHub: [nlthieumedia-coder/HT_Studio](https://github.com/nlthieumedia-coder/HT_Studio)
- Nhánh phát triển chính: `main`
- Tệp nhị phân lớn: Git LFS

## Lưu ý

Mã nguồn được cung cấp để phát triển và vận hành nội bộ. Trước khi phát hành cho người dùng cuối, cần hoàn thành checklist kiểm thử thực tế của từng sản phẩm và tuân thủ điều khoản của Adobe, Facebook cùng các dịch vụ bên thứ ba liên quan.
