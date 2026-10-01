// Utility for calculating profile execution schedules in Asia/Bangkok timezone (UTC+7)

export function getBangkokTimeParts(dateObj = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(dateObj);
  const map = {};
  parts.forEach((p) => {
    if (p.type !== 'literal') map[p.type] = parseInt(p.value, 10);
  });
  if (map.hour === 24) map.hour = 0;

  // Construct UTC date matching Bangkok local time to extract dayOfWeek reliably
  const bangkokUtcDate = new Date(Date.UTC(map.year, map.month - 1, map.day, map.hour, map.minute, map.second));
  const dayOfWeek = bangkokUtcDate.getUTCDay(); // 0 = Sunday, 1 = Monday ... 6 = Saturday

  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour,
    minute: map.minute,
    second: map.second,
    dayOfWeek,
  };
}

// Convert Bangkok local date components to a JavaScript Date object safely with day/month rollover
export function createBangkokDate(year, month, day, hour = 0, minute = 0, second = 0) {
  // Bangkok is UTC+7, so subtract 7 hours in UTC constructor
  const utcTime = Date.UTC(year, month - 1, day, hour - 7, minute, second);
  return new Date(utcTime);
}

/**
 * Calculates the Next Run Time for a profile schedule config
 * @param {Object} scheduleConfig 
 * @param {Date} now Reference current time
 * @returns {Date | null} Next execution Date object in Asia/Bangkok, or null if disabled
 */
export function calculateNextRunTime(scheduleConfig, now = new Date()) {
  if (!scheduleConfig || !scheduleConfig.scheduleEnabled) {
    return null;
  }

  const daysOfWeek = scheduleConfig.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];
  if (daysOfWeek.length === 0) {
    return null;
  }

  const timeStr = scheduleConfig.startTime || '08:30';
  const [targetHour, targetMinute] = timeStr.split(':').map((v) => parseInt(v, 10) || 0);

  const restIntervalMs = (scheduleConfig.restIntervalMinutes || 60) * 60 * 1000;
  const minAllowedTime = scheduleConfig.lastRunTime
    ? new Date(scheduleConfig.lastRunTime).getTime() + restIntervalMs
    : 0;

  const nowParts = getBangkokTimeParts(now);

  // Search ahead up to 14 days for the next valid slot
  for (let dayOffset = 0; dayOffset <= 14; dayOffset++) {
    const candidateBase = createBangkokDate(
      nowParts.year,
      nowParts.month,
      nowParts.day + dayOffset,
      targetHour,
      targetMinute,
      0
    );

    const candidateParts = getBangkokTimeParts(candidateBase);
    const candidateTime = candidateBase.getTime();

    if (daysOfWeek.includes(candidateParts.dayOfWeek)) {
      if (candidateTime > now.getTime() && candidateTime >= minAllowedTime) {
        return candidateBase;
      }
    }
  }

  return null;
}

/**
 * Format a Date object into a readable Bangkok time string
 * e.g. "Thứ 2, 28/09/2026 14:00 (Asia/Bangkok)"
 */
export function formatBangkokTime(dateObj) {
  if (!dateObj || isNaN(dateObj.getTime())) return 'Chưa lên lịch / Đã tắt';

  const parts = getBangkokTimeParts(dateObj);
  const dayNames = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  const dayName = dayNames[parts.dayOfWeek] || '';

  const pad = (n) => String(n).padStart(2, '0');
  return `${dayName}, ${pad(parts.day)}/${pad(parts.month)}/${parts.year} ${pad(parts.hour)}:${pad(parts.minute)} (Asia/Bangkok)`;
}
