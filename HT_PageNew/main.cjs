const { app, BrowserWindow, shell, ipcMain, safeStorage, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const net = require('net');
const { spawn, execFile } = require('child_process');
const { chromium } = require('playwright-core');

let mainWindow;
let schedulerTimer = null;
let scheduledProfiles = [];
const executedScheduleKeys = new Set();
let telegramPollingTimer = null;
let telegramUpdateOffset = 0;
const pendingTelegramActions = new Map();
const activeManualBrowsers = new Map();
const activeProxyBridges = new Map();

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function closeManualBrowserForProfile(profileId) {
  const child = activeManualBrowsers.get(profileId);
  if (child && child.exitCode === null) {
    try { child.kill(); } catch (_) {}
  }
  activeManualBrowsers.delete(profileId);

  if (process.platform === 'win32') {
    const userDataDir = path.join(getProfilesBaseDir(), `profile_${profileId}`);
    const script = [
      "$target = $env:HT_PROFILE_DIR",
      "Get-CimInstance Win32_Process -Filter \"Name = 'chrome.exe'\" |",
      "Where-Object { $_.CommandLine -and $_.CommandLine.Contains('--user-data-dir=' + $target) -and -not $_.CommandLine.Contains('--remote-debugging-pipe') } |",
      "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }",
    ].join(' ');
    await new Promise((resolve) => {
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
        windowsHide: true,
        env: { ...process.env, HT_PROFILE_DIR: userDataDir },
      }, () => resolve());
    });
  }

  await wait(1800);
}

function getProfilesBaseDir() {
  return path.join(app.getPath('userData'), 'browser_profiles');
}

function getSchedulerStatePath() {
  return path.join(app.getPath('userData'), 'scheduler-state.json');
}

function getTelegramConfigPath() {
  return path.join(app.getPath('userData'), 'telegram-config.json');
}

function getTelegramLogPath() {
  return path.join(app.getPath('userData'), 'telegram-delivery-log.json');
}

function readTelegramLogs() {
  try { return JSON.parse(fs.readFileSync(getTelegramLogPath(), 'utf8')); } catch (_) { return []; }
}

function addTelegramLog(success, text, message = '') {
  const logs = readTelegramLogs();
  logs.unshift({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, timestamp: new Date().toISOString(), success, text, message });
  fs.writeFileSync(getTelegramLogPath(), JSON.stringify(logs.slice(0, 200), null, 2), 'utf8');
}

function readTelegramConfig() {
  try {
    return JSON.parse(fs.readFileSync(getTelegramConfigPath(), 'utf8'));
  } catch (_) {
    return { enabled: false, chatId: '', tokenEncrypted: '', events: { start: true, end: true, error: true } };
  }
}

function decryptTelegramToken(config) {
  if (!config?.tokenEncrypted) return '';
  try {
    const buffer = Buffer.from(config.tokenEncrypted, 'base64');
    return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(buffer) : buffer.toString('utf8');
  } catch (_) {
    return '';
  }
}

function sendTelegramMessage(text, { force = false } = {}) {
  const config = readTelegramConfig();
  const token = decryptTelegramToken(config);
  if ((!force && !config.enabled) || !token || !config.chatId) {
    return Promise.resolve({ success: false, skipped: true, message: 'Telegram chưa được bật hoặc cấu hình chưa đầy đủ.' });
  }
  return new Promise((resolve) => {
    const body = JSON.stringify({ chat_id: config.chatId, text, disable_web_page_preview: true });
    const request = https.request({
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${token}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 15000,
    }, (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const result = parsed.ok ? { success: true } : { success: false, message: parsed.description || `HTTP ${response.statusCode}` };
          addTelegramLog(result.success, text, result.message || 'Đã gửi');
          resolve(result);
        } catch (_) {
          const result = { success: false, message: `Telegram phản hồi HTTP ${response.statusCode}` };
          addTelegramLog(false, text, result.message);
          resolve(result);
        }
      });
    });
    request.on('timeout', () => { request.destroy(); addTelegramLog(false, text, 'Telegram quá thời gian phản hồi.'); resolve({ success: false, message: 'Telegram quá thời gian phản hồi.' }); });
    request.on('error', (error) => { addTelegramLog(false, text, error.message); resolve({ success: false, message: error.message }); });
    request.end(body);
  });
}

