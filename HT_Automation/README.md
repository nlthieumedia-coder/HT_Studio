# HT_Automation 3.0.5

## Sửa đứng 5% với đường dẫn tiếng Việt 3.0.5

- Bridge đọc request theo đúng số byte UTF-8, không còn chờ vô hạn khi đường dẫn chứa ký tự như `Kênh`.

## Sửa cập nhật bị chờ vô hạn 5.7.22

- Không mở hộp thoại ẩn trong tiến trình Administrator sau khi cài xong.
- Bỏ qua self-test Whisper nặng khi runtime hiện tại đã hoạt động tốt.

## Sửa dựng Video + Audio 5.7.21

- Cắt video dài bằng remux để không phải mã hóa lại hàng phút trước khi import.
- Chờ đúng file vừa import kể cả khi Bin đã chứa media từ lần dựng trước.
- Tạo đúng Timeline mới khi người dùng chọn chế độ tự động tạo Timeline.

## Tiến độ Auto Subtitle 5.7.20

- Hiển thị đúng giai đoạn Whisper thay vì đứng ở nhãn chuẩn hóa FFmpeg.
- Phần trăm tiến độ tăng theo clip hiện tại và tổng số clip.
- Ghi rõ chế độ từng clip chính xác sẽ chậm hơn chế độ nhận dạng một lượt.

## Hiển thị tiến độ cập nhật 5.7.19

- CMD hiển thị trạng thái từ log và heartbeat mỗi 5 giây khi PowerShell Administrator chạy ẩn.
- Không tải lại CUDA/CPU ở mỗi lần cập nhật nếu backend hiện tại vẫn khỏe mạnh.

## Trình cài đặt một cửa sổ 5.7.18

- Chỉ hiển thị cửa sổ CMD trạng thái; PowerShell Administrator chạy ẩn phía sau.
- Vẫn hiển thị UAC, kết quả cuối và đường dẫn nhật ký khi hoàn tất.

## Auto Subtitle chính xác 5.7.17

- Mặc định nhận dạng độc lập từng clip; chế độ batch nhanh trở thành tùy chọn.
- Chuẩn hóa động âm lượng giọng nói trước khi nhận dạng.
- Tăng ngưỡng giữ lại thoại nhỏ và dùng model Large V3 Turbo Q5 đa ngôn ngữ.

## Cải thiện độ chính xác Auto Subtitle 5.7.16

- Thêm khoảng lặng đệm ở đầu và cuối từng clip để Whisper không mất từ sát biên.
- Tách ranh giới các clip khi nhận dạng batch và ánh xạ câu theo phần giao thời gian lớn nhất.
- Tự nhận dạng lại riêng mọi clip bị lượt batch bỏ sót.
- Chia segment theo ranh giới từ và giảm khả năng bỏ qua câu thoại ngắn hoặc nhỏ tiếng.

## Tự phát hiện audio track 5.7.15

- Tự đọc toàn bộ audio track trên timeline và chỉ hiển thị những track đang có clip.
- Hỗ trợ A1, A2, A3, A4 và mọi track cao hơn mà timeline cung cấp.
- Hiển thị số clip trên từng track và có nút làm mới khi nội dung timeline thay đổi.

## Khắc phục giao diện bộ cài 5.7.11

- Đưa `styles.css` vào danh sách file bắt buộc của gói CCX.
- Đồng bộ nhãn phiên bản trên giao diện với manifest và FFmpeg Bridge.

## Chọn track Auto Subtitle 5.7.10

- Cho phép chọn và quét track A1, A2 hoặc A3 trước khi nhận dạng.
- Đồng bộ nút thao tác, thông báo, nhật ký và tên file SRT theo track nguồn.
- Tự xóa kết quả quét cũ khi đổi track để tránh tạo subtitle nhầm nguồn.

## Sửa cài đặt UXP 5.7.9

- Đăng ký `htAutomationPanel` bằng lifecycle `entrypoints.setup()` của UXP.
- Cài trực tiếp vào thư mục fallback hệ thống mà Premiere quét, không cần Creative Cloud, UPIA hay UXP Developer Tool.
- Bộ cài tự xin quyền Administrator và dọn các bản sideload AppData cũ trùng ID.

## Cấu trúc thư mục

