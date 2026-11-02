export const IPC_CHANNELS = {
  scanUrl: 'scanner:scan-url', chooseDirectory: 'dialog:choose-directory', download: 'download:start',
  cancelDownload: 'download:cancel', downloadProgress: 'download:progress', openFile: 'shell:open-file', openFolder: 'shell:open-folder', openExternal: 'shell:open-external',
  tiktokLogin: 'auth:tiktok-login', tiktokStatus: 'auth:tiktok-status', tiktokLogout: 'auth:tiktok-logout',
  licenseCheck: 'license:check', licenseActivate: 'license:activate', licenseDeactivate: 'license:deactivate'
} as const;
