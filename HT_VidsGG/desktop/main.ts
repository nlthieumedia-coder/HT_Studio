import { app, BrowserWindow, dialog, ipcMain, safeStorage, shell } from "electron";
import { randomUUID, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { dirname, extname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleVidsDesktopService, type DesktopJobConfig, type DesktopJobResult, type GoogleLoginCredentials } from "../src/desktop-service.js";
import { formatDate, generateRandomCode, buildTaskFilename, getNextTaskIndex, ensureUniqueOutputFilename } from "../src/task-naming.js";
import { getMachineId, verifyLicenseKey, checkLicenseOnline, activateLicenseOnline, type LicenseRecord } from "../src/license.js";

const here = dirname(fileURLToPath(import.meta.url));
let mainWindow: BrowserWindow | undefined;
const runningAccounts = new Set<string>();
interface Account { id: string; name: string; email?: string; status: string; planEvidence?: string; loginError?: string; loginProgress?: string; hasStoredCredentials?: boolean; enabled?: boolean; disabledReason?: string; failureCount?: number; lastFailureAt?: string; updatedAt: string; browser?: "chrome" | "msedge" }
interface VideoRecord { id: string; accountId: string; accountName: string; status: "running"|"completed"|"failed"; createdAt: string; updatedAt: string; outputPath?: string; projectUrl?: string; width?: number; height?: number; duration?: number; error?: string }
interface QueueTask { id: string; taskIndex?: number; status: "draft"|"waiting"|"running"|"completed"|"failed"; accountPool: string[]; attemptedAccountIds?: string[]; assignedAccountId?: string; assignedAccountName?: string; config: DesktopJobConfig; createdAt: string; updatedAt: string; error?: string; videoId?: string; progress?: number; progressStage?: string; progressMessage?: string; outputPath?: string }
interface AppState { accounts: Account[]; videos: VideoRecord[]; tasks: QueueTask[]; taskCounter?: number }

const statePath = () => join(app.getPath("userData"), "app-state.json");
const credentialPath = () => join(app.getPath("userData"), "credentials.secure.json");
const licensePath = () => join(app.getPath("userData"), "license.secure.json");

type CredentialVault = Record<string, string>;
async function readCredentialVault(): Promise<CredentialVault> { try { return JSON.parse(await readFile(credentialPath(), "utf8")) as CredentialVault; } catch { return {}; } }
async function storeCredentials(accountId: string, credentials: GoogleLoginCredentials): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) throw new Error("Windows không cung cấp kho mã hóa an toàn; không thể lưu mật khẩu.");
  const vault = await readCredentialVault();
  vault[accountId] = safeStorage.encryptString(JSON.stringify(credentials)).toString("base64");
  await mkdir(dirname(credentialPath()), { recursive: true });
  await writeFile(credentialPath(), JSON.stringify(vault));
}
async function loadCredentials(accountId: string): Promise<GoogleLoginCredentials> {
  const encrypted = (await readCredentialVault())[accountId];
  if (!encrypted) throw new Error("Không tìm thấy thông tin đăng nhập đã mã hóa.");
  return JSON.parse(safeStorage.decryptString(Buffer.from(encrypted, "base64"))) as GoogleLoginCredentials;
}
async function removeCredentials(accountId: string): Promise<void> { const vault = await readCredentialVault(); delete vault[accountId]; await writeFile(credentialPath(), JSON.stringify(vault)); }

async function readLicenseRecord(): Promise<LicenseRecord | null> {
  try {
    if (!existsSync(licensePath())) return null;
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = await readFile(licensePath(), "utf8");
      return JSON.parse(safeStorage.decryptString(Buffer.from(encrypted, "base64"))) as LicenseRecord;
    } else {
      return JSON.parse(await readFile(licensePath(), "utf8")) as LicenseRecord;
    }
  } catch {
    return null;
  }
}