```text
HT_Automation/
├── cong_cu/
│   ├── cai_dat/       # Cài đặt, cập nhật, sửa chữa và gỡ cài đặt
│   └── phat_trien/    # Tạo bộ cài và chạy bridge thủ công
├── installer/         # Logic PowerShell của bộ cài
├── bin/               # FFmpeg và bridge runtime
├── icons/             # Tài nguyên giao diện
└── dist/              # CCX và ZIP phát hành mới nhất
```

## Sắp xếp công cụ 5.7.8

- Gom cài đặt, cập nhật, sửa chữa và gỡ cài đặt vào `cong_cu\cai_dat`.
- Gom công cụ đóng gói và chạy bridge thủ công vào `cong_cu\phat_trien`.
- Bộ cài ZIP và toàn bộ hướng dẫn sử dụng cùng một cấu trúc thư mục.

## Cập nhật một click 5.7.7

- Bộ cài tạo `CAP_NHAT_HT_AUTOMATION.bat` cố định trên Desktop.
- Updater so sánh SemVer với GitHub Release mới nhất, tự tải và xác minh version trong ZIP.
- Tên file phát hành ổn định, build mới ghi đè bản cũ thay vì tạo nhiều tên version.
- Cài đặt/cập nhật qua thư mục tạm và tự dọn sau khi hoàn tất.
- Cần xuất bản GitHub Release công khai kèm asset `HT_Automation_Setup_Windows.zip`.

## Cache chuẩn hóa LUFS 5.7.6

- Tái sử dụng WAV đã chuẩn hóa khi file nguồn, ngày sửa, kích thước và LUFS không đổi.
- Gom thời lượng theo mốc 30 giây để timeline thay đổi nhẹ vẫn dùng được cache.
- Chỉ đánh dấu cache sau khi FFmpeg hoàn tất; tự xóa file dở khi xử lý lỗi.
- Timeout thích nghi theo thời lượng, phù hợp cả CPU cũ và máy dựng mạnh.
- Giữ PCM 16-bit/48 kHz để mã hóa nhẹ CPU và tương thích Premiere rộng nhất.

## Cài không cần Creative Cloud 5.7.5

- Bộ cài tự giải nén CCX vào thư mục UXP External theo người dùng.
- Cài đặt nguyên tử và tự phục hồi plugin cũ nếu cập nhật thất bại.
- Không mở Creative Cloud Desktop hoặc yêu cầu đăng nhập Adobe.
- Yêu cầu đóng Premiere trước khi cài và mở lại để nạp panel.

## Sửa cài đặt Whisper CPU 5.7.4

- Self-test dùng greedy decoder nhẹ hơn và cho phép CPU cũ chạy tối đa 5 phút.
- Không chặn cập nhật CCX/Bridge khi runtime và model hợp lệ nhưng âm sin kiểm tra không hoàn tất.
- Luôn ghi đúng backend CPU sau khi CUDA không tương thích.

## Thêm nhạc nền tức thời 5.7.3

- Mặc định import file nhạc gốc và thêm thẳng lên timeline, không chờ FFmpeg.
- Chuẩn hóa LUFS được chuyển thành tùy chọn chậm, mặc định tắt.
- Đọc duration trực tiếp từ ProjectItem sau khi import; chỉ gọi FFmpeg dự phòng khi Premiere không trả duration.
- Giới hạn mỗi lần chuẩn hóa tối đa 5 phút để không treo vô hạn.

## Tăng tốc thêm nhạc nền 5.7.2

- Chỉ chuẩn hóa lượng nhạc đủ phủ khoảng timeline được chọn.
- Cắt sớm bài cuối và bỏ qua các bài còn lại khi đã đủ thời lượng.
- Dùng PCM 16-bit/48 kHz để giảm 33% dữ liệu ghi đĩa và import so với PCM 24-bit.

## Sửa nhạc nền mất tiếng 5.7.1

- Tự bật lại audio track đích nếu track đang bị mute.
- Chuẩn hóa nhạc sang WAV PCM 24-bit/48 kHz để Premiere phát ổn định.
- Tạo file chuẩn hóa mới cho mỗi lần chạy, tránh Premiere dùng sai media/conform cache.
- Kiểm tra audio track đích tồn tại và báo lỗi rõ ràng trước khi thêm nhạc.

## Gỡ cài đặt một click 5.7.0