function discoverTelegramChats(tokenOverride = '') {
  const config = readTelegramConfig();
  const token = String(tokenOverride || '').trim() || decryptTelegramToken(config);
  if (!token) return Promise.resolve({ success: false, message: 'Chưa có Bot Token.' });
  return new Promise((resolve) => {
    const request = https.request({
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${token}/getUpdates?limit=100&timeout=0`,
      method: 'GET',
      timeout: 15000,
    }, (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (!parsed.ok) return resolve({ success: false, message: parsed.description || 'Telegram từ chối yêu cầu.' });
          const chatsById = new Map();
          for (const update of parsed.result || []) {
            const chat = update.message?.chat || update.edited_message?.chat || update.channel_post?.chat || update.my_chat_member?.chat;
            if (!chat) continue;
            chatsById.set(String(chat.id), {
              id: String(chat.id),
              type: chat.type || 'unknown',
              name: chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.username || String(chat.id),
            });
          }
          resolve({ success: true, chats: Array.from(chatsById.values()) });
        } catch (_) {
          resolve({ success: false, message: `Telegram phản hồi không hợp lệ (HTTP ${response.statusCode}).` });
        }
      });
    });
    request.on('timeout', () => { request.destroy(); resolve({ success: false, message: 'Telegram quá thời gian phản hồi.' }); });
    request.on('error', (error) => resolve({ success: false, message: error.message }));
    request.end();
  });
}

function callTelegramApi(method, payload = {}) {
  const config = readTelegramConfig();
  const token = decryptTelegramToken(config);
  if (!token) return Promise.resolve({ success: false, message: 'Chưa có Bot Token.' });
  return new Promise((resolve) => {
    const body = JSON.stringify(payload);
    const request = https.request({ hostname: 'api.telegram.org', port: 443, path: `/bot${token}/${method}`, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 15000 }, (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.ok ? { success: true, result: parsed.result } : { success: false, message: parsed.description || `HTTP ${response.statusCode}` });
        } catch (_) { resolve({ success: false, message: `HTTP ${response.statusCode}` }); }
      });
    });
    request.on('timeout', () => { request.destroy(); resolve({ success: false, message: 'Telegram timeout.' }); });
    request.on('error', (error) => resolve({ success: false, message: error.message }));
    request.end(body);
  });
}

function getTelegramCommandResponse(command) {
  const profiles = scheduledProfiles || [];
  const allPages = profiles.flatMap((profile) => (profile.managedPages || []).filter((page) => page && typeof page === 'object').map((page) => ({ ...page, profileName: profile.name })));
  const scheduledPages = allPages.filter((page) => page.scheduleEnabled);
  const proxyProfiles = profiles.filter((profile) => Boolean(profile.proxy));
  const uniqueProxyCount = new Set(proxyProfiles.map((profile) => {
    const parsed = parseProxy(profile.proxy);
    return parsed ? `${parsed.ip}:${parsed.port}` : profile.proxy;
  })).size;
  const running = Array.from(activeRunningSessions.values()).filter((session) => session.isRunning);
  if (command === '/tongquan' || command === '/status') {
    return `📊 HT PageNew - Tổng quan\nHồ sơ: ${profiles.length}\nHồ sơ đang bật: ${profiles.filter((profile) => profile.status).length}\nFanpage: ${allPages.length}\nLịch Page đang bật: ${scheduledPages.length}\nProxy riêng biệt: ${uniqueProxyCount}\nHồ sơ có proxy: ${proxyProfiles.length}\nPhiên đang chạy: ${running.length}`;
  }
  if (command === '/lich') {
    if (!scheduledPages.length) return '🗓 Chưa có lịch Fanpage nào đang bật.';
    return `🗓 Lịch Fanpage hằng ngày\n${scheduledPages.map((page) => `• ${page.profileName} / ${page.name}: ${page.startTime} → ${page.endTime}`).join('\n')}`;
  }
  if (command === '/hoso') {
    if (!profiles.length) return '👤 Chưa có hồ sơ nào.';
    return `👤 Hồ sơ & Fanpage\n${profiles.map((profile) => `• ${profile.name}: ${(profile.managedPages || []).length} Fanpage · ${profile.status ? 'Đang bật' : 'Đang tắt'}`).join('\n')}`;
  }
  if (command === '/fanpage') {
    if (!allPages.length) return '📄 Chưa có Fanpage nào được cấu hình.';
    return `📄 Danh sách Fanpage\n${profiles.flatMap((profile, profileIndex) => (profile.managedPages || []).filter((page) => page && typeof page === 'object').map((page, pageIndex) => `• Hồ sơ ${profileIndex + 1} (${profile.name}) · Page ${pageIndex + 1}: ${page.name}`)).join('\n')}`;
  }
  if (command === '/dangchay') {
    if (!running.length) return '⏸ Hiện không có phiên nào đang chạy.';
    return `▶️ Phiên đang chạy\n${running.map((session) => `• ${session.profileName}: ${session.pageName} · ${session.currentSection || 'Feed'}`).join('\n')}`;
  }
  return '🤖 HT PageNew\n/menu - Mở bảng điều khiển nút bấm\n/chay_page - Chọn hồ sơ, Page và thời lượng\n/them_lich - Chọn Page và đặt giờ IN/OUT\n/them_page - Chọn hồ sơ rồi nhập Page mới\n/fanpage - Danh sách Fanpage\n/lich - Lịch Fanpage\n/dangchay - Phiên đang chạy\n\nBạn chỉ cần bấm nút; không cần nhớ tên Page.';
}

function findTelegramProfile(value) {
  const needle = String(value || '').trim().toLocaleLowerCase();
  const byIndex = Number(needle);
  if (Number.isInteger(byIndex) && byIndex >= 1 && byIndex <= scheduledProfiles.length) return scheduledProfiles[byIndex - 1];
  return scheduledProfiles.find((profile) => String(profile.id).toLocaleLowerCase() === needle || String(profile.name).trim().toLocaleLowerCase() === needle);
}

function findTelegramPage(profile, value) {
  const pages = (profile?.managedPages || []).filter((page) => page && typeof page === 'object');
  const needle = String(value || '').trim().toLocaleLowerCase();
  const byIndex = Number(needle);
  if (Number.isInteger(byIndex) && byIndex >= 1 && byIndex <= pages.length) return pages[byIndex - 1];
  return pages.find((page) => String(page.id).toLocaleLowerCase() === needle || String(page.name).trim().toLocaleLowerCase() === needle);
}

function isValidFacebookPageUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return ['facebook.com', 'www.facebook.com', 'm.facebook.com'].includes(url.hostname.toLocaleLowerCase());
  } catch (_) { return false; }
}

function isValidScheduleTime(value) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(value || '').trim());
}

function telegramButton(text, callbackData) {
  return { text, callback_data: callbackData };
}

async function sendTelegramUi(chatId, text, rows) {
  return callTelegramApi('sendMessage', {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    reply_markup: { inline_keyboard: rows },
  });
}

function telegramMainMenuRows() {
  return [
    [telegramButton('▶️ Chạy Fanpage', 'menu:run'), telegramButton('🗓 Thêm lịch', 'menu:schedule')],
    [telegramButton('➕ Thêm Fanpage', 'menu:add'), telegramButton('⏹ Dừng phiên', 'menu:stop')],
    [telegramButton('📄 Danh sách Page', 'menu:list'), telegramButton('📊 Đang chạy', 'menu:running')],
  ];
}

function telegramProfileRows(prefix) {
  const rows = scheduledProfiles.map((profile, index) => [telegramButton(`${profile.status ? '🟢' : '⚪'} ${profile.name}`, `${prefix}:${index}`)]);
  rows.push([telegramButton('↩️ Menu chính', 'menu:home')]);
  return rows;
}

function telegramPageRows(profileIndex, prefix) {
  const profile = scheduledProfiles[profileIndex];
  const pages = (profile?.managedPages || []).filter((page) => page && typeof page === 'object');
  const rows = pages.map((page, pageIndex) => [telegramButton(`☐ ${page.name}`, `${prefix}:${profileIndex}:${pageIndex}`)]);
  rows.push([telegramButton('↩️ Chọn hồ sơ khác', prefix.startsWith('r') ? 'menu:run' : 'menu:schedule')]);
  return rows;
}

function addMinutesToTime(time, minutes) {
  const [hour, minute] = String(time).split(':').map(Number);
  const total = (hour * 60 + minute + minutes) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

async function handleTelegramCallback(query) {
  const chatId = query.message?.chat?.id;
  const data = String(query.data || '');
  await callTelegramApi('answerCallbackQuery', { callback_query_id: query.id });
  if (!chatId) return;
  if (data === 'menu:home') return sendTelegramUi(chatId, '🤖 HT PageNew — Chọn thao tác:', telegramMainMenuRows());
  if (data === 'menu:run') return sendTelegramUi(chatId, '1️⃣ Chọn hồ sơ sẽ chạy:', telegramProfileRows('rp'));
  if (data === 'menu:schedule') return sendTelegramUi(chatId, '1️⃣ Chọn hồ sơ cần thêm lịch:', telegramProfileRows('sp'));
  if (data === 'menu:add') return sendTelegramUi(chatId, '1️⃣ Chọn hồ sơ sẽ thêm Fanpage:', telegramProfileRows('ap'));
  if (data === 'menu:list') return sendTelegramUi(chatId, getTelegramCommandResponse('/fanpage'), telegramMainMenuRows());
  if (data === 'menu:running') return sendTelegramUi(chatId, getTelegramCommandResponse('/dangchay'), telegramMainMenuRows());
  if (data === 'menu:stop') {
    const rows = scheduledProfiles.map((profile, index) => {
      const running = activeRunningSessions.get(profile.id)?.isRunning;
      return running ? [telegramButton(`⏹ ${profile.name}`, `stop:${index}`)] : null;
    }).filter(Boolean);
    rows.push([telegramButton('↩️ Menu chính', 'menu:home')]);
    return sendTelegramUi(chatId, rows.length > 1 ? 'Chọn hồ sơ cần dừng:' : 'Không có phiên nào đang chạy.', rows);
  }

  const values = data.split(':');
  const profileIndex = Number(values[1]);
  const pageIndex = Number(values[2]);
  const profile = scheduledProfiles[profileIndex];
  const pages = (profile?.managedPages || []).filter((page) => page && typeof page === 'object');
  const page = pages[pageIndex];
  if (values[0] === 'rp') {
    if (!profile) return sendTelegramUi(chatId, 'Hồ sơ không còn tồn tại.', telegramMainMenuRows());
    if (!pages.length) {
      return sendTelegramUi(chatId, `Hồ sơ ${profile.name} chưa có Fanpage.\n✅ Hệ thống sẽ chạy bằng Trang cá nhân.\n\nChọn thời lượng:`, [
        [5, 10, 15].map((minutes) => telegramButton(`${minutes} phút`, `rpersonal:${profileIndex}:${minutes}`)),
        [30, 60, 120].map((minutes) => telegramButton(`${minutes} phút`, `rpersonal:${profileIndex}:${minutes}`)),
        [telegramButton('↩️ Chọn hồ sơ khác', 'menu:run')],
      ]);
    }
    return sendTelegramUi(chatId, `2️⃣ Hồ sơ: ${profile.name}\nTick chọn Fanpage:`, telegramPageRows(profileIndex, 'rpage'));
  }
  if (values[0] === 'sp') return sendTelegramUi(chatId, `2️⃣ Hồ sơ: ${profile?.name || '-'}\nTick chọn Fanpage đặt lịch:`, telegramPageRows(profileIndex, 'spage'));
  if (values[0] === 'ap') {
    if (!profile) return sendTelegramUi(chatId, 'Hồ sơ không còn tồn tại.', telegramMainMenuRows());
    pendingTelegramActions.set(String(chatId), { type: 'await-page-input', profileKey: profile.id });
    return sendTelegramUi(chatId, `Đã chọn hồ sơ: ${profile.name}\n\nGửi một tin nhắn duy nhất theo dạng:\nTên Fanpage | Link Facebook\n\nVí dụ: Con em Media | https://www.facebook.com/conemmedia`, [[telegramButton('❌ Hủy', 'cancel')]]);
  }
  if (values[0] === 'rpage') {
    if (!profile || !page) return sendTelegramUi(chatId, 'Page không còn tồn tại.', telegramMainMenuRows());
    return sendTelegramUi(chatId, `✅ Đã chọn: ${page.name}\n3️⃣ Chọn thời lượng chạy:`, [
      [5, 10, 15].map((minutes) => telegramButton(`${minutes} phút`, `rdur:${profileIndex}:${pageIndex}:${minutes}`)),
      [30, 60, 120].map((minutes) => telegramButton(`${minutes} phút`, `rdur:${profileIndex}:${pageIndex}:${minutes}`)),
      [telegramButton('↩️ Chọn Page khác', `rp:${profileIndex}`)],
    ]);
  }
  if (values[0] === 'rdur') {
    const durationMinutes = Number(values[3]);
    if (!profile || !page) return sendTelegramUi(chatId, 'Page không còn tồn tại.', telegramMainMenuRows());
    pendingTelegramActions.set(String(chatId), { type: 'run-page', profileKey: profile.id, pageKey: page.id, durationMinutes });
    return sendTelegramUi(chatId, `⚠️ Xác nhận chạy\nHồ sơ: ${profile.name}\nPage: ${page.name}\nThời lượng: ${durationMinutes} phút`, [[telegramButton('✅ Chạy ngay', 'confirm'), telegramButton('❌ Hủy', 'cancel')]]);
  }
  if (values[0] === 'rpersonal') {
    const durationMinutes = Number(values[2]);
    if (!profile) return sendTelegramUi(chatId, 'Hồ sơ không còn tồn tại.', telegramMainMenuRows());
    pendingTelegramActions.set(String(chatId), { type: 'run-personal', profileKey: profile.id, durationMinutes });
    return sendTelegramUi(chatId, `⚠️ Xác nhận chạy\nHồ sơ: ${profile.name}\nDanh tính: Trang cá nhân\nThời lượng: ${durationMinutes} phút`, [[telegramButton('✅ Chạy ngay', 'confirm'), telegramButton('❌ Hủy', 'cancel')]]);
  }
  if (values[0] === 'spage') {
    if (!profile || !page) return sendTelegramUi(chatId, 'Page không còn tồn tại.', telegramMainMenuRows());
    const hourRows = [];
    for (let hour = 0; hour < 24; hour += 4) hourRows.push([0, 1, 2, 3].map((offset) => telegramButton(`${String(hour + offset).padStart(2, '0')} giờ`, `sh:${profileIndex}:${pageIndex}:${hour + offset}`)));
    hourRows.push([telegramButton('↩️ Chọn Page khác', `sp:${profileIndex}`)]);
    return sendTelegramUi(chatId, `✅ Đã chọn: ${page.name}\n3️⃣ Chọn giờ IN:`, hourRows);
  }
  if (values[0] === 'sh') {
    const hour = Number(values[3]);
    return sendTelegramUi(chatId, `Giờ IN: ${String(hour).padStart(2, '0')}:__\n4️⃣ Chọn phút:`, [[0, 15, 30, 45].map((minute) => telegramButton(String(minute).padStart(2, '0'), `sm:${profileIndex}:${pageIndex}:${hour}:${minute}`))]);
  }
  if (values[0] === 'sm') {
    const startTime = `${String(values[3]).padStart(2, '0')}:${String(values[4]).padStart(2, '0')}`;
    return sendTelegramUi(chatId, `IN ${startTime}\n5️⃣ Chọn thời lượng để tính giờ OUT:`, [
      [5, 10, 15].map((minutes) => telegramButton(`${minutes} phút`, `sdur:${profileIndex}:${pageIndex}:${values[3]}:${values[4]}:${minutes}`)),
      [30, 60, 120].map((minutes) => telegramButton(`${minutes} phút`, `sdur:${profileIndex}:${pageIndex}:${values[3]}:${values[4]}:${minutes}`)),
    ]);
  }
  if (values[0] === 'sdur') {
    const startTime = `${String(values[3]).padStart(2, '0')}:${String(values[4]).padStart(2, '0')}`;
    const endTime = addMinutesToTime(startTime, Number(values[5]));
    if (!profile || !page) return sendTelegramUi(chatId, 'Page không còn tồn tại.', telegramMainMenuRows());
    pendingTelegramActions.set(String(chatId), { type: 'add-schedule', profileKey: profile.id, pageKey: page.id, startTime, endTime });
    return sendTelegramUi(chatId, `⚠️ Xác nhận lịch hằng ngày\nHồ sơ: ${profile.name}\nPage: ${page.name}\nIN ${startTime} → OUT ${endTime}`, [[telegramButton('✅ Lưu lịch', 'confirm'), telegramButton('❌ Hủy', 'cancel')]]);
  }
  if (data === 'confirm') {
    const pending = pendingTelegramActions.get(String(chatId));
    if (!pending || pending.type === 'await-page-input') return sendTelegramUi(chatId, 'Không có thao tác sẵn sàng xác nhận.', telegramMainMenuRows());
    pendingTelegramActions.delete(String(chatId));
    return sendTelegramUi(chatId, await executeTelegramAction(pending), telegramMainMenuRows());
  }
  if (data === 'cancel') {
    pendingTelegramActions.delete(String(chatId));
    return sendTelegramUi(chatId, '🗑 Đã hủy thao tác.', telegramMainMenuRows());
  }
  if (values[0] === 'stop') {
    if (!profile) return sendTelegramUi(chatId, 'Hồ sơ không còn tồn tại.', telegramMainMenuRows());
    const result = stopSingleProfileSession(profile.id);
    return sendTelegramUi(chatId, result.success ? `⏹ Đã yêu cầu dừng ${profile.name}.` : result.message, telegramMainMenuRows());
  }
}

function publishTelegramProfilesUpdate() {
  saveSchedulerProfiles(scheduledProfiles);
  notifyRenderer('telegram-profiles-updated', { profiles: scheduledProfiles });
}

async function executeTelegramAction(action) {
  const profile = findTelegramProfile(action.profileKey);
  if (!profile) return '❌ Không còn tìm thấy hồ sơ đã chọn.';
  if (action.type === 'add-page') {
    const duplicate = (profile.managedPages || []).some((page) => page && typeof page === 'object' && (page.name.toLocaleLowerCase() === action.pageName.toLocaleLowerCase() || page.url === action.pageUrl));
    if (duplicate) return `⚠️ Page "${action.pageName}" đã tồn tại trong hồ sơ ${profile.name}.`;
    profile.managedPages = [...(profile.managedPages || []), {
      id: `page-${Date.now()}`,
      name: action.pageName,
      url: action.pageUrl,
      enabled: true,
      scheduleEnabled: false,
      startTime: '08:30',
      endTime: '09:00',
    }];
    publishTelegramProfilesUpdate();
    return `✅ Đã thêm Page "${action.pageName}" vào hồ sơ ${profile.name}.`;
  }
  if (action.type === 'run-personal') {
    if (activeRunningSessions.get(profile.id)?.isRunning) return `⚠️ Hồ sơ ${profile.name} đang có một phiên hoạt động. Hãy dừng phiên trước.`;
    const result = await startSingleProfileSession({ ...profile, runAsPersonal: true }, action.durationMinutes);
    return result.success
      ? `▶️ Đã bắt đầu chạy ${profile.name} bằng Trang cá nhân trong ${action.durationMinutes} phút.`
      : `❌ Không thể chạy Trang cá nhân: ${result.reason || result.message || 'Không rõ lỗi'}`;
  }
  const page = findTelegramPage(profile, action.pageKey);
  if (!page) return `❌ Không tìm thấy Page "${action.pageKey}" trong hồ sơ ${profile.name}.`;
  if (action.type === 'add-schedule') {
    page.scheduleEnabled = true;
    page.enabled = true;
    page.startTime = action.startTime;
    page.endTime = action.endTime;
    publishTelegramProfilesUpdate();
    return `✅ Đã bật lịch hằng ngày: ${profile.name} / ${page.name}\nIN ${page.startTime} → OUT ${page.endTime}.`;
  }
  if (action.type === 'run-page') {
    if (activeRunningSessions.get(profile.id)?.isRunning) return `⚠️ Hồ sơ ${profile.name} đang có một phiên hoạt động. Hãy dừng phiên trước.`;
    const runProfile = { ...profile, runAsPersonal: false, pageName: page.name, pageUrl: page.url, managedPages: [{ ...page, enabled: true }], pageRotationMode: 'fixed', pageRotationIndex: 0 };
    const result = await startSingleProfileSession(runProfile, action.durationMinutes);
    return result.success
      ? `▶️ Đã bắt đầu chạy ${profile.name} / ${page.name} trong ${action.durationMinutes} phút.`
      : `❌ Không thể chạy ${page.name}: ${result.reason || result.message || 'Không rõ lỗi'}`;
  }
  return '❌ Thao tác không hợp lệ.';
}

async function handleTelegramCommand(text, chatId) {
  const parts = String(text || '').trim().split('|').map((part) => part.trim());
  const first = parts[0].split(/\s+/);
  const command = first.shift().split('@')[0].toLowerCase();
  const firstArgument = first.join(' ').trim();
  if (command === '/huy') {
    pendingTelegramActions.delete(String(chatId));
    return '🗑 Đã hủy thao tác đang chờ.';
  }
  if (command === '/xacnhan') {
    const pending = pendingTelegramActions.get(String(chatId));
    if (!pending) return 'ℹ️ Không có thao tác nào đang chờ xác nhận.';
    pendingTelegramActions.delete(String(chatId));
    return executeTelegramAction(pending);
  }
  if (command === '/dung') {
    const profile = findTelegramProfile(firstArgument || parts[1]);
    if (!profile) return '❌ Không tìm thấy hồ sơ. Dùng /hoso để xem danh sách.';
    const result = stopSingleProfileSession(profile.id);
    return result.success ? `⏹ Đã yêu cầu dừng hồ sơ ${profile.name}.` : `ℹ️ ${result.message}`;
  }
  if (command === '/them_page') {
    const profile = findTelegramProfile(firstArgument);
    const pageName = parts[1];
    const pageUrl = parts[2];
    if (!profile || !pageName || !isValidFacebookPageUrl(pageUrl)) return '❌ Cú pháp: /them_page HồSơ | Tên Page | Link Facebook';
    pendingTelegramActions.set(String(chatId), { type: 'add-page', profileKey: profile.id, pageName, pageUrl });
    return `⚠️ Xác nhận thêm Page\nHồ sơ: ${profile.name}\nPage: ${pageName}\nLink: ${pageUrl}\n\nGửi /xacnhan để lưu hoặc /huy để hủy.`;
  }
  if (command === '/chay_page') {
    const profile = findTelegramProfile(firstArgument);
    const page = findTelegramPage(profile, parts[1]);
    const durationMinutes = Math.max(1, Math.min(1440, Number(parts[2]) || 30));
    if (!profile || !page) return '❌ Cú pháp: /chay_page HồSơ | Tên hoặc số Page | Số phút';
    pendingTelegramActions.set(String(chatId), { type: 'run-page', profileKey: profile.id, pageKey: page.id, durationMinutes });
    return `⚠️ Xác nhận chạy Page\nHồ sơ: ${profile.name}\nPage: ${page.name}\nThời lượng: ${durationMinutes} phút\n\nGửi /xacnhan để chạy hoặc /huy để hủy.`;
  }
  if (command === '/them_lich') {
    const profile = findTelegramProfile(firstArgument);
    const page = findTelegramPage(profile, parts[1]);
    const startTime = parts[2];
    const endTime = parts[3];
    if (!profile || !page || !isValidScheduleTime(startTime) || !isValidScheduleTime(endTime)) return '❌ Cú pháp: /them_lich HồSơ | Tên hoặc số Page | HH:MM | HH:MM';
    pendingTelegramActions.set(String(chatId), { type: 'add-schedule', profileKey: profile.id, pageKey: page.id, startTime, endTime });
    return `⚠️ Xác nhận lịch hằng ngày\nHồ sơ: ${profile.name}\nPage: ${page.name}\nIN ${startTime} → OUT ${endTime}\n\nGửi /xacnhan để lưu hoặc /huy để hủy.`;
  }
  return getTelegramCommandResponse(command);
}

async function registerTelegramCommands() {
  const config = readTelegramConfig();
  if (!config.enabled || !decryptTelegramToken(config)) return;
  await callTelegramApi('setMyCommands', { commands: [
    { command: 'menu', description: 'Mở bảng điều khiển nút bấm' },
    { command: 'tongquan', description: 'Tổng quan hệ thống' },
    { command: 'lich', description: 'Xem lịch Fanpage' },
    { command: 'hoso', description: 'Hồ sơ và Fanpage' },
    { command: 'fanpage', description: 'Danh sách Fanpage' },
    { command: 'them_page', description: 'Thêm Fanpage vào hồ sơ' },
    { command: 'chay_page', description: 'Chạy một Fanpage' },
    { command: 'them_lich', description: 'Thêm lịch cho Fanpage' },
    { command: 'dung', description: 'Dừng phiên của hồ sơ' },
    { command: 'xacnhan', description: 'Xác nhận thao tác đang chờ' },
    { command: 'huy', description: 'Hủy thao tác đang chờ' },
    { command: 'dangchay', description: 'Phiên đang chạy' },
    { command: 'trogiup', description: 'Danh sách lệnh' },
  ] });
}

async function pollTelegramCommands() {
  const config = readTelegramConfig();
  if (!config.enabled || !config.chatId || !decryptTelegramToken(config)) return;
  const response = await callTelegramApi('getUpdates', { offset: telegramUpdateOffset, limit: 20, timeout: 0, allowed_updates: ['message', 'callback_query'] });
  if (!response.success) return;
  for (const update of response.result || []) {
    telegramUpdateOffset = Math.max(telegramUpdateOffset, Number(update.update_id) + 1);
    const callback = update.callback_query;
    if (callback) {
      if (String(callback.message?.chat?.id) === String(config.chatId)) await handleTelegramCallback(callback);
      continue;
    }
    const message = update.message;
    if (!message?.text || String(message.chat?.id) !== String(config.chatId)) continue;
    const pending = pendingTelegramActions.get(String(message.chat.id));
    if (!message.text.startsWith('/') && pending?.type === 'await-page-input') {
      const [pageName, pageUrl] = message.text.split('|').map((part) => part.trim());
      if (!pageName || !isValidFacebookPageUrl(pageUrl)) {
        await sendTelegramUi(message.chat.id, '❌ Chưa đúng định dạng. Hãy gửi:\nTên Fanpage | Link Facebook', [[telegramButton('❌ Hủy', 'cancel')]]);
        continue;
      }
      pendingTelegramActions.set(String(message.chat.id), { type: 'add-page', profileKey: pending.profileKey, pageName, pageUrl });
      const profile = findTelegramProfile(pending.profileKey);
      await sendTelegramUi(message.chat.id, `⚠️ Xác nhận thêm Page\nHồ sơ: ${profile?.name || '-'}\nPage: ${pageName}\nLink: ${pageUrl}`, [[telegramButton('✅ Lưu Page', 'confirm'), telegramButton('❌ Hủy', 'cancel')]]);
      continue;
    }
    if (!message.text.startsWith('/')) continue;
    const command = message.text.trim().split(/\s+/)[0].split('@')[0].toLowerCase();
    if (['/start', '/menu'].includes(command)) {
      await sendTelegramUi(message.chat.id, '🤖 HT PageNew — Chọn thao tác:', telegramMainMenuRows());
    } else if (command === '/chay_page' && !message.text.includes('|')) {
      await sendTelegramUi(message.chat.id, '1️⃣ Chọn hồ sơ sẽ chạy:', telegramProfileRows('rp'));
    } else if (command === '/them_lich' && !message.text.includes('|')) {
      await sendTelegramUi(message.chat.id, '1️⃣ Chọn hồ sơ cần thêm lịch:', telegramProfileRows('sp'));
    } else if (command === '/them_page' && !message.text.includes('|')) {
      await sendTelegramUi(message.chat.id, '1️⃣ Chọn hồ sơ sẽ thêm Fanpage:', telegramProfileRows('ap'));
    } else {
      await sendTelegramMessage(await handleTelegramCommand(message.text, message.chat.id), { force: true });
    }
  }
}

function startTelegramCommandPolling() {
  if (telegramPollingTimer) clearInterval(telegramPollingTimer);
  registerTelegramCommands().catch(() => {});
  pollTelegramCommands().catch(() => {});
  telegramPollingTimer = setInterval(() => pollTelegramCommands().catch(() => {}), 5000);
}

function sendTelegramEvent(eventName, text) {
  const config = readTelegramConfig();
  if (!config.enabled || config.events?.[eventName] === false) return;
  sendTelegramMessage(text).catch(() => {});
}

function saveSchedulerProfiles(profiles) {
  scheduledProfiles = Array.isArray(profiles) ? profiles : [];
  fs.writeFileSync(getSchedulerStatePath(), JSON.stringify(scheduledProfiles, null, 2), 'utf8');
}

function loadSchedulerProfiles() {
  try {
    scheduledProfiles = JSON.parse(fs.readFileSync(getSchedulerStatePath(), 'utf8'));
    if (!Array.isArray(scheduledProfiles)) scheduledProfiles = [];
  } catch (_) {
    scheduledProfiles = [];
  }
}

function notifyRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
  if (channel === 'session-alert') {
    sendTelegramEvent('error', `⚠️ HT PageNew\nHồ sơ: ${payload.profileId || '-'}\nSự cố: ${payload.reason || payload.errorType || 'Không rõ'}`);
  } else if (channel === 'session-ended' && !payload.session?.errorType) {
    sendTelegramEvent('end', `✅ HT PageNew - Đã kết thúc\nHồ sơ: ${payload.session?.profileName || payload.profileId || '-'}\nDanh tính: ${payload.session?.pageName || '-'}\nThời lượng: ${payload.session?.audit?.actualDurationStr || '-'}`);
  }
}

function writeAutomationDiagnostic(profileId, event, details = {}) {
  try {
    const safeDetails = Object.fromEntries(Object.entries(details).filter(([key]) => !/cookie|password|token|proxy/i.test(key)));
    const line = JSON.stringify({ time: new Date().toISOString(), profileId, event, ...safeDetails });
    fs.appendFileSync(path.join(app.getPath('userData'), 'automation-diagnostics.log'), `${line}\n`, 'utf8');
  } catch (_) {}
}

function getTimeWindowMinutes(startTime, endTime) {
  const [startHour, startMinute] = String(startTime || '00:00').split(':').map(Number);
  const [endHour, endMinute] = String(endTime || '00:00').split(':').map(Number);
  let minutes = endHour * 60 + endMinute - (startHour * 60 + startMinute);
  if (minutes <= 0) minutes += 24 * 60;
  return Math.max(1, Math.min(1440, minutes));
}

function getScheduleMatch(now, startTime, graceMinutes = 2) {
  const [hour, minute] = String(startTime || '').split(':').map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  const scheduled = new Date(now);
  scheduled.setHours(hour, minute, 0, 0);
  const lateByMinutes = Math.floor((now.getTime() - scheduled.getTime()) / 60000);
  if (lateByMinutes < 0 || lateByMinutes > graceMinutes) return null;
  const hhmm = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  return `${scheduled.getFullYear()}-${String(scheduled.getMonth() + 1).padStart(2, '0')}-${String(scheduled.getDate()).padStart(2, '0')}T${hhmm}`;
}

async function schedulerTick(now = new Date()) {
  const day = now.getDay();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const runKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${hhmm}`;

  for (const profile of scheduledProfiles) {
    if (!profile.status) continue;
    const pageSchedules = (profile.managedPages || []).filter((page) => (
      page && typeof page === 'object' && page.enabled !== false && page.scheduleEnabled && getScheduleMatch(now, page.startTime)
    ));
    if (pageSchedules.length) {
      for (const managedPage of pageSchedules) {
        const pageRunKey = getScheduleMatch(now, managedPage.startTime);
        const executionKey = `${profile.id}:${managedPage.id || managedPage.name}:${pageRunKey}`;
        if (managedPage.lastScheduledRunKey === pageRunKey || executedScheduleKeys.has(executionKey)) continue;
        managedPage.lastScheduledRunKey = pageRunKey;
        executedScheduleKeys.add(executionKey);
        saveSchedulerProfiles(scheduledProfiles);
        const durationMinutes = getTimeWindowMinutes(managedPage.startTime, managedPage.endTime);
        const runProfile = {
          ...profile,
          pageName: managedPage.name,
          pageUrl: managedPage.url,
          managedPages: [{ ...managedPage }],
          pageRotationMode: 'fixed',
        };
        const result = activeRunningSessions.get(profile.id)?.isRunning
          ? {
              success: false,
              errorType: 'schedule_conflict',
              reason: `Bỏ qua Page "${managedPage.name}" vì một Page khác trong cùng hồ sơ đang chạy. Hãy chỉnh lại giờ IN/OUT để không trùng nhau.`,
            }
          : await startSingleProfileSession(runProfile, durationMinutes);
        notifyRenderer('scheduled-session-result', {
          profileId: profile.id,
          pageId: managedPage.id,
          runKey: pageRunKey,
          result,
        });
        sendTelegramEvent(result.success ? 'start' : 'error', result.success
          ? `▶️ HT PageNew - Bắt đầu theo lịch\nHồ sơ: ${profile.name}\nDanh tính: ${managedPage.name}\nThời lượng: ${durationMinutes} phút`
          : `⚠️ HT PageNew - Lịch chạy thất bại\nHồ sơ: ${profile.name}\nDanh tính: ${managedPage.name}\nLý do: ${result.reason || result.message || 'Không rõ'}`);
      }
      continue;
    }

    const cfg = profile.scheduleConfig;
    if (!cfg?.scheduleEnabled || cfg.startTime !== hhmm || !(cfg.daysOfWeek || []).includes(day)) continue;
    if (cfg.lastScheduledRunKey === runKey) continue;

    cfg.lastScheduledRunKey = runKey;
    cfg.lastRunTime = now.toISOString();
    saveSchedulerProfiles(scheduledProfiles);
    const result = await startSingleProfileSession(profile, Number(cfg.durationMinutes) || 30);
    if (result.success && result.sessionInfo) {
      profile.pageName = result.sessionInfo.pageName;
      profile.pageUrl = result.sessionInfo.pageUrl;
      profile.pageRotationIndex = result.sessionInfo.pageRotationIndex;
      saveSchedulerProfiles(scheduledProfiles);
    }
    notifyRenderer('scheduled-session-result', { profileId: profile.id, runKey, result });
    sendTelegramEvent(result.success ? 'start' : 'error', result.success
      ? `▶️ HT PageNew - Bắt đầu theo lịch\nHồ sơ: ${profile.name}\nDanh tính: ${result.sessionInfo?.pageName || profile.pageName || '-'}\nThời lượng: ${Number(cfg.durationMinutes) || 30} phút`
      : `⚠️ HT PageNew - Lịch chạy thất bại\nHồ sơ: ${profile.name}\nLý do: ${result.reason || result.message || 'Không rõ'}`);
  }
}

function startScheduler() {
  if (schedulerTimer) clearInterval(schedulerTimer);
  schedulerTick().catch(console.error);
  schedulerTimer = setInterval(() => schedulerTick().catch(console.error), 10000);
}

// Helper to parse proxy strings
function parseProxy(proxyStr) {
  if (!proxyStr || typeof proxyStr !== 'string') return null;
  let str = proxyStr.trim();
  if (!str || str.toLowerCase().includes('không')) return null;

  try {
    if (str.includes('://')) {
      const url = new URL(str);
      return {
        server: `${url.protocol}//${url.hostname}:${url.port}`,
        ip: url.hostname,
        port: url.port,
        username: url.username || '',
        password: url.password || '',
        protocol: url.protocol.replace(':', ''),
      };
    }
  } catch (e) {}

  const parts = str.split(':');
  if (parts.length >= 2) {
    const ip = parts[0].trim();
    const port = parts[1].trim();
    const username = parts[2] ? parts[2].trim() : '';
    const password = parts[3] ? parts[3].trim() : '';
    return {
      server: `http://${ip}:${port}`,
      ip,
      port,
      username,
      password,
      protocol: 'http',
    };
  }
  return null;
}