async function writeLicenseRecord(record: LicenseRecord): Promise<void> {
  await mkdir(dirname(licensePath()), { recursive: true });
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(JSON.stringify(record)).toString("base64");
    await writeFile(licensePath(), encrypted);
  } else {
    await writeFile(licensePath(), JSON.stringify(record, null, 2));
  }
}
let saveChain: Promise<void> = Promise.resolve();
let mutationChain: Promise<unknown> = Promise.resolve();
async function readState(): Promise<AppState> {
  try {
    const value = JSON.parse(await readFile(statePath(), "utf8")) as Partial<AppState>;
    const tasks = value.tasks ?? [];
    const accounts = (value.accounts ?? []).map(account => {
      const legacyReason = account.disabledReason ?? account.loginError ?? "";
      const missingAiVideoCapability = /Không tìm thấy mục Video AI trên thanh công cụ/i.test(legacyReason);
      const wasDisabledByTransientAutomation = !missingAiVideoCapability && /ERR_ABORTED|frame was detached|Target page|context or browser has been closed|Opening in existing browser session|profile is already in use|Timeout|locator\.|Canvas|hộp cấu hình|popup|Profile chưa mở được Google Vids editor|tab Create\/Tạo không xuất hiện/i.test(legacyReason);
      return ({
      ...account,
      enabled: missingAiVideoCapability ? false : wasDisabledByTransientAutomation ? true : (typeof account.enabled === "boolean"
        ? account.enabled
        : tasks.filter(task => task.assignedAccountId === account.id).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0]?.status !== "failed"),
      disabledReason: missingAiVideoCapability
        ? "Google chưa cấp tính năng Video AI cho tài khoản này."
        : wasDisabledByTransientAutomation ? undefined : (account.disabledReason ?? (typeof account.enabled !== "boolean"
        ? tasks.filter(task => task.assignedAccountId === account.id).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0]?.error
        : undefined)),
      // Technical workflow errors from older builds must not remain as a red
      // account warning after the profile is known to be signed in.
      loginError: wasDisabledByTransientAutomation
        ? undefined
        : missingAiVideoCapability ? "Google chưa cấp tính năng Video AI cho tài khoản này." : account.loginError,
      // New/unverified profiles always start with a clean normal Chrome login.
      // Verified profiles keep the browser that owns their saved session.
      browser: account.status === "NOT_LOGGED_IN" ? "chrome" : (account.browser ?? "chrome"),
    }); });
    return { accounts, videos: value.videos ?? [], tasks, taskCounter: value.taskCounter };
  }
  catch { const legacy = join(app.getPath("userData"), "chrome-profile"); return { accounts: existsSync(legacy) ? [{ id: "legacy", name: "Tài khoản hiện tại", status: "VERIFIED_PRO", updatedAt: new Date().toISOString() }] : [], videos: [], tasks: [], taskCounter: 0 }; }
}
async function saveState(state: AppState): Promise<void> { const snapshot = JSON.stringify(state, null, 2); saveChain = saveChain.then(async () => { await mkdir(dirname(statePath()), { recursive: true }); await writeFile(statePath(), snapshot); }); return saveChain; }
function mutateState<T>(change: (state: AppState) => T | Promise<T>): Promise<T> { const operation = mutationChain.then(async () => { const state = await readState(); const result = await change(state); await saveState(state); return result; }); mutationChain = operation.then(() => undefined, () => undefined); return operation; }
function profilePath(account: Account): string { return account.id === "legacy" ? join(app.getPath("userData"), "chrome-profile") : join(app.getPath("userData"), "profiles", account.id); }
function emit(stage: string, message: string, account?: Account): void { mainWindow?.webContents.send("progress", { stage, message, accountId: account?.id, accountName: account?.name, at: new Date().toISOString() }); }
function accountService(account: Account, checkpointId?: string, progressOverride?: (stage: string, message: string) => void): GoogleVidsDesktopService {
  return new GoogleVidsDesktopService(
    profilePath(account),
    progressOverride ?? ((stage, message) => emit(stage, message, account)),
    checkpointId ? join(app.getPath("userData"), "checkpoints", `${checkpointId}.json`) : undefined,
    account.browser ?? "chrome",
  );
}
async function deleteAccountPermanently(accountId: string, reason?: string): Promise<Account | undefined> {
  runningAccounts.delete(accountId);
  const removed = await mutateState(state => {
    const account = state.accounts.find(a => a.id === accountId);
    if (!account) return undefined;
    state.accounts = state.accounts.filter(a => a.id !== accountId);
    for (const task of state.tasks.filter(t => t.status === "waiting" && t.accountPool.includes(accountId))) {
      task.accountPool = task.accountPool.filter(id => id !== accountId);
      if (!task.accountPool.length) {
        Object.assign(task, {
          status: "failed",
          error: `Tài khoản ${account.name} đã bị xóa do không đăng nhập được. Task không còn tài khoản khả dụng.`,
          updatedAt: new Date().toISOString()
        });
      }
    }
    return account;
  });
  if (!removed) return undefined;
  await removeCredentials(accountId).catch(() => undefined);
  const target = profilePath(removed);
  await rm(target, { recursive: true, force: true }).catch(() => undefined);
  if (reason) {
    emit("ACCOUNT_FAILED_DELETED", `Tài khoản ${removed.email ?? removed.name} không đăng nhập được (${reason}); đã tự động xóa khỏi hệ thống.`, removed);
  }
  mainWindow?.webContents.send("queue-updated");
  return removed;
}

