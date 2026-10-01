const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  checkProxy: (proxyString) => ipcRenderer.invoke('check-proxy', proxyString),
  launchBrowser: (profileData) => ipcRenderer.invoke('launch-browser', profileData),
  checkFacebookLogin: (profileData) => ipcRenderer.invoke('check-facebook-login', profileData),
  startSession: (params) => ipcRenderer.invoke('start-session', params),
  stopSession: (profileId) => ipcRenderer.invoke('stop-session', profileId),
  getSessionStatus: (profileId) => ipcRenderer.invoke('get-session-status', profileId),
  encryptData: (plainText) => ipcRenderer.invoke('encrypt-data', plainText),
  decryptData: (encryptedText) => ipcRenderer.invoke('decrypt-data', encryptedText),
  getAppPaths: () => ipcRenderer.invoke('get-app-paths'),
  syncSchedulerProfiles: (profiles) => ipcRenderer.invoke('sync-scheduler-profiles', profiles),
  getTelegramConfig: () => ipcRenderer.invoke('get-telegram-config'),
  saveTelegramConfig: (config) => ipcRenderer.invoke('save-telegram-config', config),
  testTelegram: () => ipcRenderer.invoke('test-telegram'),
  discoverTelegramChats: (token) => ipcRenderer.invoke('discover-telegram-chats', token),
  getTelegramLogs: () => ipcRenderer.invoke('get-telegram-logs'),
  clearTelegramLogs: () => ipcRenderer.invoke('clear-telegram-logs'),
  onScheduledSessionResult: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('scheduled-session-result', listener);
    return () => ipcRenderer.removeListener('scheduled-session-result', listener);
  },
  onSessionEnded: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('session-ended', listener);
    return () => ipcRenderer.removeListener('session-ended', listener);
  },
  onSessionAlert: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('session-alert', listener);
    return () => ipcRenderer.removeListener('session-alert', listener);
  },
  onTelegramProfilesUpdated: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('telegram-profiles-updated', listener);
    return () => ipcRenderer.removeListener('telegram-profiles-updated', listener);
  },
});
