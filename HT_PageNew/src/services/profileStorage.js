const STORAGE_KEY = 'ht_studio_facebook_profiles_v1';
const SCHEDULES_KEY = 'ht_studio_schedules_v1';
const LOGS_KEY = 'ht_studio_logs_v1';

// Initial sample profiles with 5 explicit execution statuses
const DEFAULT_PROFILES = [
  {
    id: 'prof-001',
    name: 'Hồ sơ Facebook Marketing 01',
    proxy: '192.0.2.10:8080:demo_user:demo_pass',
    pageName: 'Thời Trang Nam Cao Cấp - HT',
    managedPages: ['Thời Trang Nam Cao Cấp - HT', 'Giày Sneaker Chĩnh Hãng', 'Đồ Nam Basic'],
    accountName: 'Nguyễn Văn Nam (Đã lưu phiên)',
    isLoggedIn: true,
    status: true,
    executionStatus: 'idle', // 'idle' (Đang chờ) | 'running' (Đang chạy) | 'verification_required' (Cần xác minh) | 'error' (Lỗi) | 'completed' (Đã hoàn thành)
    lastActive: '28/09/2026 10:15',
    targetAction: 'Xem Feed & Reels (25 phút/phiên)',
    scheduleConfig: {
      scheduleEnabled: true,
      startTime: '08:30',
      durationMinutes: 30,
      daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
      restIntervalMinutes: 60,
      lastRunTime: '2026-09-28T10:15:00+07:00',
    }
  },
  {
    id: 'prof-002',
    name: 'Hồ sơ Facebook Tin Tức 02',
    proxy: '198.51.100.20:3128:demo_user:demo_pass',
    pageName: 'Tin Tức Công Nghệ 24/7',
    managedPages: ['Tin Tức Công Nghệ 24/7', 'Review Gadget Việt'],
    accountName: 'Trần Thị Mai (Đã lưu phiên)',
    isLoggedIn: true,
    status: true,
    executionStatus: 'completed', // Đã hoàn thành
    lastActive: '28/09/2026 09:30',
    targetAction: 'Xem Reels (15 phút/phiên)',
    scheduleConfig: {
      scheduleEnabled: true,
      startTime: '12:15',
      durationMinutes: 20,
      daysOfWeek: [1, 3, 5],
      restIntervalMinutes: 60,
      lastRunTime: '2026-09-28T09:30:00+07:00',
    }
  },
  {
    id: 'prof-003',
    name: 'Hồ sơ Vi Vu Du Lịch 03',
    proxy: '203.0.113.30:1080',
    pageName: 'Góc Review Du Lịch Việt Nam',
    managedPages: ['Góc Review Du Lịch Việt Nam', 'Phượt Thủ Sài Gòn'],
    accountName: 'Chưa xác định (Cần mở Facebook)',
    isLoggedIn: false,
    status: false,
    executionStatus: 'error', // Lỗi (Mất kết nối / Chưa đăng nhập)
    lastActive: '27/09/2026 18:45',
    targetAction: 'Xem Feed (20 phút/phiên)',
    scheduleConfig: {
      scheduleEnabled: false,
      startTime: '18:00',
      durationMinutes: 20,
      daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
      restIntervalMinutes: 60,
      lastRunTime: null,
    }
  },
  {
    id: 'prof-004',
    name: 'Hồ sơ Ẩm Thực Đêm 04',
    proxy: 'Không dùng proxy (Dùng IP máy)',
    pageName: 'Món Ngon Sài Thành',
    managedPages: ['Món Ngon Sài Thành', 'Ăn Vặt Đêm Khuya'],
    accountName: 'Lê Hoàng Long (Đã lưu phiên)',
    isLoggedIn: true,
    status: true,
    executionStatus: 'idle', // Đang chờ
    lastActive: '28/09/2026 11:00',
    targetAction: 'Xem Feed & Reels (30 phút/phiên)',
    scheduleConfig: {
      scheduleEnabled: true,
      startTime: '20:00',
      durationMinutes: 45,
      daysOfWeek: [6, 0],
      restIntervalMinutes: 60,
      lastRunTime: '2026-09-28T11:00:00+07:00',
    }
  },
  {
    id: 'prof-005',
    name: 'Hồ sơ Bất Động Sản 05',
    proxy: '192.0.2.40:8000:demo_user:demo_pass',
    pageName: 'Đầu Tư Bất Động Sản Thủ Đức',
    managedPages: ['Đầu Tư Bất Động Sản Thủ Đức'],
    accountName: 'Phạm Quốc Hùng (Yêu cầu 2FA)',
    isLoggedIn: false,
    status: false,
    executionStatus: 'verification_required', // Cần xác minh
    lastActive: '26/09/2026 14:20',
    targetAction: 'Xem Feed (15 phút/phiên)',
    scheduleConfig: {
      scheduleEnabled: false,
      startTime: '10:00',
      durationMinutes: 15,
      daysOfWeek: [1, 2, 3, 4, 5],
      restIntervalMinutes: 60,
      lastRunTime: null,
    }
  }
];