// Check Proxy Connection
function checkProxyConnection(proxyStr) {
  return new Promise((resolve) => {
    const parsed = parseProxy(proxyStr);
    if (!parsed) {
      return resolve({
        success: true,
        isDirectIp: true,
        message: 'Đang sử dụng kết nối IP trực tiếp (Không dùng Proxy).',
      });
    }

    const startTime = Date.now();
    const options = {
      host: parsed.ip,
      port: parseInt(parsed.port),
      path: 'http://ip-api.com/json',
      method: 'GET',
      headers: {
        'Host': 'ip-api.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      timeout: 7000,
    };

    if (parsed.username && parsed.password) {
      options.headers['Proxy-Authorization'] =
        'Basic ' + Buffer.from(`${parsed.username}:${parsed.password}`).toString('base64');
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        const latency = Date.now() - startTime;
        try {
          const json = JSON.parse(data);
          resolve({
            success: true,
            ip: json.query || parsed.ip,
            latency: `${latency}ms`,
            country: json.country || 'N/A',
            message: `Kết nối thành công! IP: ${json.query || parsed.ip} (${latency}ms, ${json.country || 'N/A'})`,
          });
        } catch (e) {
          resolve({
            success: true,
            ip: parsed.ip,
            latency: `${latency}ms`,
            country: 'OK',
            message: `Proxy hoạt động (Phản hồi ${res.statusCode}, latency: ${latency}ms)`,
          });
        }
      });
    });

    req.on('error', (err) => {
      const latency = Date.now() - startTime;
      resolve({
        success: false,
        latency: `${latency}ms`,
        message: `Lỗi kết nối Proxy (${err.code || err.message}). Proxy mất kết nối hoặc không phản hồi.`,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        message: 'Kết nối Proxy quá thời gian chờ (Timeout > 7s). Proxy không phản hồi.',
      });
    });

    req.end();
  });
}

