// Helper service to interact with Electron main process via window.electronAPI

export const ElectronService = {
  isElectron: () => {
    return typeof window !== 'undefined' && window.electronAPI !== undefined;
  },

  checkProxy: async (proxyString) => {
    if (ElectronService.isElectron()) {
      return await window.electronAPI.checkProxy(proxyString);
    } else {
      await new Promise((resolve) => setTimeout(resolve, 800));
      if (!proxyString || proxyString.toLowerCase().includes('không')) {
        return {
          success: true,
          isDirectIp: true,
          message: '[Mô phỏng Web] Dùng IP Máy trực tiếp (Không proxy)',
        };
      }
      const isAlive = !proxyString.includes('999') && !proxyString.includes('dead');
      if (isAlive) {
        return {
          success: true,
          ip: proxyString.split(':')[0] || '192.0.2.10',
          latency: `${Math.floor(Math.random() * 80 + 30)}ms`,
          country: 'Vietnam',
          message: `[Mô phỏng Web] Kết nối proxy thành công (${Math.floor(Math.random() * 80 + 30)}ms).`,
        };
      } else {
        return {
          success: false,
          message: '[Mô phỏng Web] Lỗi kết nối proxy. Proxy không phản hồi.',
        };
      }
    }
  },

  launchBrowser: async (profileData) => {
    if (ElectronService.isElectron()) {
      return await window.electronAPI.launchBrowser(profileData);
    } else {
      await new Promise((resolve) => setTimeout(resolve, 600));
      return {
        success: true,
        userDataDir: `browser_profiles/profile_${profileData.id}`,
        proxyUsed: profileData.proxy || 'Không dùng Proxy',
        message: `[Mô phỏng Web] Đã mở Facebook cho hồ sơ "${profileData.name}"`,
      };
    }
  },

  checkFacebookLogin: async (profileData) => {
    if (ElectronService.isElectron()) {
      return await window.electronAPI.checkFacebookLogin(profileData);
    }
    return { success: false, errorType: 'web_mode', message: 'Chức năng này chỉ khả dụng trong ứng dụng desktop.' };
  },

  startSession: async (params) => {
    if (ElectronService.isElectron()) {
      return await window.electronAPI.startSession(params);
    } else {
      // Web mock simulation with validation checks
      const { profile, durationMinutes } = params;
      if (!profile.pageName) {
        return { success: false, reason: 'Chưa chọn Page cho hồ sơ này. Vui lòng chọn Page trước khi chạy.' };
      }
      if (profile.proxy && (profile.proxy.includes('999') || profile.proxy.includes('dead'))) {
        return { success: false, reason: 'Proxy bị lỗi / mất kết nối.' };
      }
      if (profile.checkpointStatus === 'verification_required') {
        return { success: false, reason: 'Phát hiện Facebook yêu cầu xác minh (Checkpoint / 2FA).' };
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
      return {
        success: true,
        message: `[Mô phỏng Web] Bắt đầu phiên xem Feed & Reels (${durationMinutes || 30} phút) cho "${profile.name}".`,
        sessionInfo: {
          profileId: profile.id,
          profileName: profile.name,
          pageName: profile.pageName,
          durationMinutes: durationMinutes || 30,
          startTime: Date.now(),
          isRunning: true,
          statusText: 'Đang lướt Feed & xem Reels Facebook (Chỉ đọc nội dung)',
        }
      };
    }
  },

  stopSession: async (profileId) => {
    if (ElectronService.isElectron()) {
      return await window.electronAPI.stopSession(profileId);
    } else {
      return {
        success: true,
        message: `[Mô phỏng Web] Đã bấm Dừng ngay phiên chạy cho hồ sơ ID: ${profileId}`,
      };
    }
  },

  getSessionStatus: async (profileId) => {
    if (ElectronService.isElectron()) {
      return await window.electronAPI.getSessionStatus(profileId);
    } else {
      return { success: true, session: null };
    }
  },

  encryptData: async (plainText) => {
    if (ElectronService.isElectron()) {
      return await window.electronAPI.encryptData(plainText);
    } else {
      return {
        success: true,
        data: btoa(unescape(encodeURIComponent(plainText))),
        protectedBy: 'Web Base64',
      };
    }
  },

  decryptData: async (encryptedText) => {
    if (ElectronService.isElectron()) {
      return await window.electronAPI.decryptData(encryptedText);
    } else {
      return {
        success: true,
        data: decodeURIComponent(escape(atob(encryptedText))),
      };
    }
  },

  getAppPaths: async () => {
    if (ElectronService.isElectron()) {
      return await window.electronAPI.getAppPaths();
    } else {
      return {
        baseDir: 'browser_profiles (Cục bộ)',
        encryptionAvailable: false,
      };
    }
  },

  syncSchedulerProfiles: async (profiles) => {
    if (ElectronService.isElectron()) return await window.electronAPI.syncSchedulerProfiles(profiles);
    return { success: true, count: profiles.length };
  },

  getTelegramConfig: async () => {
    if (ElectronService.isElectron()) return window.electronAPI.getTelegramConfig();
    return { success: true, config: { enabled: false, chatId: '', hasToken: false, events: { start: true, end: true, error: true } } };
  },

  saveTelegramConfig: async (config) => {
    if (ElectronService.isElectron()) return window.electronAPI.saveTelegramConfig(config);
    return { success: false, message: 'Chỉ khả dụng trong ứng dụng desktop.' };
  },

  testTelegram: async () => {
    if (ElectronService.isElectron()) return window.electronAPI.testTelegram();
    return { success: false, message: 'Chỉ khả dụng trong ứng dụng desktop.' };
  },

  discoverTelegramChats: async (token) => {
    if (ElectronService.isElectron()) return window.electronAPI.discoverTelegramChats(token);
    return { success: false, message: 'Chỉ khả dụng trong ứng dụng desktop.' };
  },

  getTelegramLogs: async () => {
    if (ElectronService.isElectron()) return window.electronAPI.getTelegramLogs();
    return { success: true, logs: [] };
  },

  clearTelegramLogs: async () => {
    if (ElectronService.isElectron()) return window.electronAPI.clearTelegramLogs();
    return { success: true };
  },

  onScheduledSessionResult: (callback) => {
    if (ElectronService.isElectron()) return window.electronAPI.onScheduledSessionResult(callback);
    return () => {};
  },

  onSessionEnded: (callback) => {
    if (ElectronService.isElectron()) return window.electronAPI.onSessionEnded(callback);
    return () => {};
  },

  onSessionAlert: (callback) => {
    if (ElectronService.isElectron()) return window.electronAPI.onSessionAlert(callback);
    return () => {};
  },

  onTelegramProfilesUpdated: (callback) => {
    if (ElectronService.isElectron()) return window.electronAPI.onTelegramProfilesUpdated(callback);
    return () => {};
  }
};