async function automaticAccountLogin(accountId: string): Promise<void> {
  const snapshot = await readState();
  const account = snapshot.accounts.find(item => item.id === accountId);
  if (!account || runningAccounts.has(accountId)) return;
  runningAccounts.add(accountId);
  try {
    emit("LOGIN_START", `Bắt đầu tự động đăng nhập ${account.email ?? account.name}...`, account);
    await mutateState(state => {
      const live = state.accounts.find(item => item.id === accountId);
      if (live) Object.assign(live, { loginProgress: "Đang mở trình duyệt...", loginError: undefined, updatedAt: new Date().toISOString() });
    });
    mainWindow?.webContents.send("queue-updated");

    const credentials = await loadCredentials(accountId);

    const result = await accountService(account, undefined, (stage, message) => {
      emit(stage, message, account);
      void mutateState(state => {
        const live = state.accounts.find(item => item.id === accountId);
        if (live) Object.assign(live, { loginProgress: message, updatedAt: new Date().toISOString() });
      }).then(() => mainWindow?.webContents.send("queue-updated"));
    }).loginWithCredentials(credentials);

    await mutateState(state => {
      const live = state.accounts.find(item => item.id === accountId);
      if (live) Object.assign(live, {
        status: result.accountStatus,
        email: result.email ?? live.email,
        planEvidence: result.planEvidence,
        loginError: undefined,
        loginProgress: undefined,
        updatedAt: new Date().toISOString()
      });
    });
    emit("ACCOUNT", `Đã tự động đăng nhập và xác minh ${account.email ?? account.name}`, account);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Giữ nguyên tài khoản trong hệ thống, ghi nhận lỗi để người dùng kiểm tra hoặc mở trình duyệt
    await mutateState(state => {
      const live = state.accounts.find(item => item.id === accountId);
      if (live) {
        Object.assign(live, {
          status: "NOT_LOGGED_IN",
          loginProgress: undefined,
          loginError: message,
          updatedAt: new Date().toISOString()
        });
      }
    });
    emit("ACCOUNT_FAILED", `Tài khoản ${account.email ?? account.name} chưa đăng nhập được: ${message}`, account);
  } finally {
    runningAccounts.delete(accountId);
    mainWindow?.webContents.send("queue-updated");
  }
}
async function runStableFlow(account: Account, config: DesktopJobConfig, checkpointId: string): Promise<DesktopJobResult> {
  emit("FLOW", "Chạy luồng chuẩn: Create 10s → Extend 10s → Fill scene → Download", account);
  const progressByStage: Record<string, number> = { OPEN: 5, LOGIN: 8, NEW_PROJECT: 10, CANVAS: 15, CREATE_PANEL: 20, RESOLUTION_FALLBACK: 22, CREATE: 35, EXTEND: 60, FIT: 75, DOWNLOAD: 85, DELOGO: 92, COMPLETED: 100 };
  return accountService(account, checkpointId, (stage, message) => {
    emit(stage, message, account);
    void mutateState(state => {
      const task = state.tasks.find(item => item.id === checkpointId);
      if (task) Object.assign(task, { progress: progressByStage[stage] ?? task.progress ?? 0, progressStage: stage, progressMessage: message, updatedAt: new Date().toISOString() });
    }).then(() => mainWindow?.webContents.send("queue-updated"));
  }).run(config);
}