async function checkProxyConnectionConfirmed(proxyStr, attempts = 2, delayMs = 1500) {
  let lastResult = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    lastResult = await checkProxyConnection(proxyStr);
    if (lastResult.success) return { ...lastResult, attempts: attempt };
    if (attempt < attempts) await wait(delayMs);
  }
  return { ...lastResult, attempts };
}

// Track active profile browser contexts & running sessions
const activeBrowserContexts = new Map();
const activeRunningSessions = new Map();

function getBrowserExecutablePath() {
  const candidates = app.isPackaged
    ? [
        path.join(process.resourcesPath, 'chromium', 'chrome.exe'),
        path.join(process.resourcesPath, 'chromium', 'chrome-win64', 'chrome.exe'),
      ]
    : [path.join(__dirname, 'node_modules', 'playwright-core', '.local-browsers', 'chromium-1243', 'chrome-win64', 'chrome.exe')];
  const bundledChromium = candidates.find((candidate) => fs.existsSync(candidate));

  if (!bundledChromium) {
    throw new Error(`Không tìm thấy Chromium tích hợp. Đã kiểm tra: ${candidates.join(', ')}. Ứng dụng sẽ không tự chuyển sang Edge/Chrome.`);
  }

  return { path: bundledChromium, engine: 'Chrome for Testing 153 (Chromium engine, H.264/AAC)' };
}

function getAtpCookieExtensionPath() {
  const extensionPath = app.isPackaged
    ? path.join(process.resourcesPath, 'extensions', 'atp-cookie')
    : path.join(__dirname, 'extensions', 'atp-cookie');
  const manifestPath = path.join(extensionPath, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Không tìm thấy ATP Cookie tại: ${manifestPath}`);
  }
  return extensionPath;
}

// Launch Isolated Browser per Profile
async function launchProfileBrowser(profileData, options = {}) {
  const { navigate = true } = options;
  const profileId = profileData.id || 'default';
  const profilesBaseDir = getProfilesBaseDir();
  const userDataDir = path.join(profilesBaseDir, `profile_${profileId}`);

  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  if (activeBrowserContexts.has(profileId)) {
    const existing = activeBrowserContexts.get(profileId);
    try {
      const pages = existing.pages();
      if (pages.length > 0) {
        await pages[0].bringToFront();
        return { success: true, message: `Trình duyệt của hồ sơ "${profileData.name}" đang mở sẵn.` };
      }
    } catch (e) {
      activeBrowserContexts.delete(profileId);
    }
  }

  let browserExecutable;
  let atpCookieExtensionPath;
  try {
    browserExecutable = getBrowserExecutablePath();
    atpCookieExtensionPath = getAtpCookieExtensionPath();
  } catch (err) {
    return { success: false, errorType: 'browser_component_missing', message: err.message };
  }
  const parsedProxy = parseProxy(profileData.proxy);
  const requestedWidth = Number.parseInt(profileData.browserWindowWidth, 10);
  const requestedHeight = Number.parseInt(profileData.browserWindowHeight, 10);
  const windowWidth = Math.max(640, Math.min(1920, Number.isFinite(requestedWidth) ? requestedWidth : 960));
  const windowHeight = Math.max(480, Math.min(1080, Number.isFinite(requestedHeight) ? requestedHeight : 720));
  const workArea = screen.getPrimaryDisplay().workArea;
  const columns = Math.max(1, Math.floor(workArea.width / windowWidth));
  const openIndex = activeBrowserContexts.size;
  const windowX = workArea.x + (openIndex % columns) * windowWidth;
  const windowY = workArea.y + Math.floor(openIndex / columns) * 40;
  const launchOptions = {
    executablePath: browserExecutable.path || undefined,
    chromiumSandbox: true,
    headless: false,
    viewport: null,
    args: [
      `--window-size=${windowWidth},${windowHeight}`,
      `--window-position=${windowX},${windowY}`,
      '--no-first-run',
      '--no-service-autorun',
      '--password-store=basic',
      `--disable-extensions-except=${atpCookieExtensionPath}`,
      `--load-extension=${atpCookieExtensionPath}`,
    ],
  };

  if (parsedProxy) {
    launchOptions.proxy = {
      server: parsedProxy.server,
      username: parsedProxy.username || undefined,
      password: parsedProxy.password || undefined,
    };
  }

  try {
    const context = await chromium.launchPersistentContext(userDataDir, launchOptions);
    activeBrowserContexts.set(profileId, context);

    context.on('close', () => {
      activeBrowserContexts.delete(profileId);
      activeRunningSessions.delete(profileId);
    });

    const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
    if (navigate) await page.goto('https://www.facebook.com');

    return {
      success: true,
      userDataDir,
      proxyUsed: parsedProxy ? parsedProxy.server : 'Không dùng Proxy (IP Máy)',
      browserEngine: browserExecutable.engine,
      extensions: ['ATP Cookie 1.3'],
      windowSize: { width: windowWidth, height: windowHeight },
      message: `Đã mở ${browserExecutable.engine} với ATP Cookie cho hồ sơ "${profileData.name}". Thư mục dữ liệu: profile_${profileId}`,
    };
  } catch (err) {
    console.error('Lỗi khi mở trình duyệt:', err);
    const profileLocked = /already in use|Opening in existing browser session|ProcessSingleton/i.test(err.message || '');
    return {
      success: false,
      errorType: profileLocked ? 'profile_in_use' : 'browser_launch_error',
      message: profileLocked
        ? 'Hồ sơ Chromium vẫn đang được một cửa sổ khác sử dụng. Hãy đóng cửa sổ đó, chờ 3 giây rồi bấm Chạy ngay.'
        : `Không thể mở trình duyệt: ${err.message}`,
    };
  }
}

async function getAuthenticatedProxyBridge(profileId, proxy) {
  const signature = `${proxy.server}|${proxy.username || ''}|${proxy.password || ''}`;
  const existing = activeProxyBridges.get(profileId);
  if (existing?.signature === signature && existing.server.listening) return existing.port;
  if (existing) {
    try { existing.server.close(); } catch (_) {}
    activeProxyBridges.delete(profileId);
  }

  const upstream = new URL(proxy.server);
  if (upstream.protocol !== 'http:') {
    throw new Error('Tự động xác thực hiện hỗ trợ proxy HTTP. Proxy HTTPS/SOCKS cần cấu hình khác.');
  }
  const upstreamPort = Number(upstream.port) || 80;
  const authorization = `Basic ${Buffer.from(`${proxy.username}:${proxy.password}`).toString('base64')}`;

  const server = http.createServer((request, response) => {
    const upstreamRequest = http.request({
      hostname: upstream.hostname,
      port: upstreamPort,
      method: request.method,
      path: request.url,
      headers: { ...request.headers, 'proxy-authorization': authorization },
    }, (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    });
    upstreamRequest.on('error', () => {
      if (!response.headersSent) response.writeHead(502);
      response.end('Proxy upstream không phản hồi');
    });
    request.pipe(upstreamRequest);
  });

  server.on('connect', (request, clientSocket, head) => {
    const upstreamSocket = net.connect(upstreamPort, upstream.hostname);
    let responseBuffer = Buffer.alloc(0);
    const fail = () => {
      try { clientSocket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n'); } catch (_) {}
      try { upstreamSocket.destroy(); } catch (_) {}
    };
    upstreamSocket.once('error', fail);
    clientSocket.once('error', () => upstreamSocket.destroy());
    upstreamSocket.once('connect', () => {
      upstreamSocket.write(
        `CONNECT ${request.url} HTTP/1.1\r\nHost: ${request.url}\r\nProxy-Authorization: ${authorization}\r\nConnection: keep-alive\r\n\r\n`,
      );
    });
    const onHandshake = (chunk) => {
      responseBuffer = Buffer.concat([responseBuffer, chunk]);
      const headerEnd = responseBuffer.indexOf('\r\n\r\n');
      if (headerEnd < 0) return;
      upstreamSocket.off('data', onHandshake);
      const header = responseBuffer.subarray(0, headerEnd).toString('latin1');
      if (!/^HTTP\/1\.[01] 200\b/.test(header)) return fail();
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      const remainder = responseBuffer.subarray(headerEnd + 4);
      if (remainder.length) clientSocket.write(remainder);
      if (head?.length) upstreamSocket.write(head);
      upstreamSocket.pipe(clientSocket);
      clientSocket.pipe(upstreamSocket);
    };
    upstreamSocket.on('data', onHandshake);
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  activeProxyBridges.set(profileId, { server, port, signature });
  return port;
}

async function launchManualLoginBrowser(profileData) {
  const profileId = profileData.id || 'default';
  const existingProcess = activeManualBrowsers.get(profileId);
  if (existingProcess && existingProcess.exitCode === null) {
    return { success: true, message: 'Chromium đăng nhập thủ công của hồ sơ này đang mở.' };
  }

  const automatedContext = activeBrowserContexts.get(profileId);
  if (automatedContext) {
    try { await automatedContext.close(); } catch (_) {}
    activeBrowserContexts.delete(profileId);
  }

  let browserExecutable;
  try {
    browserExecutable = getBrowserExecutablePath();
  } catch (error) {
    return { success: false, errorType: 'browser_component_missing', message: error.message };
  }

  const userDataDir = path.join(getProfilesBaseDir(), `profile_${profileId}`);
  fs.mkdirSync(userDataDir, { recursive: true });
  const width = Math.max(640, Math.min(1920, Number.parseInt(profileData.browserWindowWidth, 10) || 960));
  const height = Math.max(480, Math.min(1080, Number.parseInt(profileData.browserWindowHeight, 10) || 720));
  const workArea = screen.getPrimaryDisplay().workArea;
  const args = [
    `--user-data-dir=${userDataDir}`,
    `--window-size=${width},${height}`,
    `--window-position=${workArea.x},${workArea.y}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--password-store=basic',
  ];
  const parsedProxy = parseProxy(profileData.proxy);
  if (parsedProxy?.username) {
    try {
      const bridgePort = await getAuthenticatedProxyBridge(profileId, parsedProxy);
      args.push(`--proxy-server=http://127.0.0.1:${bridgePort}`);
    } catch (error) {
      return { success: false, errorType: 'proxy_bridge_error', message: `Không thể tự xác thực proxy: ${error.message}` };
    }
  } else if (parsedProxy) {
    args.push(`--proxy-server=${parsedProxy.server}`);
  }
  args.push('https://www.facebook.com');

  try {
    const child = spawn(browserExecutable.path, args, { stdio: 'ignore', windowsHide: false });
    activeManualBrowsers.set(profileId, child);
    child.once('exit', () => activeManualBrowsers.delete(profileId));
    child.once('error', () => activeManualBrowsers.delete(profileId));
    return {
      success: true,
      manualLoginMode: true,
      message: parsedProxy?.username
        ? 'Đã mở Chromium và tự xác thực proxy qua cầu nối cục bộ. Sau khi Feed xuất hiện, đóng Chromium rồi bấm Kiểm tra đăng nhập.'
        : 'Đã mở Chromium nguyên bản. Sau khi Feed xuất hiện, đóng Chromium rồi bấm Kiểm tra đăng nhập.',
    };
  } catch (error) {
    return { success: false, errorType: 'browser_launch_error', message: `Không thể mở Chromium: ${error.message}` };
  }
}