const DEFAULT_SCHEDULES = [
  {
    id: 'sch-001',
    profileId: 'prof-001',
    profileName: 'Hồ sơ Facebook Marketing 01',
    pageName: 'Thời Trang Nam Cao Cấp - HT',
    timeSlot: '08:30 (Mặc định 30 phút)',
    actionType: 'Xem Feed & Reels',
    duration: 30,
    status: true,
  }
];

const DEFAULT_LOGS = [
  {
    id: 'log-001',
    timestamp: '2026-09-28 11:00:15',
    profileName: 'Hồ sơ Ẩm Thực Đêm 04',
    pageName: 'Món Ngon Sài Thành',
    action: 'Kết thúc phiên xem Feed & Reels',
    type: 'success',
    details: 'Bắt đầu: 10:30:00 | Kết thúc: 11:00:00 | Thời lượng thực tế: 30 phút | Nguyên nhân dừng: Hoàn thành thời lượng quy định.'
  },
  {
    id: 'log-002',
    timestamp: '2026-09-28 10:15:02',
    profileName: 'Hồ sơ Facebook Marketing 01',
    pageName: 'Thời Trang Nam Cao Cấp - HT',
    action: 'Bắt đầu phiên lướt Feed & Reels tự động',
    type: 'info',
    details: 'Bắt đầu: 10:15:00 | Page được chọn: "Thời Trang Nam Cao Cấp - HT" | Trạng thái: Đang chạy.'
  },
  {
    id: 'log-003',
    timestamp: '2026-09-28 09:30:44',
    profileName: 'Hồ sơ Bất Động Sản 05',
    pageName: 'Đầu Tư Bất Động Sản Thủ Đức',
    action: 'Phát hiện yêu cầu xác minh tài khoản từ Facebook (Checkpoint / 2FA)',
    type: 'warning',
    details: 'Bắt đầu: 09:30:00 | Kết thúc: 09:30:44 | Nguyên nhân dừng: Facebook yêu cầu 2FA/CAPTCHA. Đã dừng hồ sơ và chuyển trạng thái sang Cần xác minh.'
  }
];

