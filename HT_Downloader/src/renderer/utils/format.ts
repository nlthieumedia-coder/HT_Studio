export function formatDuration(seconds?: number): string { if (!seconds) return 'Không rõ thời lượng'; const total = Math.round(seconds); return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`; }
export function formatBytes(bytes?: number): string { if (!bytes) return 'Chưa rõ dung lượng'; const units = ['B', 'KB', 'MB', 'GB']; let value = bytes; let index = 0; while (value >= 1024 && index < units.length - 1) { value /= 1024; index++; } return `${value.toFixed(index > 1 ? 1 : 0)} ${units[index]}`; }
export function friendlyError(code: string, fallback: string): string {
  const messages: Record<string, string> = {
    INVALID_URL: 'Vui lòng nhập một liên kết HTTP hoặc HTTPS hợp lệ.', PAGE_INACCESSIBLE: 'Không thể truy cập trang này.', NO_VIDEO: 'Không phát hiện video có thể tải trong liên kết.', YTDLP_UNSUPPORTED: 'Trang web này chưa được hỗ trợ.', NETWORK_ERROR: 'Kết nối mạng bị gián đoạn. Vui lòng thử lại.', LOGIN_REQUIRED: 'Video này yêu cầu đăng nhập để truy cập.', DRM_PROTECTED: 'Không hỗ trợ nội dung được bảo vệ bằng DRM.', FACEBOOK_EXTRACTOR: 'Facebook đã thay đổi dữ liệu Reel này; trình phân tích hiện chưa đọc được video. Hãy thử lại sau khi yt-dlp có bản cập nhật.', FFMPEG_MISSING: 'Không tìm thấy FFmpeg trong ứng dụng.', YTDLP_MISSING: 'Không tìm thấy yt-dlp trong ứng dụng.', DOWNLOAD_FAILED: 'Không thể tải video.', DOWNLOAD_CANCELLED: 'Đã hủy tải xuống.', MERGE_FAILED: 'Không thể ghép hình ảnh và âm thanh.', INVALID_OUTPUT: 'Vui lòng chọn lại thư mục lưu.'
  };
  return messages[code] ?? fallback;
}
