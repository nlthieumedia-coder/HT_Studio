const { contextBridge, ipcRenderer, webUtils } = require("electron");
contextBridge.exposeInMainWorld("vidsApp", {
  chooseImages: () => ipcRenderer.invoke("choose-images"), chooseFolder: () => ipcRenderer.invoke("choose-folder"), defaultOutput: () => ipcRenderer.invoke("default-output"),
  getPathsForFiles: files => files.map(file => webUtils.getPathForFile(file)),
  listAccounts: () => ipcRenderer.invoke("accounts-list"), addAccount: name => ipcRenderer.invoke("account-add", name), bulkAddAccounts: records => ipcRenderer.invoke("accounts-bulk-add", records), bulkLoginAccounts: () => ipcRenderer.invoke("accounts-bulk-login"), loginAccount: id => ipcRenderer.invoke("account-login", id), openBrowserLogin: id => ipcRenderer.invoke("account-open-browser", id), renameAccount: (id, name) => ipcRenderer.invoke("account-rename", id, name), deleteAccount: id => ipcRenderer.invoke("account-delete", id), toggleAccount: (id, enabled) => ipcRenderer.invoke("account-toggle", id, enabled),
  runJobs: payload => ipcRenderer.invoke("run-jobs", payload), enqueue: payload => ipcRenderer.invoke("queue-add", payload), startTask: id => ipcRenderer.invoke("queue-start", id), listQueue: () => ipcRenderer.invoke("queue-list"), retryTask: id => ipcRenderer.invoke("queue-retry", id), deleteTask: id => ipcRenderer.invoke("queue-delete", id), updateTask: payload => ipcRenderer.invoke("queue-update", payload), listLibrary: () => ipcRenderer.invoke("library-list"), revealFile: path => ipcRenderer.invoke("reveal-file", path), openFile: path => ipcRenderer.invoke("open-file", path), openExternal: url => ipcRenderer.invoke("open-external", url), getNextTaskName: () => ipcRenderer.invoke("get-next-task-name"),
  onProgress: handler => ipcRenderer.on("progress", (_event, payload) => handler(payload)),
  onQueueUpdated: handler => ipcRenderer.on("queue-updated", () => handler()),
  checkLicense: () => ipcRenderer.invoke("license-check"),
  activateLicense: key => ipcRenderer.invoke("license-activate", key),
  deactivateLicense: () => ipcRenderer.invoke("license-deactivate"),
});