export const ProfileStorage = {
  getProfiles: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PROFILES));
        return DEFAULT_PROFILES;
      }
      return JSON.parse(data);
    } catch (e) {
      console.error('Lỗi khi đọc danh sách hồ sơ:', e);
      return DEFAULT_PROFILES;
    }
  },

  saveProfiles: (profiles) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    } catch (e) {
      console.error('Lỗi khi lưu hồ sơ:', e);
    }
  },

  addProfile: (newProfile) => {
    const profiles = ProfileStorage.getProfiles();
    const created = {
      ...newProfile,
      id: `prof-${Date.now().toString().slice(-4)}`,
      lastActive: 'Chưa mở',
      managedPages: newProfile.managedPages || [],
      pageName: newProfile.pageName || '',
      accountName: newProfile.accountName || 'Chưa đăng nhập (Bấm Mở Facebook)',
      isLoggedIn: false,
      executionStatus: 'idle', // 'idle' (Đang chờ)
      scheduleConfig: newProfile.scheduleConfig || {
        scheduleEnabled: true,
        startTime: '08:30',
        durationMinutes: 30,
        daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
        restIntervalMinutes: 60,
        lastRunTime: null,
      }
    };
    const updated = [created, ...profiles];
    ProfileStorage.saveProfiles(updated);
    
    ProfileStorage.addLog({
      profileName: created.name,
      pageName: created.pageName,
      action: 'Thêm mới hồ sơ tài khoản',
      type: 'info',
      details: `Bắt đầu: ${new Date().toLocaleTimeString('vi-VN')} | Page chọn: ${created.pageName} | Trạng thái: Đang chờ`
    });

    return updated;
  },

  updateProfile: (updatedProfile) => {
    const profiles = ProfileStorage.getProfiles();
    const index = profiles.findIndex(p => p.id === updatedProfile.id);
    if (index !== -1) {
      profiles[index] = { ...profiles[index], ...updatedProfile };
      ProfileStorage.saveProfiles(profiles);

      ProfileStorage.addLog({
        profileName: updatedProfile.name,
        pageName: updatedProfile.pageName,
        action: 'Cập nhật cấu hình hồ sơ',
        type: 'info',
        details: `Cập nhật thông tin hồ sơ | Page đang dùng: ${updatedProfile.pageName}`
      });
    }
    return profiles;
  },

  updateProfileExecutionStatus: (profileId, executionStatus, errorReason = '') => {
    const profiles = ProfileStorage.getProfiles();
    const index = profiles.findIndex(p => p.id === profileId);
    if (index !== -1) {
      profiles[index].executionStatus = executionStatus;
      if (executionStatus === 'verification_required') {
        profiles[index].checkpointStatus = 'verification_required';
      } else if (executionStatus === 'running' || executionStatus === 'completed') {
        profiles[index].checkpointStatus = 'normal';
      }
      ProfileStorage.saveProfiles(profiles);
    }
    return profiles;
  },

  updateProfileSchedule: (profileId, scheduleConfig) => {
    const profiles = ProfileStorage.getProfiles();
    const index = profiles.findIndex(p => p.id === profileId);
    if (index !== -1) {
      profiles[index].scheduleConfig = scheduleConfig;
      ProfileStorage.saveProfiles(profiles);

      const p = profiles[index];
      ProfileStorage.addLog({
        profileName: p.name,
        pageName: p.pageName,
        action: 'Cập nhật lịch chạy riêng cho hồ sơ',
        type: 'info',
        details: `Giờ chạy: ${scheduleConfig.startTime || '08:30'} | Thời lượng: ${scheduleConfig.durationMinutes || 30}m | Trạng thái: ${scheduleConfig.scheduleEnabled ? 'Bật' : 'Tắt'}`
      });
    }
    return profiles;
  },

  selectPageForProfile: (profileId, pageConfig, options = {}) => {
    const profiles = ProfileStorage.getProfiles();
    const index = profiles.findIndex(p => p.id === profileId);
    if (index !== -1) {
      const config = typeof pageConfig === 'string'
        ? { pageName: pageConfig, managedPages: [pageConfig], pageRotationMode: 'fixed', pageRotationIndex: 0 }
        : pageConfig;
      profiles[index] = { ...profiles[index], ...config };
      ProfileStorage.saveProfiles(profiles);

      if (!options.silent) {
        ProfileStorage.addLog({
          profileName: profiles[index].name,
          pageName: profiles[index].pageName,
          action: 'Cập nhật danh sách Fanpage quản lý',
          type: 'success',
          details: `Chế độ: ${profiles[index].pageRotationMode || 'fixed'} | Số Page: ${(profiles[index].managedPages || []).length}`
        });
      }
    }
    return profiles;
  },

  deleteProfile: (id) => {
    const profiles = ProfileStorage.getProfiles();
    const target = profiles.find(p => p.id === id);
    const updated = profiles.filter(p => p.id !== id);
    ProfileStorage.saveProfiles(updated);

    if (target) {
      ProfileStorage.addLog({
        profileName: target.name,
        pageName: target.pageName,
        action: 'Xóa hồ sơ khỏi danh sách',
        type: 'warning',
        details: `Hồ sơ ID: ${id} đã bị xóa khỏi hệ thống.`
      });
    }
    return updated;
  },

  toggleStatus: (id) => {
    const profiles = ProfileStorage.getProfiles();
    const index = profiles.findIndex(p => p.id === id);
    if (index !== -1) {
      profiles[index].status = !profiles[index].status;
      ProfileStorage.saveProfiles(profiles);

      const p = profiles[index];
      ProfileStorage.addLog({
        profileName: p.name,
        pageName: p.pageName,
        action: `Đổi trạng thái thành ${p.status ? 'BẬT' : 'TẮT'}`,
        type: p.status ? 'success' : 'warning',
        details: `Hồ sơ ${p.name} hiện tại đang ${p.status ? 'Bật' : 'Tắt'}`
      });
    }
    return profiles;
  },

  getSchedules: () => {
    try {
      const data = localStorage.getItem(SCHEDULES_KEY);
      if (!data) {
        localStorage.setItem(SCHEDULES_KEY, JSON.stringify(DEFAULT_SCHEDULES));
        return DEFAULT_SCHEDULES;
      }
      return JSON.parse(data);
    } catch (e) {
      return DEFAULT_SCHEDULES;
    }
  },

  getLogs: () => {
    try {
      const data = localStorage.getItem(LOGS_KEY);
      if (!data) {
        localStorage.setItem(LOGS_KEY, JSON.stringify(DEFAULT_LOGS));
        return DEFAULT_LOGS;
      }
      const parsed = JSON.parse(data);
      const normalized = parsed.map((log) => (
        String(log.action || '').startsWith('Không thể bắt đầu phiên') && log.type === 'warning'
          ? { ...log, type: 'error' }
          : log
      ));
      if (normalized.some((log, index) => log.type !== parsed[index].type)) {
        localStorage.setItem(LOGS_KEY, JSON.stringify(normalized));
      }
      return normalized;
    } catch (e) {
      return DEFAULT_LOGS;
    }
  },

  // Audit Sanitized Logging (NO cookies, NO passwords, NO tokens, NO raw Feed content)
  addSessionAuditLog: ({ profileName, pageName, startTime, endTime, actualDurationStr, stopReason, type = 'info' }) => {
    const logs = ProfileStorage.getLogs();
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

    // Sanitized detail string without sensitive tokens/passwords/raw feed text
    const details = `Bắt đầu: ${startTime || '-'} | Kết thúc: ${endTime || '-'} | Thời lượng thực tế: ${actualDurationStr || '0s'} | Page: "${pageName || '-'}" | Nguyên nhân dừng: ${stopReason || 'Không có'}`;

    const newLog = {
      id: `log-${Date.now()}`,
      timestamp,
      profileName: profileName || 'Hồ sơ',
      pageName: pageName || '-',
      action: type === 'success' ? 'Kết thúc phiên chạy' : type === 'warning' || type === 'danger' ? 'Tạm dừng phiên chạy' : 'Bắt đầu phiên chạy',
      type,
      details
    };

    const updated = [newLog, ...logs];
    try {
      localStorage.setItem(LOGS_KEY, JSON.stringify(updated.slice(0, 100)));
    } catch (e) {}
    return updated;
  },

  addLog: (logItem) => {
    const logs = ProfileStorage.getLogs();
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    const newLog = {
      id: `log-${Date.now()}`,
      timestamp,
      profileName: logItem.profileName || 'Hệ thống',
      pageName: logItem.pageName || '-',
      action: logItem.action || '',
      type: logItem.type || 'info',
      details: logItem.details || ''
    };
    const updated = [newLog, ...logs];
    try {
      localStorage.setItem(LOGS_KEY, JSON.stringify(updated.slice(0, 100)));
    } catch (e) {}
    return updated;
  },

  clearLogs: () => {
    localStorage.setItem(LOGS_KEY, JSON.stringify([]));
    return [];
  }
};