async function checkFacebookLogin(profileData) {
  const manualProcess = activeManualBrowsers.get(profileData.id);
  if (manualProcess && manualProcess.exitCode === null) {
    return {
      success: false,
      errorType: 'manual_browser_open',
      message: 'Hãy đóng hoàn toàn cửa sổ Chromium đăng nhập thủ công, chờ 3 giây rồi bấm Kiểm tra đăng nhập.',
    };
  }

  const launchResult = await launchProfileBrowser(profileData, { navigate: false });
  if (!launchResult.success) return launchResult;

  const context = activeBrowserContexts.get(profileData.id);
  const page = context?.pages()?.[0];
  if (!context || !page) {
    return { success: false, errorType: 'context_error', message: 'Không tìm thấy cửa sổ Chromium của hồ sơ.' };
  }

  await page.waitForTimeout(3000);
  const currentUrl = page.url();
  const cookies = await context.cookies('https://www.facebook.com');
  const hasUserCookie = cookies.some((cookie) => cookie.name === 'c_user' && cookie.value);
  const needsVerification = /checkpoint|two_step|challenge|captcha|identity/i.test(currentUrl);

  if (needsVerification) {
    await page.bringToFront();
    return {
      success: false,
      errorType: 'verification_required',
      message: 'Facebook vẫn đang yêu cầu xác minh. Hãy hoàn tất trong Chromium và chờ trang Feed xuất hiện rồi kiểm tra lại.',
    };
  }

  if (!hasUserCookie) {
    await page.bringToFront();
    return {
      success: false,
      errorType: 'login_not_stable',
      message: 'Facebook chưa cấp cookie đăng nhập cho hồ sơ này. Không chạy tự động; hãy đăng nhập thủ công và chờ trang Feed tải xong.',
    };
  }

  return {
    success: true,
    message: 'Đăng nhập đã ổn định và được lưu trong đúng hồ sơ Chromium. Bạn có thể bấm Chạy ngay.',
  };
}

// Format time string HH:mm:ss for audit log
function formatTimeString(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function selectPageForSession(profile) {
  const configuredPages = (profile.managedPages || [])
    .map((item, index) => typeof item === 'string'
      ? { id: `legacy-${index}`, name: item, url: '', enabled: true }
      : item && typeof item === 'object' ? { ...item, enabled: item.enabled !== false } : null)
    .filter((item) => item?.enabled && item.name && item.url);

  // A profile without a valid configured Fanpage always runs as the personal
  // Facebook identity. Ignore stale legacy pageName/pageUrl fields.
  if (profile.runAsPersonal || configuredPages.length === 0) {
    return {
      page: { id: 'personal-profile', name: 'Trang cá nhân', url: '', enabled: true },
      nextIndex: Number(profile.pageRotationIndex) || 0,
      mode: 'personal',
    };
  }
  const pages = configuredPages;

  const mode = profile.pageRotationMode || 'fixed';
  let index = 0;
  if (mode === 'random') index = Math.floor(Math.random() * pages.length);
  if (mode === 'sequential') index = (Number(profile.pageRotationIndex) || 0) % pages.length;
  return {
    page: pages[index],
    nextIndex: mode === 'sequential' ? (index + 1) % pages.length : Number(profile.pageRotationIndex) || 0,
    mode,
  };
}

function normalizeFacebookPageUrls(rawUrl) {
  const parsed = new URL(rawUrl);
  if (!/(^|\.)facebook\.com$/i.test(parsed.hostname)) {
    throw new Error('URL không thuộc facebook.com');
  }

  const cleanPath = parsed.pathname.replace(/\/+$/, '') || '/';
  if (cleanPath === '/') throw new Error('URL chưa chứa tên hoặc ID của Fanpage');
  parsed.protocol = 'https:';
  parsed.hostname = 'www.facebook.com';
  parsed.pathname = cleanPath;
  parsed.hash = '';
  return {
    switchUrl: parsed.href,
    expectedPageId: parsed.searchParams.get('id') || '',
    identitySwitchUrl: parsed.searchParams.get('id')
      ? `https://www.facebook.com/switchprofile.php?profile_id=${encodeURIComponent(parsed.searchParams.get('id'))}&next=${encodeURIComponent('https://www.facebook.com/')}`
      : '',
    feedUrl: 'https://www.facebook.com/',
    reelsUrl: 'https://www.facebook.com/reels',
  };
}

async function getFacebookIdentity(context) {
  const cookies = await context.cookies('https://www.facebook.com');
  return {
    personalId: cookies.find((cookie) => cookie.name === 'c_user')?.value || '',
    actingId: cookies.find((cookie) => cookie.name === 'i_user')?.value || '',
  };
}

async function getFacebookActingProfileId(context) {
  return (await getFacebookIdentity(context)).actingId;
}

async function moveVirtualCursor(page, x, y, label = '') {
  try {
    await page.evaluate(({ cursorX, cursorY, cursorLabel }) => {
      let cursor = document.getElementById('ht-pagenew-virtual-cursor');
      if (!cursor) {
        cursor = document.createElement('div');
        cursor.id = 'ht-pagenew-virtual-cursor';
        cursor.innerHTML = '<span></span>';
        Object.assign(cursor.style, {
          position: 'fixed',
          left: '0px',
          top: '0px',
          width: '22px',
          height: '22px',
          border: '3px solid #22d3ee',
          borderRadius: '50%',
          background: 'rgba(34,211,238,.2)',
          boxShadow: '0 0 0 4px rgba(15,23,42,.7), 0 0 18px #22d3ee',
          pointerEvents: 'none',
          zIndex: '2147483647',
          transition: 'transform 280ms ease, border-color 120ms ease',
        });
        const badge = cursor.querySelector('span');
        Object.assign(badge.style, {
          position: 'absolute',
          left: '18px',
          top: '18px',
          padding: '4px 7px',
          borderRadius: '6px',
          background: '#0f172a',
          color: '#67e8f9',
          font: '600 12px system-ui',
          whiteSpace: 'nowrap',
          border: '1px solid #155e75',
        });
        document.documentElement.appendChild(cursor);
      }
      cursor.style.transform = `translate(${Math.round(cursorX - 11)}px, ${Math.round(cursorY - 11)}px)`;
      cursor.querySelector('span').textContent = cursorLabel;
    }, { cursorX: x, cursorY: y, cursorLabel: label });
    await page.mouse.move(x, y, { steps: 8 });
  } catch (_) {}
}

async function pointVirtualCursorAt(page, locator, label) {
  try {
    const box = await locator.boundingBox();
    if (!box) return;
    await moveVirtualCursor(page, box.x + box.width / 2, box.y + box.height / 2, label);
    await wait(320);
  } catch (_) {}
}

async function waitForPageIdentity(context, expectedPageId = '', timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const identity = await getFacebookIdentity(context);
    const isPage = Boolean(identity.actingId && identity.actingId !== identity.personalId);
    const matchesExpected = !expectedPageId || identity.actingId === expectedPageId;
    if (isPage && matchesExpected) return { success: true, ...identity };
    await wait(500);
  }
  return { success: false, ...(await getFacebookIdentity(context)) };
}

async function waitForPageComposerIdentity(page, pageName, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const active = await page.evaluate((expectedName) => {
        const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
        const name = normalize(expectedName);
        return Array.from(document.querySelectorAll('[aria-label], [placeholder], [role="button"], [contenteditable="true"]'))
          .some((node) => {
            const rect = node.getBoundingClientRect();
            if (rect.top < 60 || rect.top > 420 || rect.width < 80 || rect.height < 20) return false;
            const value = normalize(`${node.getAttribute('aria-label') || ''} ${node.getAttribute('placeholder') || ''} ${node.textContent || ''}`);
            const isComposer = value.includes("what's on your mind") || value.includes('bạn đang nghĩ gì') || value.includes('đang nghĩ gì thế');
            return isComposer && value.includes(name);
          });
      }, pageName);
      if (active) return true;
    } catch (_) {}
    await wait(500);
  }
  return false;
}

async function clickFirstVisible(page, selectors, label = 'Click') {
  for (const selector of selectors) {
    const candidates = page.locator(selector);
    const count = await candidates.count();
    for (let index = 0; index < count; index += 1) {
      const candidate = candidates.nth(index);
      try {
        if (await candidate.isVisible()) {
          await pointVirtualCursorAt(page, candidate, label);
          await candidate.click({ timeout: 2500 });
          return true;
        }
      } catch (_) {}
    }
  }
  return false;
}

async function clickExactVisibleText(page, text) {
  const candidates = page.getByText(text, { exact: true });
  const count = await candidates.count();
  for (let index = count - 1; index >= 0; index -= 1) {
    const candidate = candidates.nth(index);
    try {
      if (await candidate.isVisible()) {
        await pointVirtualCursorAt(page, candidate, `Chọn ${text}`);
        const clickPoint = await candidate.evaluate((node) => {
          const clickable = node.closest('[role="button"], a, [tabindex="0"]') || node;
          const rect = clickable.getBoundingClientRect();
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        });
        await page.mouse.click(clickPoint.x, clickPoint.y);
        return true;
      }
    } catch (_) {}
  }
  return false;
}

async function clickVisibleTextByDom(page, text, { rightSideOnly = true } = {}) {
  const point = await page.evaluate(({ targetText, rightSideOnly }) => {
    const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
    const target = normalize(targetText);
    const candidates = Array.from(document.querySelectorAll('span, div, a, strong, [role="button"], [aria-label]'))
      .map((node) => ({ node, rect: node.getBoundingClientRect(), value: normalize(node.innerText || node.textContent || node.getAttribute('aria-label') || node.getAttribute('title')) }))
      .filter(({ node, rect, value }) => value.includes(target)
        && rect.width > 5 && rect.height > 5
        && rect.bottom > 0 && rect.right > 0
        && rect.top < Math.min(window.innerHeight, 680)
        && (!rightSideOnly || rect.left > window.innerWidth * 0.45) && rect.left < window.innerWidth
        && getComputedStyle(node).visibility !== 'hidden'
        && getComputedStyle(node).display !== 'none')
      .sort((a, b) => (a.rect.width * a.rect.height) - (b.rect.width * b.rect.height));
    if (!candidates.length) return null;
    const leaf = candidates[0].node;
    const clickable = leaf.closest('[role="button"], a, [tabindex="0"]') || leaf;
    const rect = clickable.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, { targetText: text, rightSideOnly });
  if (!point) return false;
  await moveVirtualCursor(page, point.x, point.y, `Chọn ${text}`);
  await wait(350);
  await page.mouse.click(point.x, point.y);
  return true;
}

async function openAllFacebookProfiles(page) {
  const labels = [
    'See all profiles',
    'Xem tất cả trang cá nhân',
    'Xem tất cả hồ sơ',
    'See all Pages',
    'Xem tất cả Trang',
  ];
  for (const label of labels) {
    if (await clickExactVisibleText(page, label) || await clickVisibleTextByDom(page, label)) {
      await wait(1400);
      return true;
    }
  }
  return false;
}

async function fillFacebookProfileSearch(page, pageName) {
  const selectors = [
    'input[placeholder*="Search"]',
    'input[placeholder*="search"]',
    'input[placeholder*="Tìm kiếm"]',
    'input[aria-label*="Search"]',
    'input[aria-label*="search"]',
    'input[aria-label*="Tìm kiếm"]',
  ];
  for (const selector of selectors) {
    const inputs = page.locator(selector);
    const count = await inputs.count();
    for (let index = 0; index < count; index += 1) {
      const input = inputs.nth(index);
      try {
        if (!(await input.isVisible())) continue;
        await pointVirtualCursorAt(page, input, `Tìm ${pageName}`);
        await input.click({ timeout: 2500 });
        await input.fill(pageName);
        await wait(1100);
        return true;
      } catch (_) {}
    }
  }
  return false;
}

async function confirmFacebookProfileSwitch(page) {
  const labels = [
    'Switch',
    'Switch profile',
    'Continue',
    'Use profile',
    'Chuyển',
    'Chuyển trang cá nhân',
    'Chuyển hồ sơ',
    'Tiếp tục',
    'Sử dụng trang cá nhân',
  ];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await wait(900);
    for (const label of labels) {
      if (await clickExactVisibleText(page, label)) {
        await wait(1800);
        return true;
      }
    }
  }
  return false;
}