- Chạy `cong_cu\cai_dat\GO_CAI_DAT.bat` trong bộ cài đã giải nén.
- Gỡ plugin UXP, Bridge tự khởi động, Whisper/model và dữ liệu runtime HT_Automation.
- Kiểm tra Premiere đã đóng và xác thực đường dẫn trước khi xóa.

## Bản duy nhất cho Premiere 26.2+

- Ngừng và loại bỏ toàn bộ quy trình build Legacy.
- Không khởi tạo trình chỉnh sửa subtitle, preset, draft và listener cũ đã bị gỡ khỏi giao diện.
- Chỉ phân phối một CCX và một bộ cài Windows cho Premiere Pro 26.2 trở lên.

## Chuẩn hóa A1 theo nhóm 5.5.0

- Gom tối đa 20 clip vào mỗi tiến trình FFmpeg.
- Timeline 107 clip chỉ cần khoảng 6 nhóm và một lần ghép thay vì hơn 100 lần khởi động FFmpeg.
- Tự quay về chế độ từng clip nếu codec của một nhóm không tương thích.

## Chống treo chuẩn hóa audio 5.4.3

- FFmpeg không chờ stdin và cập nhật thời gian xử lý mỗi giây.
- Mỗi clip có watchdog 60 giây; clip nguồn lỗi được bỏ qua thay vì khóa toàn bộ tác vụ.
- Bridge hỗ trợ timeout và kết thúc tiến trình bị treo.

## Tương thích máy mới 5.4.2

- Tên ngôn ngữ hiển thị song song bằng tiếng Anh và tiếng Việt.
- Installer kiểm tra runtime CUDA sau khi tải và tự chuyển sang CPU nếu GPU/driver không tương thích.
- Tab Subtitle kiểm tra Whisper trước khi chạy và hiển thị lỗi cấu hình cụ thể.

## Căn ảnh và âm thanh 5.4.1

- Chuẩn hóa duration mỗi cặp theo số frame nguyên của sequence.
- Đặt cùng Out Point cho ảnh và audio, tránh Premiere làm tròn hai track khác nhau.

## Whisper GPU 5.4.0

- Tự phát hiện NVIDIA và cài runtime whisper.cpp cuBLAS CUDA 12.4 chính thức.
- Bật Flash Attention khi nhận dạng bằng GPU.
- Hiển thị rõ backend CUDA hoặc CPU trong trạng thái và tiến độ.
- Máy không có NVIDIA tiếp tục tự dùng bản CPU.

## Tự dọn file tạm 5.3.3

- Tự xóa `ht_sub_*.wav`, JSON và file concat sau khi tạo subtitle hoặc khi tác vụ lỗi.
- Lần chạy tiếp theo tự dọn file tạm còn sót từ các phiên bản trước.
- Chỉ xóa đúng file tạm nội bộ; SRT và các file khác được giữ nguyên.

## Giới hạn dòng subtitle 5.3.2

- Chọn tối đa 1 hoặc 2 dòng cho mỗi caption.
- Câu dài được tách thành nhiều caption liên tiếp và tự phân bổ timecode, tránh Premiere bẻ thành 3–4 dòng.

## Tăng tốc Whisper 5.3.1

- Bridge Windows đọc đúng số bộ xử lý logic của máy thay vì phụ thuộc giới hạn CPU do UXP báo cáo.
- Whisper tự dùng khoảng 75% số luồng CPU, tối đa 16 luồng, để Premiere vẫn còn tài nguyên phản hồi.

## Auto Subtitle tối giản 5.3.0

- Quy trình chỉ còn Quét A1 và Tạo subtitle.
- Tự dùng chế độ nhận dạng nhanh và tự chọn số luồng CPU.
- Tạo SRT ngay khi nhận dạng xong và tùy chọn import vào Project.
- Bỏ trình chỉnh sửa, bản nháp, cache, song ngữ và preset hiển thị khỏi tab Subtitle.

## Tối ưu giao diện 5.2.4

- Chỉ giữ một vùng cuộn chính, loại bỏ hiện tượng cuộn lồng nhau.
- Bỏ xử lý con lăn thủ công trong Nhật ký để tránh cộng delta cuộn hai lần.
- Giảm repaint do transition, shadow và focus trong Premiere UXP.
- Giới hạn Nhật ký ở 300 dòng và không ép tính layout khi đang thu gọn.