let scheduling = false;
async function executeQueuedTask(account: Account, task: QueueTask): Promise<void> {
  if (!/^VERIFIED_/.test(account.status) && account.hasStoredCredentials) {
    emit("LOGIN_START", `Tài khoản ${account.name} chưa đăng nhập; đang tự động đăng nhập trước khi chạy task...`, account);
    try {
      await automaticAccountLogin(account.id);
      const afterState = await readState();
      const refreshed = afterState.accounts.find(a => a.id === account.id);
      if (refreshed && /^VERIFIED_/.test(refreshed.status)) {
        account = { ...refreshed };
      }
    } catch {
      // Ignore, runStableFlow will fail and reassign properly
    }
  }
  const record: VideoRecord = { id: randomUUID(), accountId: account.id, accountName: account.name, status: "running", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await mutateState(state => { const live = state.tasks.find(t => t.id === task.id); if (live) { Object.assign(live, { videoId: record.id, progress: 1, progressStage: "QUEUED", progressMessage: "Đã nhận task, đang chuẩn bị trình duyệt" }); state.videos.unshift(record); } });
  const finalFilename = ensureUniqueOutputFilename(task.config.outputDirectory, task.config.filename, task.taskIndex ?? 1);
  const config = { ...task.config, filename: finalFilename };
  if (finalFilename !== task.config.filename) {
    await mutateState(state => {
      const live = state.tasks.find(t => t.id === task.id);
      if (live) live.config.filename = finalFilename;
    });
  }
  try {
    const result = await runStableFlow(account, config, task.id);
    await mutateState(state => { const video = state.videos.find(v => v.id === record.id); const liveTask = state.tasks.find(t => t.id === task.id); const liveAccount = state.accounts.find(a => a.id === account.id); if (video) Object.assign(video, { status: "completed", ...result, updatedAt: new Date().toISOString() }); if (liveTask) Object.assign(liveTask, { status: "completed", progress: 100, progressStage: "COMPLETED", progressMessage: "Video đã hoàn tất và lưu về máy", outputPath: result.outputPath, error: undefined, updatedAt: new Date().toISOString() }); if (liveAccount) Object.assign(liveAccount, { enabled: true, failureCount: 0, disabledReason: undefined, loginError: undefined, updatedAt: new Date().toISOString() }); });
    emit("QUEUE_DONE", `Task ${task.id.slice(0,8)} hoàn tất`, account);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const willRetry = await mutateState(state => {
      const video = state.videos.find(v => v.id === record.id);
      const liveTask = state.tasks.find(t => t.id === task.id);
      if (video) Object.assign(video, { status: "failed", error: message, updatedAt: new Date().toISOString() });
      if (/Chưa có phiên đăng nhập|hết hạn/i.test(message)) {
        const liveAccount = state.accounts.find(a => a.id === account.id);
        if (liveAccount) {
          liveAccount.status = "NOT_LOGGED_IN";
          liveAccount.loginError = "Phiên đăng nhập đã hết hạn. Vui lòng bấm Kiểm tra / Đăng nhập lại.";
          liveAccount.updatedAt = new Date().toISOString();
        }
      }
      if (!liveTask) return false;
      const attempted = [...new Set([...(liveTask.attemptedAccountIds ?? []), account.id])];
      const generationMayHaveConsumedCredits = ["CREATE", "EXTEND", "FIT", "DOWNLOAD", "DELOGO", "COMPLETED"].includes(liveTask.progressStage ?? "");
      const failedAccount = state.accounts.find(a => a.id === account.id);
      if (failedAccount) Object.assign(failedAccount, {
        enabled: false,
        failureCount: (failedAccount.failureCount ?? 0) + 1,
        disabledReason: message,
        lastFailureAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      const hasAlternative = !generationMayHaveConsumedCredits && state.accounts.some(candidate => candidate.enabled !== false && liveTask.accountPool.includes(candidate.id) && !attempted.includes(candidate.id) && /^VERIFIED_(STANDARD|PRO|ULTRA|VIDS|UNKNOWN)$/.test(candidate.status));
      Object.assign(liveTask, hasAlternative ? {
        status: "waiting", attemptedAccountIds: attempted, assignedAccountId: undefined, assignedAccountName: undefined,
        progress: 0, progressStage: "REASSIGNING", progressMessage: `${account.name} lỗi; đang chuyển sang tài khoản khác`, error: message, videoId: undefined, updatedAt: new Date().toISOString(),
      } : {
        status: "failed", attemptedAccountIds: attempted, progressStage: "FAILED", progressMessage: message, error: message, updatedAt: new Date().toISOString(),
      });
      return hasAlternative;
    });
    emit(willRetry ? "QUEUE_REASSIGN" : "QUEUE_FAILED", willRetry ? `Task ${task.id.slice(0,8)} chuyển sang tài khoản khác sau lỗi của ${account.name}` : `Task ${task.id.slice(0,8)} lỗi: ${message}`, account);
  } finally { runningAccounts.delete(account.id); mainWindow?.webContents.send("queue-updated"); void scheduleQueue(); }
}
async function scheduleQueue(): Promise<void> {
  if (scheduling) return; scheduling = true;
  try {
    const assignments = await mutateState(state => {
      const result: Array<{ account: Account; task: QueueTask }> = [];
      for (const account of state.accounts.filter(a => a.enabled !== false && /^VERIFIED_(STANDARD|PRO|ULTRA|VIDS|UNKNOWN)$/.test(a.status) && !runningAccounts.has(a.id))) {
        const task = state.tasks.slice().reverse().find(t => t.status === "waiting" && t.accountPool.includes(account.id) && !(t.attemptedAccountIds ?? []).includes(account.id));
        if (!task) continue;
        Object.assign(task, { status: "running", progress: 0, progressStage: "ASSIGNED", progressMessage: `Đã giao cho ${account.name}`, assignedAccountId: account.id, assignedAccountName: account.name, updatedAt: new Date().toISOString() }); runningAccounts.add(account.id); result.push({ account: { ...account }, task: { ...task, config: { ...task.config } } });
      }
      return result;
    });
    for (const { account, task } of assignments) { emit("QUEUE_ASSIGN", `Giao task ${task.id.slice(0,8)} cho ${account.name}`, account); void executeQueuedTask(account, task); }
    mainWindow?.webContents.send("queue-updated");
  } finally { scheduling = false; }
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1050,
    minHeight: 700,
    title: "Vids Studio - AI Video Creation",
    icon: join(here, "../../desktop/assets/ht-vids-studio-icon.png"),
    show: true,
    webPreferences: {
      preload: join(here, "../../desktop/preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
  await mainWindow.loadFile(join(here, "../../desktop/renderer/index.html"));
  mainWindow.show();
  mainWindow.focus();
}

app.whenReady().then(async () => {
  try {
    console.log("[Electron] Starting Google Vids Studio...");
    ipcMain.handle("choose-images", async () => (await dialog.showOpenDialog({ properties: ["openFile", "multiSelections"], filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }] })).filePaths);
    ipcMain.handle("choose-folder", async () => (await dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"] })).filePaths[0]);
    ipcMain.handle("default-output", async () => app.getPath("videos"));
    ipcMain.handle("accounts-list", async () => (await readState()).accounts.map(a => ({ ...a, running: runningAccounts.has(a.id) })));
    ipcMain.handle("account-toggle", async (_event, accountId: string, enabled: boolean) => {
      const account = await mutateState(state => {
        const live = state.accounts.find(a => a.id === accountId);
        if (!live) throw new Error("Không tìm thấy tài khoản.");
        if (runningAccounts.has(accountId)) throw new Error("Tài khoản đang chạy task, không thể thay đổi trạng thái.");
        Object.assign(live, {
          enabled: Boolean(enabled),
          disabledReason: enabled ? undefined : "Người dùng tạm tắt tài khoản.",
          updatedAt: new Date().toISOString(),
        });
        return { ...live };
      });
      mainWindow?.webContents.send("queue-updated");
      if (enabled) void scheduleQueue();
      return account;
    });
    ipcMain.handle("account-add", async (_event, name: string) => mutateState(state => { const account: Account = { id: randomUUID(), name: name.trim() || `Tài khoản ${state.accounts.length + 1}`, status: "NOT_LOGGED_IN", enabled: true, updatedAt: new Date().toISOString(), browser: "chrome" }; state.accounts.push(account); return account; }));
    ipcMain.handle("accounts-bulk-add", async (_event, records: Array<{ email: string; password: string; totpSecret?: string; recoveryEmail?: string }>) => {
      if (!Array.isArray(records) || !records.length) throw new Error("Danh sách tài khoản đang trống.");
      const clean = records.map(item => ({
        email: String(item.email || "").trim().toLowerCase(),
        password: String(item.password || ""),
        totpSecret: String(item.totpSecret || "").replace(/\s+/g, "") || undefined,
        recoveryEmail: String(item.recoveryEmail || "").trim().toLowerCase() || undefined
      }));
      const invalid = clean.find(item => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email) || !item.password);
      if (invalid) throw new Error(`Dòng tài khoản không hợp lệ: ${invalid.email || "thiếu email"}`);
      const unique = [...new Map(clean.map(item => [item.email, item])).values()];

      let duplicates = 0;
      const toProcess: Array<{ account: Account; credentials: typeof clean[0] }> = [];

      await mutateState(state => {
        const existingMap = new Map(state.accounts.map(a => [a.email?.toLowerCase(), a]));
        for (const item of unique) {
          const existing = existingMap.get(item.email);
          if (existing) {
            duplicates += 1;
            existing.hasStoredCredentials = true;
            existing.enabled = true;
            existing.disabledReason = undefined;
            existing.loginError = undefined;
            existing.updatedAt = new Date().toISOString();
            toProcess.push({ account: existing, credentials: item });
          } else {
            const account: Account = {
              id: randomUUID(),
              name: item.email.split("@")[0] || item.email,
              email: item.email,
              status: "NOT_LOGGED_IN",
              hasStoredCredentials: true,
              enabled: true,
              updatedAt: new Date().toISOString(),
              browser: "chrome"
            };
            state.accounts.push(account);
            toProcess.push({ account, credentials: item });
          }
        }
      });

      for (const item of toProcess) {
        await storeCredentials(item.account.id, item.credentials);
      }
      mainWindow?.webContents.send("queue-updated");

      // Đăng nhập tự động tuần tự từng tài khoản trong danh sách
      void (async () => {
        for (const item of toProcess) {
          const latestState = await readState();
          const curr = latestState.accounts.find(a => a.id === item.account.id);
          if (curr && /^VERIFIED_(STANDARD|PRO|ULTRA|VIDS|UNKNOWN)$/.test(curr.status)) {
            continue;
          }
          await automaticAccountLogin(item.account.id);
        }
      })();

      return { added: toProcess.length - duplicates, duplicates, total: toProcess.length, accounts: toProcess.map(item => item.account) };
    });
    ipcMain.handle("accounts-bulk-login", async () => {
      const state = await readState();
      const eligible = state.accounts.filter(a => a.hasStoredCredentials && !/^VERIFIED_/.test(a.status) && !runningAccounts.has(a.id));
      if (!eligible.length) {
        return { total: 0, message: "Không có tài khoản nào có sẵn thông tin cần đăng nhập tự động." };
      }
      void (async () => {
        for (const acc of eligible) {
          const currentState = await readState();
          const target = currentState.accounts.find(a => a.id === acc.id);
          if (target && !/^VERIFIED_/.test(target.status) && !runningAccounts.has(target.id)) {
            await automaticAccountLogin(target.id);
          }
        }
      })();
      return { total: eligible.length, message: `Bắt đầu tự động đăng nhập ${eligible.length} tài khoản trong nền...` };
    });
    ipcMain.handle("account-rename", async (_event, accountId: string, name: string) => {
      const cleanName = name.trim();
      if (!cleanName) throw new Error("Tên tài khoản không được để trống.");
      return mutateState(state => {
        const account = state.accounts.find(a => a.id === accountId);
        if (!account) throw new Error("Không tìm thấy tài khoản.");
        account.name = cleanName; account.updatedAt = new Date().toISOString();
        for (const task of state.tasks) if (task.assignedAccountId === accountId) task.assignedAccountName = cleanName;
        for (const video of state.videos) if (video.accountId === accountId) video.accountName = cleanName;
        return account;
      });
    });
    ipcMain.handle("account-delete", async (_event, accountId: string) => {
      const snapshot = await readState();
      const runningTask = snapshot.tasks.find(task => task.status === "running" && task.assignedAccountId === accountId);
      if (runningTask) throw new Error(`Tài khoản đang chạy task ${runningTask.id.slice(0, 8)}, không thể xóa.`);
      const removed = await deleteAccountPermanently(accountId);
      if (!removed) throw new Error("Không tìm thấy tài khoản.");
      return removed;
    });
    ipcMain.handle("account-login", async (_event, accountId: string) => {
      const state = await readState();
      const account = state.accounts.find(a => a.id === accountId);
      if (!account) throw new Error("Không tìm thấy tài khoản.");
      if (runningAccounts.has(accountId)) throw new Error("Tài khoản này đang chạy tác vụ.");

      if (account.hasStoredCredentials && !/^VERIFIED_/.test(account.status)) {
        await automaticAccountLogin(accountId);
        const afterState = await readState();
        const refreshed = afterState.accounts.find(a => a.id === accountId);
        return refreshed || account;
      }

      runningAccounts.add(accountId);
      try {
        const result = await accountService(account).loginAndVerify(account.status === "NOT_LOGGED_IN");
        await mutateState(s => {
          const live = s.accounts.find(a => a.id === accountId);
          if (live) Object.assign(live, { status: result.accountStatus, email: result.email ?? live.email, planEvidence: result.planEvidence, loginError: undefined, loginProgress: undefined, enabled: true, disabledReason: undefined, failureCount: 0, browser: account.browser, updatedAt: new Date().toISOString() });
        });
        return { ...account, status: result.accountStatus };
      }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const missingAiVideoCapability = /Không tìm thấy mục Video AI trên thanh công cụ/i.test(message);
        const transientWorkflowFailure = !missingAiVideoCapability && /ERR_ABORTED|frame was detached|Target page|context or browser has been closed|Opening in existing browser session|profile is already in use|Timeout|locator\.|Canvas|hộp cấu hình|không tìm thấy (nút|mục|ô nhập)|popup|Profile chưa mở được Google Vids editor|tab Create\/Tạo không xuất hiện/i.test(message);
        await mutateState(s => {
          const live = s.accounts.find(a => a.id === accountId);
          if (live) Object.assign(live, {
            // UI/navigation failures are retryable automation faults, not proof
            // that the Google account is unusable. Only hard account failures
            // may disable scheduling for that profile.
            enabled: transientWorkflowFailure ? true : false,
            disabledReason: transientWorkflowFailure
              ? undefined
              : missingAiVideoCapability
                ? "Google chưa cấp tính năng Video AI cho tài khoản này."
                : `Kiểm tra tài khoản thất bại: ${message}`,
            // Navigation/canvas/popup failures belong in the technical log,
            // not as a persistent red account warning. They are retryable and
            // must not make a signed-in account look unusable.
            loginError: transientWorkflowFailure
              ? undefined
              : missingAiVideoCapability
                ? "Google chưa cấp tính năng Video AI cho tài khoản này."
                : message,
            loginProgress: undefined,
            failureCount: (live.failureCount ?? 0) + 1,
            lastFailureAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        });
        throw error;
      }
      finally {
        runningAccounts.delete(accountId);
        setTimeout(() => void scheduleQueue(), 2_500);
      }
    });
    ipcMain.handle("account-open-browser", async (_event, accountId: string) => {
      const state = await readState();
      const account = state.accounts.find(a => a.id === accountId);
      if (!account) throw new Error("Không tìm thấy tài khoản.");
      if (runningAccounts.has(accountId)) throw new Error("Tài khoản này đang chạy tác vụ.");

      runningAccounts.add(accountId);
      try {
        emit("LOGIN_START", `Đang mở trình duyệt Chrome cho ${account.name}... Hãy đăng nhập rồi đóng cửa sổ.`, account);
        await mutateState(state => {
          const live = state.accounts.find(item => item.id === accountId);
          if (live) Object.assign(live, { loginProgress: "Trình duyệt đang mở... Đăng nhập xong hãy đóng cửa sổ.", loginError: undefined, updatedAt: new Date().toISOString() });
        });
        mainWindow?.webContents.send("queue-updated");

        const result = await accountService(account).loginAndVerify(true);
        await mutateState(s => {
          const live = s.accounts.find(a => a.id === accountId);
          if (live) Object.assign(live, {
            status: result.accountStatus,
            email: result.email ?? live.email,
            planEvidence: result.planEvidence,
            loginError: undefined,
            loginProgress: undefined,
            updatedAt: new Date().toISOString()
          });
        });
        emit("ACCOUNT", `Đã xác minh phiên thành công cho ${account.email ?? account.name}`, account);
        return { ...account, status: result.accountStatus };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await mutateState(s => {
          const live = s.accounts.find(a => a.id === accountId);
          if (live) Object.assign(live, {
            loginProgress: undefined,
            loginError: msg,
            updatedAt: new Date().toISOString()
          });
        });
        throw err;
      } finally {
        runningAccounts.delete(accountId);
        mainWindow?.webContents.send("queue-updated");
      }
    });
    ipcMain.handle("queue-add", async (_event, payload: { accountIds: string[]; config: DesktopJobConfig; autoStart?: boolean }) => {
      if (!payload.accountIds.length) throw new Error("Chưa chọn tài khoản cho hàng đợi.");
      const task = await mutateState(state => {
        const valid = payload.accountIds.filter(id => state.accounts.some(a => a.id === id && a.enabled !== false));
        if (!valid.length) throw new Error("Không có tài khoản đang bật và sẵn sàng nhận task.");
        const now = new Date().toISOString();
        const taskIndex = getNextTaskIndex(state);
        
        let filename = (payload.config.filename || "").trim();
        const pattern = /^task-(\d+)-(\d{8})_([a-zA-Z0-9]+)\.mp4$/i;
        if (!pattern.test(filename)) {
          filename = buildTaskFilename(taskIndex);
        } else {
          const match = filename.match(pattern);
          const reqX = match && match[1] ? parseInt(match[1], 10) : taskIndex;
          const duplicateInState = state.tasks.some(t => t.config?.filename?.toLowerCase() === filename.toLowerCase());
          if (duplicateInState) {
            filename = buildTaskFilename(reqX);
          }
        }
        payload.config.filename = filename;

        const item: QueueTask = {
          id: randomUUID(),
          taskIndex,
          status: payload.autoStart ? "waiting" : "draft",
          progress: 0,
          progressStage: payload.autoStart ? "WAITING" : "DRAFT",
          progressMessage: payload.autoStart ? "Đang chờ tài khoản rảnh" : "Bản nháp — hãy kiểm tra rồi bấm Chạy",
          accountPool: valid,
          attemptedAccountIds: [],
          config: payload.config,
          createdAt: now,
          updatedAt: now
        };
        state.tasks.unshift(item);
        return item;
      });
      mainWindow?.webContents.send("queue-updated");
      if (payload.autoStart) void scheduleQueue();
      return task;
    });
    ipcMain.handle("get-next-task-name", async () => {
      const state = await readState();
      let maxX = 0;
      for (const t of state.tasks) {
        if (typeof t.taskIndex === "number") maxX = Math.max(maxX, t.taskIndex);
        const match = t.config?.filename?.match(/^task-(\d+)-/i);
        if (match && match[1]) maxX = Math.max(maxX, parseInt(match[1], 10));
      }
      for (const v of state.videos) {
        const match = v.outputPath?.match(/task-(\d+)-/i);
        if (match && match[1]) maxX = Math.max(maxX, parseInt(match[1], 10));
      }
      const nextX = Math.max(maxX, state.taskCounter ?? 0, state.tasks.length, state.videos.length) + 1;
      return buildTaskFilename(nextX);
    });
    ipcMain.handle("queue-start", async (_event, taskId: string) => {
      const task = await mutateState(state => {
        const item = state.tasks.find(t => t.id === taskId);
        if (!item) throw new Error("Không tìm thấy task.");
        if (item.status === "running") throw new Error("Task đang chạy.");
        Object.assign(item, { status: "waiting", progress: 0, progressStage: "WAITING", progressMessage: "Đang chờ tài khoản rảnh", attemptedAccountIds: [], assignedAccountId: undefined, assignedAccountName: undefined, error: undefined, outputPath: undefined, videoId: undefined, updatedAt: new Date().toISOString() });
        return item;
      });
      mainWindow?.webContents.send("queue-updated"); void scheduleQueue(); return task;
    });
    ipcMain.handle("queue-list", async () => {
      const state = await readState();
      return state.tasks.map(task => {
        const video = task.videoId ? state.videos.find(item => item.id === task.videoId) : undefined;
        return { ...task, outputPath: task.outputPath ?? video?.outputPath, videoDuration: video?.duration, videoWidth: video?.width, videoHeight: video?.height };
      });
    });
    ipcMain.handle("queue-retry", async (_event, taskId: string) => {
      const task = await mutateState(state => {
        const item = state.tasks.find(t => t.id === taskId);
        if (!item) throw new Error("Không tìm thấy task.");
        if (item.status === "running") throw new Error("Task đang chạy.");
        Object.assign(item, {
          status: "waiting",
          progress: 0,
          progressStage: "WAITING",
          progressMessage: "Đang chờ tài khoản rảnh",
          attemptedAccountIds: [],
          outputPath: undefined,
          assignedAccountId: undefined,
          assignedAccountName: undefined,
          error: undefined,
          videoId: undefined,
          updatedAt: new Date().toISOString()
        });
        return item;
      });
      mainWindow?.webContents.send("queue-updated");
      void scheduleQueue();
      return task;
    });
    ipcMain.handle("queue-delete", async (_event, taskId: string) => {
      const removed = await mutateState(state => {
        const item = state.tasks.find(t => t.id === taskId);
        if (!item) throw new Error("Không tìm thấy task.");
        if (item.status === "running") throw new Error("Task đang chạy, không thể xóa lúc này.");
        state.tasks = state.tasks.filter(t => t.id !== taskId);
        return item;
      });
      mainWindow?.webContents.send("queue-updated");
      return removed;
    });
    ipcMain.handle("queue-update", async (_event, payload: { taskId: string; config: Partial<DesktopJobConfig>; retryNow?: boolean }) => {
      const updatedTask = await mutateState(state => {
        const item = state.tasks.find(t => t.id === payload.taskId);
        if (!item) throw new Error("Không tìm thấy task.");
        if (item.status === "running") throw new Error("Task đang chạy, không thể chỉnh sửa.");

        if (payload.config) {
          item.config = {
            ...item.config,
            ...payload.config
          };
        }

        if (payload.retryNow) {
          Object.assign(item, {
            status: "waiting",
            progress: 0,
            progressStage: "WAITING",
            progressMessage: "Đang chờ tài khoản rảnh",
            attemptedAccountIds: [],
            outputPath: undefined,
            assignedAccountId: undefined,
            assignedAccountName: undefined,
            error: undefined,
            videoId: undefined,
            updatedAt: new Date().toISOString()
          });
        } else {
          item.updatedAt = new Date().toISOString();
        }
        return item;
      });
      mainWindow?.webContents.send("queue-updated");
      if (payload.retryNow) void scheduleQueue();
      return updatedTask;
    });
    ipcMain.handle("run-jobs", async (_event, payload: { accountIds: string[]; config: DesktopJobConfig }) => {
      const results: unknown[] = [];
      for (const accountId of payload.accountIds) {
        const state = await readState();
        const account = state.accounts.find(a => a.id === accountId);
        if (!account) continue;
        try {
          const taskIndex = getNextTaskIndex(state);
          const initialFilename = payload.config.filename && /^task-\d+-\d{8}_[a-zA-Z0-9]+\.mp4$/i.test(payload.config.filename)
            ? payload.config.filename
            : buildTaskFilename(taskIndex);
          const finalFilename = ensureUniqueOutputFilename(payload.config.outputDirectory, initialFilename, taskIndex);
          const value = await runStableFlow(account, { ...payload.config, filename: finalFilename }, randomUUID());
          results.push({ accountId, ok: true, ...value });
        } catch (error) {
          results.push({ accountId, ok: false, error: error instanceof Error ? error.message : String(error) });
        }
      }
      return results;
    });
    ipcMain.handle("library-list", async () => (await readState()).videos);
    ipcMain.handle("reveal-file", async (_event, path: string) => shell.showItemInFolder(path));
    ipcMain.handle("open-file", async (_event, path: string) => shell.openPath(path));
    ipcMain.handle("open-external", async (_event, url: string) => shell.openExternal(url));
    ipcMain.handle("license-check", async () => {
      try {
        const hwid = getMachineId();
        const record = await readLicenseRecord();
        if (!record || !record.key) {
          return { licensed: false, hwid };
        }
        const checkResult = await checkLicenseOnline(record.key, hwid);
        if (checkResult.ok) {
          return {
            licensed: true,
            hwid,
            key: record.key,
            activatedAt: record.activatedAt,
            type: record.type || "LIFETIME",
            online: checkResult.online
          };
        }
        return { licensed: false, hwid, error: checkResult.error || "Bản quyền không hợp lệ." };
      } catch (err) {
        return { licensed: false, hwid: "UNKNOWN", error: (err as Error).message };
      }
    });
    ipcMain.handle("license-activate", async (_event, inputKey: string) => {
      try {
        const hwid = getMachineId();
        const actResult = await activateLicenseOnline(inputKey.trim().toUpperCase(), hwid);
        if (!actResult.ok) {
          return { ok: false, error: actResult.error || "Không thể kích hoạt mã key này.", hwid };
        }
        const record: LicenseRecord = {
          key: inputKey.trim().toUpperCase(),
          hwid,
          activatedAt: new Date().toISOString(),
          type: actResult.type || "LIFETIME"
        };
        await writeLicenseRecord(record);
        return { ok: true, hwid, record, message: actResult.message };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    });
    ipcMain.handle("license-deactivate", async () => {
      try {
        await rm(licensePath(), { force: true });
        return { ok: true };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    });
    await mutateState(state => {
      for (const task of state.tasks.filter(t => t.status === "running")) Object.assign(task, { status: "failed", error: "Ứng dụng đã đóng khi task đang chạy. Hãy kiểm tra dự án rồi bấm Chạy lại.", updatedAt: new Date().toISOString() });
      for (const account of state.accounts) {
        account.loginProgress = undefined;
      }
    });
    console.log("[Electron] Loading window...");
    await createWindow();
    console.log("[Electron] Window loaded successfully!");
    void scheduleQueue();
  } catch (err) {
    console.error("[Electron] Startup error:", err);
  }
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