async function getVisibleAccountMenuText(page) {
  try {
    return await page.evaluate(() => Array.from(document.querySelectorAll('span, div, a, [role="button"]'))
      .map((node) => ({ text: String(node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim(), rect: node.getBoundingClientRect() }))
      .filter(({ text, rect }) => text && text.length < 100 && rect.left > window.innerWidth * 0.5 && rect.top >= 0 && rect.top < 520 && rect.width > 20 && rect.height > 10)
      .sort((a, b) => (a.rect.width * a.rect.height) - (b.rect.width * b.rect.height))
      .slice(0, 20)
      .map((item) => item.text));
  } catch (_) { return []; }
}

async function clickFacebookProfileById(page, expectedPageId, pageName = '') {
  if (!expectedPageId) return false;
  const point = await page.evaluate(({ targetId, targetName }) => {
    const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
    const links = Array.from(document.querySelectorAll('a[href], [role="button"], [tabindex="0"]'));
    const candidates = links.map((node) => {
      const rect = node.getBoundingClientRect();
      const href = node.getAttribute('href') || '';
      const text = normalize(node.innerText || node.textContent || node.getAttribute('aria-label'));
      let idMatch = false;
      try {
        const parsed = new URL(href, window.location.origin);
        idMatch = parsed.searchParams.get('profile_id') === targetId
          || parsed.searchParams.get('id') === targetId
          || parsed.pathname.split('/').filter(Boolean).includes(targetId);
      } catch (_) {}
      return { node, rect, text, idMatch };
    }).filter(({ rect, idMatch, text }) => rect.width > 8 && rect.height > 8
      && rect.bottom > 0 && rect.top < window.innerHeight
      && getComputedStyle(document.elementFromPoint(
        Math.min(window.innerWidth - 1, Math.max(0, rect.left + rect.width / 2)),
        Math.min(window.innerHeight - 1, Math.max(0, rect.top + rect.height / 2)),
      ) || document.body).visibility !== 'hidden'
      && (idMatch || (targetName && text === normalize(targetName))));
    candidates.sort((a, b) => Number(b.idMatch) - Number(a.idMatch) || (a.rect.width * a.rect.height) - (b.rect.width * b.rect.height));
    if (!candidates.length) return null;
    const rect = candidates[0].rect;
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, { targetId: String(expectedPageId), targetName: pageName });
  if (!point) return false;
  await moveVirtualCursor(page, point.x, point.y, `Chọn ${pageName || expectedPageId}`);
  await wait(350);
  await page.mouse.click(point.x, point.y);
  return true;
}

async function switchFacebookIdentityByUrl(page, context, profile) {
  if (!profile.identitySwitchUrl || !profile.expectedPageId) return { success: false };
  try {
    writeAutomationDiagnostic(profile.id, 'page-switch-step', {
      stage: 'direct-switch-start',
      pageName: profile.pageName,
      expectedPageId: profile.expectedPageId,
    });
    await page.goto(profile.identitySwitchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const result = await waitForPageIdentity(context, profile.expectedPageId, 15000);
    if (!result.success) return { success: false, actingId: result.actingId };
    await goToFacebookHome(page);
    const persisted = await waitForPageIdentity(context, profile.expectedPageId, 7000);
    if (!persisted.success) return { success: false, actingId: persisted.actingId };
    return { success: true, actingId: persisted.actingId };
  } catch (error) {
    writeAutomationDiagnostic(profile.id, 'page-switch-step', {
      stage: 'direct-switch-error',
      pageName: profile.pageName,
      message: error.message,
    });
    return { success: false };
  }
}

async function goToFacebookHome(page) {
  const clicked = await clickFirstVisible(page, [
    '[aria-label="Home"]',
    '[aria-label="Trang chủ"]',
    'a[href="/"]',
    'a[href="https://www.facebook.com/"]',
  ], 'Về trang chủ');
  if (clicked) {
    await wait(1500);
    return;
  }
  await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
}

async function clickTopRightProfileAvatar(page) {
  const point = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll('[role="button"], [tabindex="0"], img'))
      .map((button) => ({ button, rect: button.getBoundingClientRect(), hasImage: button.tagName === 'IMG' || Boolean(button.querySelector?.('img')) }))
      .filter(({ rect, hasImage }) => hasImage && rect.width >= 28 && rect.height >= 28 && rect.bottom > 0 && rect.top < 120 && rect.right > window.innerWidth * 0.75)
      .sort((a, b) => b.rect.right - a.rect.right);
    if (!candidates.length) return { x: window.innerWidth - 42, y: 42, fallback: true };
    const { rect } = candidates[0];
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  });
  if (!point) return false;
  await moveVirtualCursor(page, point.x, point.y, 'Mở menu tài khoản');
  await wait(320);
  await page.mouse.click(point.x, point.y);
  await wait(700);
  return true;
}

async function openFacebookAccountMenu(page) {
  try {
    await page.keyboard.press('Escape').catch(() => {});
    await wait(250);
    const selectors = [
      '[aria-label="Trang cá nhân của bạn"]',
      '[aria-label="Your profile"]',
      '[aria-label*="Mở menu tài khoản" i]',
      '[aria-label*="menu tài khoản" i]',
      '[aria-label*="account menu" i]',
    ];
    const candidates = [];
    for (const selector of selectors) {
      const locator = page.locator(selector);
      for (let index = 0; index < await locator.count(); index += 1) {
        const item = locator.nth(index);
        if (!(await item.isVisible().catch(() => false))) continue;
        const box = await item.boundingBox().catch(() => null);
        if (box && box.y < 140 && box.width >= 20 && box.height >= 20) candidates.push({ item, box });
      }
    }
    candidates.sort((a, b) => b.box.x - a.box.x || a.box.y - b.box.y || (a.box.width * a.box.height) - (b.box.width * b.box.height));
    if (!candidates.length) return clickTopRightProfileAvatar(page);
    const target = candidates[0];
    await pointVirtualCursorAt(page, target.item, 'Mở menu tài khoản');
    await target.item.click({ timeout: 3500 });
    await wait(1100);
    return true;
  } catch (_) {
    return clickTopRightProfileAvatar(page);
  }
}

async function switchFacebookPageIdentity(page, context, profile) {
  const beforeIdentity = await getFacebookIdentity(context);
  writeAutomationDiagnostic(profile.id, 'page-switch-start', {
    pageName: profile.pageName,
    expectedPageId: profile.expectedPageId,
    actingPageIdBefore: beforeIdentity.actingId,
  });

  // If the requested Page is already active, only return after confirming that
  // the identity survives navigation back to the Facebook home Feed.
  let identityResult = await waitForPageIdentity(context, profile.expectedPageId, 1500);
  if (profile.expectedPageId && identityResult.success) {
    await goToFacebookHome(page);
    const persisted = await waitForPageIdentity(context, profile.expectedPageId, 5000);
    if (persisted.success) {
      writeAutomationDiagnostic(profile.id, 'page-switch-success', { method: 'already-active', pageName: profile.pageName, actingPageId: persisted.actingId });
      return { success: true, actingId: persisted.actingId };
    }
  }

  // A configured profile.php?id=... link gives us an unambiguous Page ID.
  // Prefer Facebook's own profile-switch endpoint and verify the resulting
  // i_user cookie. This avoids depending on translated/reordered account-menu
  // labels. The visible menu remains a fallback for URL variants without an ID.
  const directResult = await switchFacebookIdentityByUrl(page, context, profile);
  if (directResult.success) {
    writeAutomationDiagnostic(profile.id, 'page-switch-success', {
      method: 'profile-id-url',
      pageName: profile.pageName,
      actingPageId: directResult.actingId,
    });
    return directResult;
  }

  // Always begin the switch from Facebook Home and use the visible account
  // menu. Navigating to a Page URL can show its management surface without
  // actually changing the acting identity.
  await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  const openedAccountMenu = await openFacebookAccountMenu(page);
  if (!openedAccountMenu) {
    writeAutomationDiagnostic(profile.id, 'page-switch-failed', { stage: 'open-account-menu', pageName: profile.pageName });
    return { success: false, reason: 'Không tìm thấy menu tài khoản Facebook để chuyển Page.' };
  }

  await wait(1200);

  // Follow Facebook's full, human-visible flow. The compact account menu may
  // omit managed Pages or contain similarly named entries, so do not select a
  // Page there until we have first attempted to open the complete profile list.
  const openedAllProfiles = await openAllFacebookProfiles(page);
  writeAutomationDiagnostic(profile.id, 'page-switch-step', {
    stage: openedAllProfiles ? 'all-profiles-opened' : 'all-profiles-not-found',
    pageName: profile.pageName,
  });

  let selected = false;
  if (openedAllProfiles) {
    selected = await clickFacebookProfileById(page, profile.expectedPageId, profile.pageName);
    if (!selected) selected = await clickExactVisibleText(page, profile.pageName);
    if (!selected) selected = await clickVisibleTextByDom(page, profile.pageName, { rightSideOnly: false });
    if (!selected) {
      const searched = await fillFacebookProfileSearch(page, profile.pageName);
      writeAutomationDiagnostic(profile.id, 'page-switch-step', {
        stage: searched ? 'profile-search-filled' : 'profile-search-unavailable',
        pageName: profile.pageName,
      });
      if (searched) {
        selected = await clickFacebookProfileById(page, profile.expectedPageId, profile.pageName);
        if (!selected) selected = await clickExactVisibleText(page, profile.pageName);
        if (!selected) selected = await clickVisibleTextByDom(page, profile.pageName, { rightSideOnly: false });
      }
    }
  } else {
    // Compatibility fallback for Facebook variants where all managed profiles
    // already appear in the first menu and there is no "See all profiles" row.
    selected = await clickFacebookProfileById(page, profile.expectedPageId, profile.pageName);
    if (!selected) selected = await clickExactVisibleText(page, profile.pageName);
    if (!selected) selected = await clickVisibleTextByDom(page, profile.pageName);
  }
  if (!selected) {
    const visibleMenuText = await getVisibleAccountMenuText(page);
    writeAutomationDiagnostic(profile.id, 'page-switch-failed', { stage: 'find-page-entry', pageName: profile.pageName, visibleMenuText });
    return { success: false, reason: `Không tìm thấy Page "${profile.pageName}" trong menu chuyển hồ sơ.` };
  }


  const confirmationClicked = await confirmFacebookProfileSwitch(page);
  writeAutomationDiagnostic(profile.id, 'page-switch-step', {
    stage: confirmationClicked ? 'switch-confirmed' : 'no-switch-confirmation',
    pageName: profile.pageName,
    currentUrl: page.url(),
  });

  // The ID discoverable in a vanity Page's HTML may refer to a content entity
  // rather than the acting profile. Trust the identity Facebook actually sets
  // after the visible selection, then validate the Page name in the composer.
  identityResult = await waitForPageIdentity(context, '', 10000);
  await goToFacebookHome(page);
  const composerConfirmed = await waitForPageComposerIdentity(page, profile.pageName, 8000);
  const expectedIdMatches = !profile.expectedPageId || identityResult.actingId === profile.expectedPageId;
  writeAutomationDiagnostic(profile.id, 'page-switch-step', {
    stage: 'identity-verified',
    pageName: profile.pageName,
    expectedPageId: profile.expectedPageId,
    actingPageId: identityResult.actingId,
    expectedIdMatches,
    composerConfirmed,
  });
  if ((!identityResult.success && !composerConfirmed) || (identityResult.actingId && identityResult.actingId === beforeIdentity.personalId)) {
    writeAutomationDiagnostic(profile.id, 'page-switch-failed', {
      stage: 'verify-after-click',
      pageName: profile.pageName,
      expectedPageId: profile.expectedPageId,
      actingPageIdAfter: identityResult.actingId,
    });
    return { success: false, reason: `Facebook chưa xác nhận chuyển sang Page "${profile.pageName}".` };
  }

  if (composerConfirmed) {
    writeAutomationDiagnostic(profile.id, 'page-switch-success', { method: 'account-menu-composer', pageName: profile.pageName, actingPageId: identityResult.actingId || '' });
    return { success: true, actingId: identityResult.actingId || profile.expectedPageId || '' };
  }
  const persisted = await waitForPageIdentity(context, profile.expectedPageId || identityResult.actingId, 7000);
  if (!persisted.success) {
    writeAutomationDiagnostic(profile.id, 'page-switch-failed', { stage: 'verify-after-home', pageName: profile.pageName, expectedPageId: profile.expectedPageId });
    return { success: false, reason: `Danh tính Page "${profile.pageName}" không được giữ sau khi về trang chủ.` };
  }
  writeAutomationDiagnostic(profile.id, 'page-switch-success', { method: 'account-menu', pageName: profile.pageName, actingPageId: persisted.actingId });
  return { success: true, actingId: persisted.actingId };
}

async function switchFacebookPersonalIdentity(page, context, profile) {
  const current = await getFacebookIdentity(context);
  if (!current.personalId) return { success: false, reason: 'Không xác định được tài khoản Facebook cá nhân đang đăng nhập.' };
  if (!current.actingId || current.actingId === current.personalId) {
    await goToFacebookHome(page);
    return { success: true, personalId: current.personalId };
  }

  writeAutomationDiagnostic(profile.id, 'personal-switch-start', { actingPageIdBefore: current.actingId, personalId: current.personalId });
  const switchUrl = `https://www.facebook.com/switchprofile.php?profile_id=${encodeURIComponent(current.personalId)}&next=${encodeURIComponent('https://www.facebook.com/')}`;
  try {
    await page.goto(switchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      const identity = await getFacebookIdentity(context);
      if (identity.personalId === current.personalId && (!identity.actingId || identity.actingId === identity.personalId)) {
        await goToFacebookHome(page);
        writeAutomationDiagnostic(profile.id, 'personal-switch-success', { personalId: identity.personalId });
        return { success: true, personalId: identity.personalId };
      }
      await wait(500);
    }
  } catch (_) {}
  const after = await getFacebookIdentity(context);
  writeAutomationDiagnostic(profile.id, 'personal-switch-failed', { actingPageIdAfter: after.actingId, personalId: after.personalId });
  return { success: false, reason: 'Facebook chưa chuyển khỏi vai Page để trở về Trang cá nhân.' };
}