## Sửa lỗi 5.2.3

- Hiển thị tiến độ ước tính và thời gian chạy trong lúc Whisper xử lý WAV ghép, thay vì đứng cố định ở 48%.

## Sửa lỗi 5.2.2

- Gắn sự kiện Tạo subtitle ngay khi panel khởi tạo, độc lập với trình chỉnh sửa và các bộ xuất tùy chọn.

## Sửa lỗi 5.2.1

- Nút Tạo subtitle dùng button chuẩn, không còn mất thao tác do trạng thái `disabled` tồn dư trong UXP.
- Khi tác vụ đang chạy, bấm lại nút sẽ hiển thị trạng thái thay vì không phản hồi.

## Mới trong 5.2.0

- Chế độ nhận dạng nhanh ghép các clip A1 và chỉ nạp model Whisper một lần.
- Tự động quay về chế độ tương thích nếu không thể ghép một loại media đặc biệt.
- Tự chọn số luồng CPU hoặc cho phép cấu hình thủ công.
- Cache kết quả theo nguồn A1, timecode, ngôn ngữ và model để tránh nhận dạng lại.

## Mới trong 5.1.0

- Bốn preset trình bày subtitle: YouTube, TikTok/Reels, Song ngữ và Tối giản.
- Tùy chỉnh font, cỡ chữ, màu chữ, màu/độ dày viền và vị trí hiển thị.
- Xuất Advanced SubStation Alpha (`.ass`) có lưu đầy đủ style; file JSON cũng kèm metadata style.
- Cấu hình style được ghi nhớ giữa các lần mở panel.

Panel UXP cho Adobe Premiere Pro, tự động ghép media theo số trong tên file và
xếp tuần tự lên timeline.

## Chức năng

- Ảnh + âm thanh: đặt ảnh lên V1, âm thanh lên A1 và khớp thời lượng.
- Video + âm thanh: dùng FFmpeg tạo video khớp audio, bỏ audio gốc, rồi đặt lên
  V1/A1.
- Ghép cặp theo số đầu tên, số cuối tên hoặc nhóm chữ số đầu tiên trong tên.
- Video đầu ra nằm trong `_ffmpeg_synced`, dùng H.264, preset `veryfast`, CRF 18.
- Hậu kỳ tự động: chuẩn hóa nhiều bài nhạc nền trong khoảng -26 đến -24 LUFS,
  nối hoặc lặp playlist trên track âm thanh do người dùng chọn.
- Chèn nhiều video overlay tại thời điểm, thời lượng và video track tùy chỉnh bằng
  Overwrite edit để không làm xê dịch timeline hiện có.
- Mỗi overlay hỗ trợ nhiều mốc thời gian, 9 vị trí preset trên màn hình và tỷ lệ
  hiển thị tùy chỉnh.
- Mốc overlay được nhập bằng số frame hoặc tự động lặp theo khoảng frame đến cuối
  timeline; plugin tự quy đổi theo frame rate của sequence.
- Auto Subtitle đọc riêng từng audio clip đang bật trên track A1, A2 hoặc A3 do người dùng chọn, nhận diện đa ngôn ngữ
  bằng `whisper.cpp`, giữ đúng khoảng trống/timecode và tạo SRT UTF-8.

## Auto Subtitle từ A1, A2 hoặc A3

Tính năng chạy offline. Bộ cài một-click tự tải từ nguồn chính thức và đặt vào
`%LOCALAPPDATA%\HT_Automation\Whisper`:

- Bản Windows x64 của `whisper.cpp`, gồm `whisper-cli.exe` và các DLL đi kèm.
- Model multilingual `ggml-large-v3-turbo-q5_0.bin` (~547 MiB), ưu tiên độ chính xác nhưng vẫn gọn hơn bản Large đầy đủ.

Panel tự lấy hai đường dẫn trên từ Bridge; nút chọn file vẫn có thể dùng để thay model.
Chọn timeline hiện có, track nguồn A1/A2/A3, thư mục đầu ra và ngôn ngữ, quét track rồi
bấm **Tạo subtitle**. Plugin tách đúng đoạn In/Out của từng clip trên track đã chọn thành WAV 16 kHz,
nhận dạng từng clip và quy đổi kết quả về timecode sequence. File SRT được đưa vào bin
`Auto Subtitles`; kéo SRT từ bin xuống timeline để Premiere tạo caption track.

