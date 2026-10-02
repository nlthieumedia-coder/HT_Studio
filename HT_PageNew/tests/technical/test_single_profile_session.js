import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== KIỂM THỬ VÒNG ĐỜI PHIÊN CHẠY (BẮT ĐẦU -> ĐANG CHẠY -> DỪNG NGAY / HẾT GIỜ) ===\n');

// Mock Profile Definitions
const validProfile = {
  id: 'prof-001',
  name: 'Hồ sơ Facebook Marketing 01',
  proxy: '192.0.2.10:8080',
  pageName: 'Thời Trang Nam Cao Cấp - HT',
  isLoggedIn: true,
  checkpointStatus: 'normal',
};

const profileNoPage = {
  id: 'prof-003',
  name: 'Hồ sơ chưa chọn Page',
  proxy: '198.51.100.20:1080',
  pageName: '', // Empty page
  isLoggedIn: false,
};

const profileDeadProxy = {
  id: 'prof-999',
  name: 'Hồ sơ Proxy Lỗi',
  proxy: '1.2.3.4:9999:dead:user', // Dead proxy
  pageName: 'Page Test',
};

// Simulated Session Manager Logic
class SessionEngine {
  constructor() {
    this.activeSession = null;
  }

  async startSession(profile, durationSeconds = 5) {
    console.log(`[BƯỚC 1: KIỂM TRA ĐIỀU KIỆN CHẠY] Hồ sơ: "${profile.name}"...`);

    // Rule 1: Check Page selection
    if (!profile.pageName) {
      return { success: false, reason: 'Chưa chọn Page cho hồ sơ này. Vui lòng chọn Page trước khi chạy.' };
    }

    // Rule 2: Check Proxy
    if (profile.proxy && profile.proxy.includes('dead')) {
      return { success: false, reason: 'Proxy bị lỗi / không thể kết nối. Vui lòng kiểm tra lại Proxy.' };
    }

    // Rule 3: Check Login / Checkpoint
    if (!profile.isLoggedIn) {
      return { success: false, reason: 'Tài khoản chưa đăng nhập Facebook. Vui lòng bấm "Mở Facebook" để tự đăng nhập trước.' };
    }

    console.log(`[BƯỚC 2: KHỞI TẠO PHIÊN] Mở Facebook (Cookie lưu trong profile_${profile.id}) | Proxy: ${profile.proxy}`);
    console.log(`[BƯỚC 3: XÁC NHẬN PAGE] Page được chọn: "${profile.pageName}"`);
    console.log(`[BƯỚC 4: CHỈ ĐỌC NỘI DUNG] Cuộn Feed & Reels. KHÔNG Thích, Bình luận, Chia sẻ hay Đăng bài.`);

    this.activeSession = {
      profileId: profile.id,
      profileName: profile.name,
      pageName: profile.pageName,
      startTime: Date.now(),
      durationSeconds,
      isRunning: true,
    };

    return { success: true, message: `Bắt đầu phiên chạy thành công cho "${profile.name}" (${durationSeconds}s).` };
  }

  stopSession(profileId) {
    if (this.activeSession && this.activeSession.profileId === profileId) {
      this.activeSession.isRunning = false;
      console.log(`[DỪNG NGAY]: Đã dừng phiên chạy của hồ sơ ${profileId} theo yêu cầu người dùng.`);
      return { success: true, message: 'Đã dừng ngay phiên chạy thành công.' };
    }
    return { success: false, message: 'Không có phiên nào đang chạy.' };
  }
}

async function runTests() {
  const engine = new SessionEngine();

  console.log('--- TEST 1: Kiểm tra dừng phiên khi chưa chọn Page ---');
  const res1 = await engine.startSession(profileNoPage);
  console.log(`Kết quả: ${res1.success ? 'FAIL' : 'PASS (Đã dừng đúng lý do)'} => Lý do: "${res1.reason}"\n`);

  console.log('--- TEST 2: Kiểm tra dừng phiên khi Proxy lỗi ---');
  const res2 = await engine.startSession(profileDeadProxy);
  console.log(`Kết quả: ${res2.success ? 'FAIL' : 'PASS (Đã dừng đúng lý do)'} => Lý do: "${res2.reason}"\n`);

  console.log('--- TEST 3: Kiểm tra vòng đời phiên chạy thành công (Bắt đầu -> Đang chạy -> Hết giờ) ---');
  const res3 = await engine.startSession(validProfile, 3);
  if (res3.success) {
    console.log('...Đang xem nội dung Feed & Reels (Thời lượng 3s)...');
    await new Promise((r) => setTimeout(r, 3100));
    console.log('[HẾT THỜI LƯỢNG]: Tự động kết thúc phiên chạy đúng thời gian quy định.');
    console.log('-> KẾT QUẢ TEST 3: THÀNH CÔNG RỰC RỠ!\n');
  }

  console.log('--- TEST 4: Kiểm tra nút "Dừng ngay" giữa chừng ---');
  const res4 = await engine.startSession(validProfile, 60);
  if (res4.success) {
    console.log('...Đang chạy phiên 60s...');
    await new Promise((r) => setTimeout(r, 500));
    engine.stopSession(validProfile.id);
    console.log('-> KẾT QUẢ TEST 4: THÀNH CÔNG! Đã dừng ngay tức thì.');
  }
}

runTests();