// Start Single Profile Session with Strict Error Handling & Non-retry policy
async function startSingleProfileSession(profile, durationMinutes = 30) {
  const profileId = profile.id;
  const startTime = new Date();
  const startTimeStr = formatTimeString(startTime);

  // Check 1: Already running
  if (activeRunningSessions.has(profileId) && activeRunningSessions.get(profileId).isRunning) {
    return {
      success: false,
      errorType: 'already_running',
      reason: `Hồ sơ "${profile.name}" đang trong phiên chạy. Không khởi chạy trùng lặp.`,
    };
  }

  // Check 2: Select the next enabled Page for this session.
  const pageSelection = selectPageForSession(profile);
  if (!pageSelection) {
    return {
      success: false,
      errorType: 'no_page',
      reason: 'Chưa chọn Page cho hồ sơ này. Vui lòng chọn Page trước khi chạy.',
      audit: { startTime: startTimeStr, endTime: formatTimeString(), actualDuration: '0s', stopReason: 'Chưa chọn Page' }
    };
  }
  if (pageSelection.mode !== 'fixed' && pageSelection.mode !== 'personal' && !pageSelection.page.url) {
    return {
      success: false,
      errorType: 'page_url_missing',
      reason: `Page "${pageSelection.page.name}" chưa có URL Facebook. Hãy mở Đổi Page chọn và bổ sung URL trước khi chạy tự động.`,
    };
  }
  profile = {
    ...profile,
    runAsPersonal: pageSelection.mode === 'personal',
    pageName: pageSelection.page.name,
    pageUrl: pageSelection.page.url,
    pageRotationIndex: pageSelection.nextIndex,
  };
  if (profile.pageUrl) {
    try {
      const normalizedUrls = normalizeFacebookPageUrls(profile.pageUrl);
      profile.pageSwitchUrl = normalizedUrls.switchUrl;
      profile.expectedPageId = normalizedUrls.expectedPageId || pageSelection.page.pageId || '';
      profile.identitySwitchUrl = normalizedUrls.identitySwitchUrl || (profile.expectedPageId
        ? `https://www.facebook.com/switchprofile.php?profile_id=${encodeURIComponent(profile.expectedPageId)}&next=${encodeURIComponent('https://www.facebook.com/')}`
        : '');
      profile.pageUrl = normalizedUrls.feedUrl;
      profile.pageReelsUrl = normalizedUrls.reelsUrl;
    } catch (error) {
      return { success: false, errorType: 'page_url_invalid', reason: `URL Page không hợp lệ: ${error.message}` };
    }
  }

  // Check 3: Proxy Connection Test
  const proxyCheck = await checkProxyConnectionConfirmed(profile.proxy, 2, 1500);
  if (!proxyCheck.success) {
    return {
      success: false,
      errorType: 'proxy_failed',
      reason: `Proxy mất kết nối hoặc không phản hồi (${proxyCheck.message}). Đã dừng hồ sơ và không thử đăng nhập lại.`,
      audit: { startTime: startTimeStr, endTime: formatTimeString(), actualDuration: '0s', stopReason: 'Proxy mất kết nối' }
    };
  }

  // Ensure Browser is launched
  if (!activeBrowserContexts.has(profileId)) {
    await closeManualBrowserForProfile(profileId);
  }
  let launchRes = await launchProfileBrowser(profile);
  if (!launchRes.success) {
    return {
      success: false,
      errorType: 'browser_launch_error',
      reason: launchRes.message,
      audit: { startTime: startTimeStr, endTime: formatTimeString(), actualDuration: '0s', stopReason: launchRes.message }
    };
  }

  const context = activeBrowserContexts.get(profileId);
  if (!context) {
    return {
      success: false,
      errorType: 'context_error',
      reason: 'Không thể khởi tạo ngữ cảnh trình duyệt.',
    };
  }

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  // Check 4: Login & Checkpoint / 2FA Detection
  try {
    await page.goto('https://www.facebook.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (e) {
    return {
      success: false,
      errorType: 'network_error',
      reason: `Mất kết nối mạng khi tải Facebook (${e.message}). Đã dừng hồ sơ.`,
      audit: { startTime: startTimeStr, endTime: formatTimeString(), actualDuration: '0s', stopReason: 'Mất kết nối mạng' }
    };
  }

  const currentUrl = page.url();
  const pageTitle = await page.title();
  const facebookCookies = await context.cookies('https://www.facebook.com');
  const hasUserCookie = facebookCookies.some((cookie) => cookie.name === 'c_user' && cookie.value);

  const isLoginPage = !hasUserCookie || currentUrl.includes('/login') || currentUrl.includes('ref=dbl') || pageTitle.includes('Log in') || pageTitle.includes('Đăng nhập');
  const isCheckpoint = currentUrl.includes('/checkpoint') || currentUrl.includes('two_step') || currentUrl.includes('2fa') || currentUrl.includes('identity');

  if (isLoginPage) {
    return {
      success: false,
      errorType: 'login_expired',
      reason: 'Phiên đăng nhập Facebook đã hết hạn hoặc chưa đăng nhập. Đã dừng hồ sơ và chờ xử lý thủ công.',
      audit: { startTime: startTimeStr, endTime: formatTimeString(), actualDuration: '0s', stopReason: 'Phiên đăng nhập hết hạn' }
    };
  }

  if (isCheckpoint) {
    return {
      success: false,
      errorType: 'verification_required',
      reason: 'Facebook yêu cầu xác minh tài khoản (Checkpoint / 2FA / CAPTCHA). Đã dừng hồ sơ và không thử lại.',
      audit: { startTime: startTimeStr, endTime: formatTimeString(), actualDuration: '0s', stopReason: 'Facebook yêu cầu 2FA/CAPTCHA' }
    };
  }

  if (profile.runAsPersonal) {
    const personalResult = await switchFacebookPersonalIdentity(page, context, profile);
    if (!personalResult.success) {
      return { success: false, errorType: 'personal_switch_failed', reason: personalResult.reason };
    }
    profile.personalId = personalResult.personalId;
  } else if (profile.pageSwitchUrl) {
    try {
      if (!profile.expectedPageId) {
        writeAutomationDiagnostic(profile.id, 'page-switch-step', {
          stage: 'vanity-url-use-exact-name',
          pageName: profile.pageName,
        });
      }
      const switchResult = await switchFacebookPageIdentity(page, context, profile);
      if (!switchResult.success) {
        return {
          success: false,
          errorType: 'page_switch_failed',
          reason: switchResult.reason,
        };
      }
      profile.actingPageId = switchResult.actingId;
    } catch (error) {
      return {
        success: false,
        errorType: 'page_navigation_error',
        reason: `Không thể mở Page "${profile.pageName}": ${error.message}`,
      };
    }
  }

  // Valid Session -> Start Execution
  const durationMs = durationMinutes * 60 * 1000;
  const sessionInfo = {
    profileId,
    profileName: profile.name,
    pageName: profile.pageName,
    pageSwitchUrl: profile.pageSwitchUrl || '',
    pageUrl: profile.pageUrl || '',
    pageReelsUrl: profile.pageReelsUrl || '',
    actingPageId: profile.actingPageId || '',
    runAsPersonal: profile.runAsPersonal === true,
    personalId: profile.personalId || '',
    pageRotationMode: pageSelection.mode,
    pageRotationIndex: pageSelection.nextIndex,
    proxy: profile.proxy || 'Dùng IP máy',
    startTimeObj: startTime,
    startTimeStr,
    durationMinutes,
    durationMs,
    isRunning: true,
    isStopped: false,
    currentSection: 'Feed',
    statusText: 'Đang lướt Feed Facebook (Chỉ đọc nội dung)',
    proxy: profile.proxy || '',
    failureReason: null,
    errorType: null,
  };

  activeRunningSessions.set(profileId, sessionInfo);

  // Background Viewing Loop (Read-Only)
  runViewingSessionLoop(profileId, context, page, durationMs).catch((err) => {
    console.error(`Session error for ${profileId}:`, err);
    if (activeRunningSessions.has(profileId)) {
      const sess = activeRunningSessions.get(profileId);
      sess.isRunning = false;
      sess.statusText = `Đã dừng do lỗi: ${err.message}`;
    }
  });

  return {
    success: true,
    message: `Đã bắt đầu phiên xem Feed & Reels cho hồ sơ "${profile.name}" (Thời lượng: ${durationMinutes} phút | Page: ${profile.pageName}).`,
    sessionInfo,
  };
}

async function getReelPlaybackState(page) {
  return page.evaluate(() => {
    const visibleVideos = Array.from(document.querySelectorAll('video'))
      .map((video) => ({ video, rect: video.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 100 && rect.height > 100 && rect.bottom > 0 && rect.top < window.innerHeight)
      .sort((a, b) => (b.rect.width * b.rect.height) - (a.rect.width * a.rect.height));

    const video = visibleVideos[0]?.video;
    if (!video) return { found: false };

    if (video.paused && !video.ended) video.play().catch(() => {});
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const currentTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
    return {
      found: true,
      duration,
      currentTime,
      ended: video.ended,
      paused: video.paused,
      readyState: video.readyState,
      source: video.currentSrc || video.src || '',
    };
  });
}

function shouldAdvanceReel(playback) {
  if (!playback?.found) return false;
  if (playback.ended) return true;
  if (!playback.duration || playback.duration <= 0) return false;
  const remainingSeconds = playback.duration - playback.currentTime;
  return playback.currentTime / playback.duration >= 0.92 || remainingSeconds <= 1.5;
}

function getDesiredViewingSection(elapsedMs, durationMs) {
  if (!durationMs || durationMs <= 0) return 'feed';
  const progress = Math.max(0, Math.min(1, elapsedMs / durationMs));
  if (durationMs < 120000) return progress < 0.25 ? 'feed' : 'reels';
  if (progress < 0.35) return 'feed';
  if (progress < 0.9) return 'reels';
  return 'feed';
}

async function advanceToNextReel(page) {
  const nextSelectors = [
    '[aria-label="Next card"]',
    '[aria-label="Next reel"]',
    '[aria-label="Thẻ tiếp theo"]',
    '[aria-label="Video tiếp theo"]',
  ];

  for (const selector of nextSelectors) {
    const button = page.locator(selector).first();
    if (await button.count()) {
      try {
        await pointVirtualCursorAt(page, button, 'Reel tiếp theo');
        await button.click({ timeout: 1500 });
        return 'button';
      } catch (_) {}
    }
  }

  const viewport = page.viewportSize() || { width: 960, height: 720 };
  await moveVirtualCursor(page, viewport.width - 55, viewport.height / 2, 'Reel tiếp theo');
  await page.keyboard.press('ArrowDown');
  return 'keyboard';
}

async function nudgeToNextReel(page) {
  const viewport = page.viewportSize() || { width: 960, height: 720 };
  await moveVirtualCursor(page, viewport.width - 55, viewport.height / 2, 'Bỏ qua Reel lỗi');
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(300);
  await page.mouse.wheel(0, 700);
}

// Read-Only Viewing Loop Execution
async function runViewingSessionLoop(profileId, context, page, durationMs) {
  const session = activeRunningSessions.get(profileId);
  const startTime = session.startTimeObj.getTime();

  let currentSection = 'feed';
  let nextProxyCheckAt = Date.now() + 60000;
  let proxyFailureCount = 0;
  let nextIdentityCheckAt = Date.now() + 15000;
  let lastReelAdvanceAt = 0;
  let lastReelSource = '';
  let reelSourceSeenAt = Date.now();
  let lastReelCurrentTime = -1;
  let lastReelProgressAt = Date.now();
  let feedScrollCount = 0;

  while (Date.now() - startTime < durationMs) {
    const currentSession = activeRunningSessions.get(profileId);
    if (!currentSession || currentSession.isStopped) {
      console.log(`[Session ${profileId}] Đã nhận lệnh Dừng Ngay từ người dùng.`);
      break;
    }

    const elapsedMs = Date.now() - startTime;
    const remainingMs = durationMs - elapsedMs;

    // Check Checkpoint or Logout during run
    try {
      const url = page.url();
      if (url.includes('/checkpoint') || url.includes('/login') || url.includes('two_step') || url.includes('/challenge')) {
        currentSession.isRunning = false;
        currentSession.errorType = 'verification_required';
        currentSession.failureReason = 'Facebook yêu cầu xác minh thủ công';
        currentSession.statusText = 'Phát hiện yêu cầu xác minh từ Facebook. Đã tự động dừng hồ sơ.';
        notifyRenderer('session-alert', { profileId, errorType: currentSession.errorType, reason: currentSession.failureReason });
        break;
      }
    } catch (e) {}

    if ((currentSession.actingPageId || currentSession.runAsPersonal) && Date.now() >= nextIdentityCheckAt) {
      nextIdentityCheckAt = Date.now() + 15000;
      const identity = await getFacebookIdentity(context);
      const identityChanged = currentSession.runAsPersonal
        ? Boolean(identity.actingId && identity.actingId !== identity.personalId)
        : identity.actingId !== currentSession.actingPageId;
      if (identityChanged) {
        currentSession.isRunning = false;
        currentSession.errorType = 'page_identity_changed';
        currentSession.failureReason = currentSession.runAsPersonal
          ? 'Facebook không còn ở đúng danh tính Trang cá nhân'
          : `Facebook không còn ở đúng danh tính Page "${currentSession.pageName}"`;
        currentSession.statusText = currentSession.failureReason;
        notifyRenderer('session-alert', { profileId, errorType: currentSession.errorType, reason: currentSession.failureReason });
        break;
      }
    }

    if (Date.now() >= nextProxyCheckAt && currentSession.proxy) {
      const proxyResult = await checkProxyConnection(currentSession.proxy);
      if (!proxyResult.success) {
        proxyFailureCount += 1;
        nextProxyCheckAt = Date.now() + 10000;
        currentSession.statusText = `Proxy phản hồi không ổn định (${proxyFailureCount}/3), đang xác nhận lại...`;
        writeAutomationDiagnostic(profileId, 'proxy-health-check-failed', {
          consecutiveFailures: proxyFailureCount,
          message: proxyResult.message,
        });
        if (proxyFailureCount >= 3) {
          currentSession.isRunning = false;
          currentSession.errorType = 'proxy_failed';
          currentSession.failureReason = 'Proxy mất kết nối sau 3 lần kiểm tra liên tiếp';
          currentSession.statusText = currentSession.failureReason;
          notifyRenderer('session-alert', { profileId, errorType: currentSession.errorType, reason: `${currentSession.failureReason}: ${proxyResult.message}` });
          break;
        }
      } else {
        if (proxyFailureCount > 0) {
          writeAutomationDiagnostic(profileId, 'proxy-health-check-recovered', { previousFailures: proxyFailureCount });
        }
        proxyFailureCount = 0;
        nextProxyCheckAt = Date.now() + 60000;
      }
    }

    // Deterministic phases prevent repeated Feed/Reels switching.
    const desiredSection = getDesiredViewingSection(elapsedMs, durationMs);
    if (desiredSection === 'reels' && currentSection === 'feed') {
      currentSection = 'reels';
      currentSession.currentSection = 'Reels';
      currentSession.statusText = 'Đang xem video Facebook Reels (Chỉ xem, không tương tác)';
      try {
        const reelsUrl = currentSession.pageReelsUrl || 'https://www.facebook.com/reels';
        await page.goto(reelsUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      } catch (e) {}
      lastReelSource = '';
      reelSourceSeenAt = Date.now();
      lastReelAdvanceAt = 0;
      lastReelCurrentTime = -1;
      lastReelProgressAt = Date.now();
    } else if (desiredSection === 'feed' && currentSection === 'reels') {
      currentSection = 'feed';
      currentSession.currentSection = 'Feed';
      currentSession.statusText = 'Đang lướt Feed tin tức Facebook (Chỉ xem, không tương tác)';
      try {
        await page.goto(currentSession.pageUrl || 'https://www.facebook.com', { waitUntil: 'domcontentloaded', timeout: 20000 });
      } catch (e) {}
    }

    let delay;
    if (currentSection === 'reels') {
      try {
        const playback = await getReelPlaybackState(page);
        const now = Date.now();
        const sourceChanged = playback.found && playback.source && playback.source !== lastReelSource;
        const reelLooped = playback.found
          && !sourceChanged
          && lastReelCurrentTime > 2
          && playback.currentTime + 1 < lastReelCurrentTime;
        if (playback.found && playback.source && playback.source !== lastReelSource) {
          lastReelSource = playback.source;
          reelSourceSeenAt = now;
          lastReelProgressAt = now;
          lastReelCurrentTime = playback.currentTime;
        } else if (playback.found && playback.currentTime > lastReelCurrentTime + 0.2) {
          lastReelProgressAt = now;
        }
        if (!playback.found) {
          currentSession.statusText = 'Đang chờ Facebook tải video Reels...';
        } else if (playback.readyState < 2) {
          currentSession.statusText = 'Reel đang tải dữ liệu video...';
        } else {
          const percent = playback.duration > 0 ? Math.min(100, Math.round((playback.currentTime / playback.duration) * 100)) : 0;
          currentSession.statusText = `Đang xem Facebook Reel (${percent}% - chỉ xem)`;
        }

        const playbackStalled = playback.found
          && playback.readyState >= 2
          && now - lastReelProgressAt > 12000;

        if ((shouldAdvanceReel(playback) || reelLooped) && now - lastReelAdvanceAt > 2500) {
          await advanceToNextReel(page);
          lastReelAdvanceAt = now;
          lastReelProgressAt = now;
          lastReelCurrentTime = -1;
          currentSession.statusText = 'Đã xem gần hết Reel, đang chuyển sang Reel kế tiếp...';
          delay = 1800;
        } else if (
          now - lastReelAdvanceAt > 5000
          && (playbackStalled || (
            now - reelSourceSeenAt > 45000
            && (!playback.found || playback.readyState < 2 || !playback.duration)
          ))
        ) {
          await nudgeToNextReel(page);
          lastReelAdvanceAt = now;
          reelSourceSeenAt = now;
          lastReelProgressAt = now;
          lastReelCurrentTime = -1;
          currentSession.statusText = 'Reel không tải ổn định, đang thử chuyển sang Reel tiếp theo...';
          delay = 2000;
        }
        if (playback.found && !delay) lastReelCurrentTime = playback.currentTime;
      } catch (e) {
        console.warn(`[Session ${profileId}] Không đọc được trạng thái Reel: ${e.message}`);
      }
      delay ||= 1000;
    } else {
      // Feed only: paced, viewport-relative scrolling. Never interact with posts.
      try {
        const viewport = page.viewportSize() || { width: 960, height: 720 };
        await moveVirtualCursor(page, viewport.width - 45, Math.round(viewport.height * 0.72), 'Cuộn Feed');
        await page.evaluate(() => {
          window.scrollBy({
            top: Math.round(window.innerHeight * (0.45 + Math.random() * 0.2)),
            behavior: 'smooth',
          });
        });
      } catch (e) {}
      feedScrollCount += 1;
      delay = feedScrollCount % 4 === 0
        ? Math.floor(Math.random() * 3000) + 8000
        : Math.floor(Math.random() * 3000) + 4500;
    }

    await new Promise((resolve) => setTimeout(resolve, Math.min(delay, remainingMs)));
  }

  // Session Ended
  if (activeRunningSessions.has(profileId)) {
    const finalSess = activeRunningSessions.get(profileId);
    finalSess.isRunning = false;
    const endTime = new Date();
    const actualSec = Math.round((endTime.getTime() - startTime) / 1000);

    finalSess.audit = {
      startTime: finalSess.startTimeStr,
      endTime: formatTimeString(endTime),
      actualDurationStr: `${Math.floor(actualSec / 60)}m ${actualSec % 60}s`,
      stopReason: finalSess.isStopped ? 'Người dùng bấm Dừng ngay' : (finalSess.failureReason || 'Hoàn thành thời lượng quy định'),
    };

    if (!finalSess.isStopped && !finalSess.failureReason) {
      finalSess.statusText = `Hoàn thành phiên chạy ${finalSess.durationMinutes} phút thành công.`;
    }

    // Close Chromium after normal completion, manual stop, or non-verification errors.
    // Keep it open only when the user must complete Facebook verification manually.
    const keepOpenForVerification = finalSess.errorType === 'verification_required';
    finalSess.browserClosed = false;
    if (!keepOpenForVerification) {
      try {
        await context.close();
        finalSess.browserClosed = true;
      } catch (error) {
        console.warn(`[Session ${profileId}] Không thể tự đóng Chromium: ${error.message}`);
      }
    }
    notifyRenderer('session-ended', { profileId, session: finalSess });
  }
}

// Stop Running Session
function stopSingleProfileSession(profileId) {
  if (activeRunningSessions.has(profileId)) {
    const sess = activeRunningSessions.get(profileId);
    sess.isStopped = true;
    sess.isRunning = false;
    sess.statusText = 'Đã dừng bởi người dùng (Dừng ngay).';
    
    const endTime = new Date();
    const actualSec = Math.round((endTime.getTime() - sess.startTimeObj.getTime()) / 1000);

    return {
      success: true,
      message: `Đã dừng phiên chạy cho hồ sơ ID: ${profileId}`,
      audit: {
        startTime: sess.startTimeStr,
        endTime: formatTimeString(endTime),
        actualDurationStr: `${Math.floor(actualSec / 60)}m ${actualSec % 60}s`,
        stopReason: 'Người dùng bấm Dừng ngay'
      }
    };
  }
  return { success: false, message: 'Không tìm thấy phiên chạy đang hoạt động cho hồ sơ này.' };
}

function createWindow() {
  const { workAreaSize } = screen.getPrimaryDisplay();
  const defaultWidth = Math.min(1600, Math.max(1024, workAreaSize.width - 40));
  const defaultHeight = Math.min(900, Math.max(700, workAreaSize.height - 40));

  mainWindow = new BrowserWindow({
    width: defaultWidth,
    height: defaultHeight,
    minWidth: 1024,
    minHeight: 700,
    center: true,
    title: 'HT Studio - Quản Lý Lịch Facebook Feed & Reels',
    icon: path.join(__dirname, 'assets', 'branding', 'app-icon-256.png'),
    backgroundColor: '#f4f7fb',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    autoHideMenuBar: true,
    frame: true,
  });

  if (process.env.ELECTRON_START_URL) {
    mainWindow.loadURL(process.env.ELECTRON_START_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('check-proxy', async (event, proxyString) => {
  return await checkProxyConnection(proxyString);
});

ipcMain.handle('launch-browser', async (event, profileData) => {
  return await launchManualLoginBrowser(profileData);
});

ipcMain.handle('check-facebook-login', async (event, profileData) => {
  return await checkFacebookLogin(profileData);
});

ipcMain.handle('start-session', async (event, { profile, durationMinutes, actionType }) => {
  const result = await startSingleProfileSession(profile, durationMinutes);
  sendTelegramEvent(result.success ? 'start' : 'error', result.success
    ? `▶️ HT PageNew - Bắt đầu chạy\nHồ sơ: ${profile.name}\nDanh tính: ${result.sessionInfo?.pageName || profile.pageName || 'Trang cá nhân'}\nThời lượng: ${durationMinutes || 30} phút`
    : `⚠️ HT PageNew - Không thể bắt đầu\nHồ sơ: ${profile.name}\nLý do: ${result.reason || result.message || 'Không rõ'}`);
  return result;
});

ipcMain.handle('stop-session', async (event, profileId) => {
  return stopSingleProfileSession(profileId);
});

ipcMain.handle('get-session-status', async (event, profileId) => {
  if (activeRunningSessions.has(profileId)) {
    return { success: true, session: activeRunningSessions.get(profileId) };
  }
  return { success: false, session: null };
});

ipcMain.handle('sync-scheduler-profiles', async (event, profiles) => {
  saveSchedulerProfiles(profiles);
  return { success: true, count: scheduledProfiles.length };
});

ipcMain.handle('get-scheduler-profiles', async () => ({
  success: true,
  profiles: JSON.parse(JSON.stringify(scheduledProfiles || [])),
}));

ipcMain.handle('get-telegram-config', async () => {
  const config = readTelegramConfig();
  return {
    success: true,
    config: {
      enabled: Boolean(config.enabled),
      chatId: config.chatId || '',
      hasToken: Boolean(decryptTelegramToken(config)),
      events: { start: true, end: true, error: true, ...(config.events || {}) },
    },
  };
});

ipcMain.handle('save-telegram-config', async (_event, input) => {
  try {
    const current = readTelegramConfig();
    let tokenEncrypted = current.tokenEncrypted || '';
    if (String(input.token || '').trim()) {
      const token = String(input.token).trim();
      const buffer = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(token) : Buffer.from(token, 'utf8');
      tokenEncrypted = buffer.toString('base64');
    }
    const config = {
      enabled: Boolean(input.enabled),
      chatId: String(input.chatId || '').trim(),
      tokenEncrypted,
      events: { start: true, end: true, error: true, ...(input.events || {}) },
    };
    fs.writeFileSync(getTelegramConfigPath(), JSON.stringify(config, null, 2), 'utf8');
    startTelegramCommandPolling();
    return { success: true, hasToken: Boolean(decryptTelegramToken(config)) };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('test-telegram', async () => {
  return sendTelegramMessage(`✅ HT PageNew kết nối Telegram thành công.\nThời gian: ${new Date().toLocaleString('vi-VN')}`, { force: true });
});

ipcMain.handle('discover-telegram-chats', async (_event, token) => {
  return discoverTelegramChats(token);
});

ipcMain.handle('get-telegram-logs', async () => ({ success: true, logs: readTelegramLogs() }));
ipcMain.handle('clear-telegram-logs', async () => {
  fs.writeFileSync(getTelegramLogPath(), '[]', 'utf8');
  return { success: true };
});

// OS Native Security Encryption (Windows DPAPI via safeStorage)
ipcMain.handle('encrypt-data', async (event, plainText) => {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const encryptedBuffer = safeStorage.encryptString(plainText);
      return { success: true, data: encryptedBuffer.toString('base64'), protectedBy: 'Windows DPAPI' };
    } else {
      return { success: true, data: Buffer.from(plainText).toString('base64'), protectedBy: 'Base64 Fallback' };
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('decrypt-data', async (event, encryptedText) => {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const decrypted = safeStorage.decryptString(Buffer.from(encryptedText, 'base64'));
      return { success: true, data: decrypted };
    } else {
      return { success: true, data: Buffer.from(encryptedText, 'base64').toString('utf8') };
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('get-app-paths', async () => {
  const baseDir = getProfilesBaseDir();
  let browserInfo;
  try {
    browserInfo = getBrowserExecutablePath();
    browserInfo.extensions = [{ name: 'ATP Cookie', version: '1.3', path: getAtpCookieExtensionPath() }];
  } catch (err) {
    browserInfo = { path: null, engine: 'Chromium tích hợp bị thiếu', error: err.message };
  }
  return {
    baseDir,
    encryptionAvailable: safeStorage.isEncryptionAvailable(),
    browserInfo,
  };
});

app.whenReady().then(() => {
  app.setAppUserModelId('vn.htstudio.pagenew');
  loadSchedulerProfiles();
  startScheduler();
  startTelegramCommandPolling();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (schedulerTimer) clearInterval(schedulerTimer);
  if (telegramPollingTimer) clearInterval(telegramPollingTimer);
  for (const bridge of activeProxyBridges.values()) {
    try { bridge.server.close(); } catch (_) {}
  }
  activeProxyBridges.clear();
});