## Giao diện 4.5

- Design tokens thống nhất cho màu sắc, khoảng cách, bo góc và kích thước control.
- Bộ SVG icon nội bộ thay cho emoji, hiển thị nhất quán trên các máy Windows.
- Chuẩn hóa trạng thái hover, focus, pressed, disabled, badge, alert và progress.
- Giao diện tối trung tính, tương thích thị giác với Adobe Premiere Pro.
- Điều hướng UXP dùng Flexbox và nhãn ngắn; badge kỹ thuật được rút gọn.

## Cấu trúc giao diện 4.6

- Trang Tổng quan với bốn lối tắt và trạng thái Premiere/FFmpeg/Whisper.
- Điều hướng chính: Tổng quan, Dựng media, Auto Sub, Hậu kỳ và Cài đặt.
- Dựng media có ba chế độ: Ảnh + Audio, Video + Audio và Chỉ âm thanh.
- Chế độ Chỉ âm thanh quét file theo số 1 → N, đưa vào A1 nối tiếp hoặc cách nhau theo số frame tùy chọn.
- Nhạc nền và Overlay được gom thành hai chế độ của Hậu kỳ.
- Cấu hình FFmpeg, Whisper CLI và model được chuyển sang Cài đặt.
- Timeline dùng chung được rút thành một thanh compact; nhật ký thu gọn mặc định.
- Các field FFmpeg/Whisper được căn cùng lề và toàn bộ box dùng hệ bo góc thống nhất.

## Workflow 4.7

- Auto Subtitle gồm ba bước: chọn và quét A1/A2/A3, thiết lập và tạo/import SRT.
- Kết quả quét hiển thị số clip hợp lệ, tổng thời lượng và số clip bị bỏ qua.
- Validation được hiển thị ngay trong màn hình trước khi chạy Whisper.
- Thanh tiến trình dùng chung cho dựng ảnh/video, subtitle, nhạc nền và overlay.
- Kết quả thành công/cảnh báo/lỗi được tóm tắt; lỗi tự mở nhật ký chi tiết.
- Ghi nhớ ngôn ngữ, độ dài dòng, import SRT, LUFS, track nhạc và thư mục SRT.

## Cài trên máy khác

Yêu cầu: Windows x64 và Premiere Pro 26.2 trở lên. Không cần Creative Cloud Desktop.

1. Tải `dist/HT_Automation_Setup_Windows.zip`.
2. Giải nén toàn bộ ZIP.
3. Nhấp đúp `cong_cu\cai_dat\CAI_DAT_MOT_CLICK.bat`.
4. Chờ bộ cài chép plugin UXP, Bridge và Whisper rồi mở lại Premiere Pro.
5. Mở **Window > UXP Plugins > HT_Automation**.

Trình cài chép FFmpeg Bridge vào `%LOCALAPPDATA%\HT_Automation\Bridge`, chạy ẩn
và đăng ký tự khởi động theo tài khoản Windows. Máy đích không cần Git, Node.js,
UXP Developer Tool hoặc cài FFmpeg riêng.

## Phát triển và đóng gói

`bin/ffmpeg.exe` không được commit. Nếu thiếu, chạy `download_ffmpeg.ps1`.
Máy build cần Node.js LTS, sau đó chạy `cong_cu\phat_trien\TAO_BO_CAI.bat` hoặc:

```powershell
powershell -ExecutionPolicy Bypass -File .\build_release.ps1
```

Kết quả:

- `dist/HT_Automation_PremierePro.ccx`
- `dist/HT_Automation_Setup_Windows.zip`

## Thành phần runtime

- `manifest.json`, `index.html`, `index.js`: panel UXP.
- `bin/ffmpeg.exe`: xử lý video.
- `bin/ffmpeg_bridge_server.ps1`: cầu nối localhost tại cổng 19888.
- `installer/install.ps1`: cài và tự khởi động bridge.

## Giới hạn

- Chỉ hỗ trợ Windows x64.
- Video dài hơn audio bị cắt phần đuôi; video ngắn hơn audio được giảm tốc.
- Video được encode lại nên thời gian xử lý phụ thuộc cấu hình máy.
