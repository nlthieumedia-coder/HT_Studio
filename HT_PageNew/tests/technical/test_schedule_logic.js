import { calculateNextRunTime, formatBangkokTime, createBangkokDate, getBangkokTimeParts } from '../../src/services/scheduleCalculator.js';

console.log('=== BÀI KIỂM THỬ GIÁO TRÌNH XÁC ĐỊNH LỊCH CHẠY THỜI GIAN ASIA/BANGKOK (UTC+7) ===\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`✅ [PASS] Test ${totalTests}: ${message}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] Test ${totalTests}: ${message}`);
  }
}

// TEST 1: Giờ hiện tại là 13:56 (T2). Lịch 08:30 hằng ngày -> Đã qua 08:30 hôm nay -> Lần chạy tiếp theo là 08:30 ngày mai (T3).
const now1 = createBangkokDate(2026, 9, 28, 13, 56, 0); // Mon Sep 28 2026 13:56
const config1 = {
  scheduleEnabled: true,
  startTime: '08:30',
  durationMinutes: 30,
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // Tất cả các ngày
  restIntervalMinutes: 60,
};

const next1 = calculateNextRunTime(config1, now1);
const expected1 = createBangkokDate(2026, 9, 29, 8, 30, 0); // Tue Sep 29 2026 08:30
assert(next1 && next1.getTime() === expected1.getTime(), `Xử lý thời gian đã qua trong ngày -> Tính đúng ngày mai 08:30 (${formatBangkokTime(next1)})`);

// TEST 2: Giờ hiện tại là 13:56 (T2). Lịch 14:00 hằng ngày -> Chưa đến 14:00 hôm nay -> Lần chạy tiếp theo là 14:00 HÔM NAY (T2).
const next2 = calculateNextRunTime({ ...config1, startTime: '14:00' }, now1);
const expected2 = createBangkokDate(2026, 9, 28, 14, 0, 0);
assert(next2 && next2.getTime() === expected2.getTime(), `Thời gian sắp tới trong ngày -> Tính đúng hôm nay 14:00 (${formatBangkokTime(next2)})`);

// TEST 3: Xử lý qua NỬA ĐÊM (Midnight Rollover). Giờ hiện tại là 23:55. Lịch 00:15 -> Lần chạy tiếp theo là 00:15 ngày hôm sau.
const now3 = createBangkokDate(2026, 9, 28, 23, 55, 0);
const next3 = calculateNextRunTime({ ...config1, startTime: '00:15' }, now3);
const expected3 = createBangkokDate(2026, 9, 29, 0, 15, 0);
assert(next3 && next3.getTime() === expected3.getTime(), `Xử lý NỬA ĐÊM (23:55 -> 00:15 ngày sau) (${formatBangkokTime(next3)})`);

// TEST 4: Lọc THEO NGÀY TRONG TUẦN (Day of Week filter). Hôm nay T2. Lịch 08:30 nhưng chỉ bật T4 & T6 -> Lần chạy tiếp là T4.
const config4 = {
  scheduleEnabled: true,
  startTime: '08:30',
  daysOfWeek: [3, 5], // 3=Wed, 5=Fri
};
const next4 = calculateNextRunTime(config4, now1); // Mon Sep 28
const expected4 = createBangkokDate(2026, 9, 30, 8, 30, 0); // Wed Sep 30 08:30
assert(next4 && next4.getTime() === expected4.getTime(), `Bỏ qua các ngày không được chọn -> Đúng Thứ 4 08:30 (${formatBangkokTime(next4)})`);

// TEST 5: Khoảng nghỉ bắt buộc (Rest Interval constraint). Lần chạy trước lúc 13:30, nghỉ 120 phút -> Không thể chạy trước 15:30.
const config5 = {
  scheduleEnabled: true,
  startTime: '14:00',
  restIntervalMinutes: 120, // Nghỉ 2 tiếng
  lastRunTime: createBangkokDate(2026, 9, 28, 13, 30, 0).toISOString(),
};
const next5 = calculateNextRunTime(config5, now1);
// 14:00 hôm nay < 15:30 (13:30 + 120m) -> 14:00 hôm nay bị bỏ qua -> Chuyển sang 14:00 ngày mai!
const expected5 = createBangkokDate(2026, 9, 29, 14, 0, 0);
assert(next5 && next5.getTime() === expected5.getTime(), `Áp dụng khoảng nghỉ tối thiểu (Rest Interval) -> Chuyển sang khung giờ hợp lệ tiếp theo (${formatBangkokTime(next5)})`);

// TEST 6: KHÔNG CHẠY BÙ KHI TÁI KHỞI ĐỘNG (No Backfilling/Catchup).
// Ứng dụng tắt lúc 08:00, lỡ khung 08:30. Khởi động lại lúc 13:56 -> Phải tính mốc TƯƠNG LAI, KHÔNG kích hoạt khung 08:30 đã qua.
const next6 = calculateNextRunTime(config1, now1);
assert(next6.getTime() > now1.getTime(), `Khởi động lại ứng dụng -> KHÔNG chạy bù phiên đã bỏ lỡ, chỉ tính mốc tương lai (${formatBangkokTime(next6)})`);

console.log(`\n==========================================`);
console.log(`KẾT QUẢ KIỂM THỬ: ${passedTests}/${totalTests} TESTS ĐẠT NGUYÊN TẮC HOÀN HẢO!`);
console.log(`==========================================\n`);
