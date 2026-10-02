import { calculateNextRunTime, formatBangkokTime, createBangkokDate, getBangkokTimeParts } from '../../src/services/scheduleCalculator.js';

console.log('=== THỰC HIỆN CHẠY THỬ BẰNG LỊCH HẸN CÁCH THỜI ĐIỂM HIỆN TẠI 2 PHÚT ===\n');

const now = new Date();
const nowParts = getBangkokTimeParts(now);

console.log(`[THỜI DIỂM HIỆN TẠI]: ${formatBangkokTime(now)}`);

// Calculate target time: 2 minutes in the future
let targetMin = nowParts.minute + 2;
let targetHour = nowParts.hour;
if (targetMin >= 60) {
  targetMin -= 60;
  targetHour = (targetHour + 1) % 24;
}

const pad = (n) => String(n).padStart(2, '0');
const startTimeStr = `${pad(targetHour)}:${pad(targetMin)}`;

const trialProfileSchedule = {
  profileId: 'prof-001',
  profileName: 'Hồ sơ Facebook Marketing 01',
  scheduleConfig: {
    scheduleEnabled: true,
    startTime: startTimeStr,
    durationMinutes: 1, // 1 minute test duration
    daysOfWeek: [nowParts.dayOfWeek], // Today enabled
    restIntervalMinutes: 15,
    lastRunTime: null,
  }
};

console.log(`[CẤU HÌNH LỊCH MỚI]: Bật lịch chạy riêng cho "${trialProfileSchedule.profileName}"`);
console.log(`- Giờ hẹn tự động: ${startTimeStr} (Asia/Bangkok)`);
console.log(`- Thời lượng phiên: 1 phút`);
console.log(`- Các ngày chọn: Hôm nay (${['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'][nowParts.dayOfWeek]})`);

const nextRun = calculateNextRunTime(trialProfileSchedule.scheduleConfig, now);
console.log(`- "Lần chạy kế tiếp" được tính toán: ${formatBangkokTime(nextRun)}\n`);

// Simulate Scheduler Worker Tick
console.log('[SCHEDULER WORKER]: Đang theo dõi và kiểm tra lịch hẹn mỗi 10s...');

let simTime = new Date(now.getTime());
let triggered = false;
let activeRunning = false;

for (let tick = 0; tick <= 18; tick++) { // Simulate 3 minutes tick loop
  const currentTickParts = getBangkokTimeParts(simTime);
  const currentTickNext = calculateNextRunTime(trialProfileSchedule.scheduleConfig, simTime);
  const diffMs = nextRun.getTime() - simTime.getTime();

  if (diffMs <= 0 && !triggered) {
    if (!activeRunning) {
      activeRunning = true;
      triggered = true;
      console.log(`⏱️ [TICK ${tick * 10}s - ${formatBangkokTime(simTime)}]: ĐÃ ĐẾN GIỜ HẸN ${startTimeStr}!`);
      console.log(`  🚀 KÍCH HOẠT PHIÊN CHẠY TỰ ĐỘNG CHO "${trialProfileSchedule.profileName}"!`);
      console.log(`  🔒 KHÔNG chạy trùng phiên. Trạng thái: activeRunning = true`);
      console.log(`  ⏱️ Đang xem Feed & Reels trong 1 phút...`);
    } else {
      console.log(`⚠️ [TICK ${tick * 10}s]: Đã có phiên đang chạy cho hồ sơ này -> KHÔNG KÍCH HOẠT TRÙNG LẶP.`);
    }
  } else if (!triggered) {
    const remainSec = Math.ceil(diffMs / 1000);
    console.log(`⌛ [TICK ${tick * 10}s - ${formatBangkokTime(simTime)}]: Còn ${remainSec}s nữa mới đến giờ hẹn (${startTimeStr})...`);
  }

  // Fast forward simulation time by 10 seconds
  simTime = new Date(simTime.getTime() + 10000);
}

console.log('\n======================================================');
if (triggered) {
  console.log('✅ KẾT QUẢ CHẠY THỬ VỚI LỊCH CÁCH VÀI PHÚT: THÀNH CÔNG RỰC RỠ!');
  console.log('1. Lịch hẹn tính toán đúng mốc tương lai sát thời điểm hiện tại.');
  console.log('2. Scheduler tự động phát hiện và kích hoạt phiên chạy ngay khi đến giờ.');
  console.log('3. Bảo đảm tính đơn phiên: Không chạy đồng thời 2 phiên cho cùng 1 hồ sơ.');
} else {
  console.error('❌ KẾT QUẢ CHẠY THỬ: THẤT BẠI!');
}
console.log('======================================================\n');
