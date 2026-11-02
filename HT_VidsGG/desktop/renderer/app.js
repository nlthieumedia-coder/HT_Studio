const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const toFileUrl = filePath => encodeURI(`file:///${String(filePath || '').replace(/\\/g, '/')}`).replace(/#/g, '%23').replace(/\?/g, '%3F');

let appDialogResolver = null;

function configureAppDialog(message, { type, title, mode = 'message', value = '' } = {}) {
  const dialog = $('appMessageDialog');
  if (!dialog) return null;
  const text = String(message ?? '');
  const resolvedType = type || (/^(lỗi|không thể|vui lòng)/i.test(text) ? 'error' : /^(cảnh báo|chú ý)/i.test(text) ? 'warning' : 'success');
  const resolvedTitle = title || (resolvedType === 'error' ? 'Không thể thực hiện' : resolvedType === 'warning' ? 'Cần lưu ý' : 'Đã hoàn tất');
  const icon = mode === 'confirm' ? '?' : mode === 'prompt' ? '✎' : resolvedType === 'success' ? '✓' : '!';
  dialog.dataset.type = resolvedType;
  dialog.dataset.mode = mode;
  $('appMessageTitle').textContent = resolvedTitle;
  $('appMessageText').textContent = text.replace(/^(lỗi|cảnh báo|chú ý)\s*:\s*/i, '');
  $('appMessageIcon').textContent = icon;
  $('appMessageInput').hidden = mode !== 'prompt';
  $('appMessageInput').value = value;
  $('appMessageCancel').hidden = mode === 'message';
  $('appMessageOk').textContent = mode === 'message' ? 'Đã hiểu' : mode === 'confirm' ? 'Xác nhận' : 'Lưu';
  if (dialog.open) dialog.close();
  dialog.showModal();
  requestAnimationFrame(() => (mode === 'prompt' ? $('appMessageInput') : $('appMessageOk'))?.focus());
  return dialog;
}

function showAppMessage(message, requestedType) {
  appDialogResolver = null;
  configureAppDialog(message, { type: requestedType });
}

function showAppConfirm(message, title = 'Xác nhận thao tác') {
  return new Promise(resolve => {
    appDialogResolver = resolve;
    configureAppDialog(message, { type: 'warning', title, mode: 'confirm' });
  });
}

function showAppPrompt(message, value = '', title = 'Nhập thông tin') {
  return new Promise(resolve => {
    appDialogResolver = resolve;
    configureAppDialog(message, { type: 'info', title, mode: 'prompt', value });
  });
}

function closeAppMessage(result = false) {
  const dialog = $('appMessageDialog');
  if (dialog?.open) dialog.close();
  const resolver = appDialogResolver;
  appDialogResolver = null;
  if (resolver) resolver(result);
}

// Replace native Windows alerts so every message belongs visually to HT Vids Studio.
window.alert = message => showAppMessage(message);

document.addEventListener('DOMContentLoaded', () => {
  $('appMessageOk')?.addEventListener('click', () => closeAppMessage($('appMessageDialog')?.dataset.mode === 'prompt' ? $('appMessageInput').value : true));
  $('appMessageCancel')?.addEventListener('click', () => closeAppMessage(false));
  $('appMessageCloseX')?.addEventListener('click', () => closeAppMessage(false));
  $('appMessageInput')?.addEventListener('keydown', event => { if (event.key === 'Enter') closeAppMessage(event.currentTarget.value); });
  $('appMessageDialog')?.addEventListener('click', event => {
    if (event.target === $('appMessageDialog')) closeAppMessage(false);
  });
});

const state = {
  accounts: [],
  videos: [],
  tasks: [],
  selected: new Set(),
  selectedAccounts: new Set(),
  images: [],
  logs: [],
  duration: 10,
  resolution: 720,
  target: 'new',
  ratio: '9:16',
  removeWatermark: true
};

const titles = {
  dashboard: ['Tổng quan', 'Theo dõi tài khoản, hàng đợi và video đã tạo.'],
  create: ['Tạo video', 'Biến ý tưởng của bạn thành những thước phim ấn tượng với AI'],
  queue: ['Hàng đợi', 'Hệ thống tự phân task cho tài khoản đang rảnh.'],
  library: ['Kho video', 'Quản lý toàn bộ video đã tạo.'],
  accounts: ['Tài khoản', 'Quản lý các profile Google độc lập.'],
  logs: ['Nhật ký', 'Theo dõi tiến trình theo thời gian thực.']
};

function showView(name) {
  document.querySelectorAll('.view').forEach(e => e.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(e => e.classList.remove('active'));
  
  const viewEl = $(`view-${name}`);
  const navBtn = document.querySelector(`.nav-item[data-view="${name}"]`);
  if (viewEl) viewEl.classList.add('active');
  if (navBtn) navBtn.classList.add('active');
  
  if (titles[name]) {
    $('pageTitle').textContent = titles[name][0];
    $('pageSubtitle').textContent = titles[name][1];
  }
  
  if (name === 'queue') loadQueue();
  if (name === 'library') loadLibrary();
  if (name === 'accounts') loadAccounts();
  if (name === 'dashboard') loadDashboard();
}

document.querySelectorAll('.nav-item').forEach(b => b.onclick = () => showView(b.dataset.view));
document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => showView(b.dataset.go));

function log(message, p = {}) {
  const line = `${new Date().toLocaleTimeString()} ${p.accountName ? `[${p.accountName}] ` : ''}${message}`;
  state.logs.push(line);
  if (state.logs.length > 500) state.logs.shift();
  if ($('log')) {
    $('log').textContent = state.logs.join('\n') || 'Chưa có tác vụ nào đang chạy.';
    $('log').scrollTop = $('log').scrollHeight;
  }
}

if (window.vidsApp) {
  window.vidsApp.onProgress(p => {
    log(`[${p.stage}] ${p.message}`, p);
    loadAccounts(true);
  });
  window.vidsApp.onQueueUpdated(() => {
    loadQueue();
    loadAccounts();
    loadLibrary();
  });
}

// Render Account Cards in Section 01 matching screenshot exactly
async function loadAccounts(render = true) {
  if (window.vidsApp) {
    const list = await window.vidsApp.listAccounts();
    if (Array.isArray(list)) {
      state.accounts = list;
      const availableIds = new Set(list.map(account => account.id));
      state.selectedAccounts = new Set([...state.selectedAccounts].filter(id => availableIds.has(id)));
    }
  }

  // The queue automatically uses every verified account. Account selection is
  // intentionally not exposed on the Create screen.
  state.selected = new Set(state.accounts.filter(acc => acc.enabled !== false && /^VERIFIED_(STANDARD|PRO|ULTRA|VIDS|UNKNOWN)$/.test(acc.status)).map(acc => acc.id));

  renderAccountPicker();
  if (render && $('accountsList')) renderAccountsManager();
  updateStats();
}

function renderAccountPicker() {
  const box = $('accountPicker');
  if (!box) return;

  const cardsHtml = state.accounts.map(acc => {
    const isSelected = state.selected.has(acc.id);
    const tier = acc.tier || (/PRO/i.test(acc.status) ? 'PRO' : 'PLUS');
    const isGoogle = acc.isGoogle !== false;
    
    const avatarHtml = isGoogle
      ? `<div class="account-avatar google">
           <svg width="20" height="20" viewBox="0 0 24 24">
             <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
             <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
             <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
             <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
           </svg>
         </div>`
      : `<div class="account-avatar">${acc.initial || acc.name[0].toUpperCase()}</div>`;

    return `
      <div class="account-card ${isSelected ? 'selected' : ''}" data-id="${acc.id}">
        <div class="custom-checkbox">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        ${avatarHtml}
        <div class="account-details">
          <div class="account-name-row">
            <span class="account-name">${acc.name}</span>
            <span class="tier-badge ${tier.toLowerCase()}">👑 ${tier}</span>
          </div>
          <div class="account-status-text">
            <span class="status-dot-sm"></span>
            <span>Đang hoạt động</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  const addCardHtml = `
    <div class="account-card-add" id="btnQuickAddAccount">
      <div class="add-icon-circle">+</div>
      <div>
        <strong>Thêm tài khoản</strong>
        <small>Kết nối tài khoản mới</small>
      </div>
    </div>
  `;

  box.innerHTML = cardsHtml + addCardHtml;

  box.querySelectorAll('.account-card').forEach(card => {
    card.onclick = () => {
      const id = card.dataset.id;
      if (state.selected.has(id)) {
        if (state.selected.size > 1) state.selected.delete(id);
      } else {
        state.selected.add(id);
      }
      renderAccountPicker();
    };
  });

  const addBtn = $('btnQuickAddAccount');
  if (addBtn) {
    addBtn.onclick = async () => {
      const name = await showAppPrompt('Nhập tên tài khoản Google AI mới:');
      if (name && name.trim()) {
        const newAcc = { id: 'acc-' + Date.now(), name: name.trim(), status: 'VERIFIED_PRO', tier: 'PRO', isGoogle: true };
        state.accounts.push(newAcc);
        state.selected.add(newAcc.id);
        renderAccountPicker();
      }
    };
  }
}

function renderAccountsManager() {
  const listEl = $('accountsList');
  if (!listEl) return;
  const tierLabel = status => /ULTRA/.test(status) ? 'Ultra' : /PRO/.test(status) ? 'Pro' : /STANDARD|VIDS/.test(status) ? 'Thường' : /UNKNOWN/.test(status) ? 'Không xác định' : 'Chưa xác minh';
  const tierColor = status => /ULTRA/.test(status) ? '#c084fc' : /PRO/.test(status) ? '#60a5fa' : /STANDARD|VIDS/.test(status) ? '#34d399' : '#94a3b8';
  const total = state.accounts.length;
  const ultra = state.accounts.filter(acc => /ULTRA/.test(acc.status)).length;
  const pro = state.accounts.filter(acc => /PRO/.test(acc.status) && !/ULTRA/.test(acc.status)).length;
  const standard = state.accounts.filter(acc => /STANDARD|VIDS/.test(acc.status) && !/PRO|ULTRA/.test(acc.status)).length;
  if ($('accountTotalCount')) $('accountTotalCount').textContent = String(total);
  if ($('accountStandardCount')) $('accountStandardCount').textContent = String(standard);
  if ($('accountProCount')) $('accountProCount').textContent = String(pro);
  if ($('accountUltraCount')) $('accountUltraCount').textContent = String(ultra);
  updateBulkAccountActions();
  listEl.innerHTML = state.accounts.map((acc, index) => `
    <div class="account-manager-row" data-id="${escapeHtml(acc.id)}" style="display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 18px;background:#151e32;border:1px solid var(--border-color);border-radius:10px;margin-bottom:10px;">
      <div style="display:flex;align-items:center;gap:12px;min-width:0;">
        <input type="checkbox" class="account-row-select" data-id="${escapeHtml(acc.id)}" ${state.selectedAccounts.has(acc.id) ? 'checked' : ''} aria-label="Chọn tài khoản ${index + 1}">
        <div class="account-sequence" title="Tài khoản số ${index + 1}">${String(index + 1).padStart(2, '0')}</div>
        <div class="account-avatar google" style="width:32px;height:32px;">G</div>
        <div style="min-width:0;">
          <strong style="color:#fff;font-size:15px;display:block;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(acc.email || 'Chưa đọc được Gmail')}</strong>
          <small style="display:block;color:var(--text-dim);margin-top:3px;">Tên gợi nhớ: ${escapeHtml(acc.name)}</small>
          <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
            <span style="display:inline-flex;padding:3px 9px;border-radius:999px;background:${tierColor(acc.status)}20;color:${tierColor(acc.status)};font-size:11px;font-weight:700;">${tierLabel(acc.status)}</span>
            <span style="color:${acc.enabled === false ? '#fda4af' : 'var(--text-dim)'};font-size:11px;">${acc.enabled === false ? 'Đang tạm tắt' : acc.running ? 'Đang chạy task' : acc.loginProgress ? 'Đang tự động đăng nhập...' : /^VERIFIED_/.test(acc.status) ? 'Sẵn sàng' : 'Cần đăng nhập'}</span>
          </div>
          ${acc.loginProgress ? `<div style="display:flex;align-items:center;gap:7px;margin-top:6px;color:#60a5fa;font-size:12px;font-weight:500;">
            <span style="width:10px;height:10px;border:2px solid #60a5fa;border-top-color:transparent;border-radius:50%;display:inline-block;animation:spin 1s linear infinite;"></span>
            <span>${escapeHtml(acc.loginProgress)}</span>
          </div>` : ''}
          ${acc.planEvidence ? `<small title="${escapeHtml(acc.planEvidence)}" style="display:block;color:var(--text-dim);margin-top:5px;max-width:520px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Nguồn: ${escapeHtml(acc.planEvidence)}</small>` : ''}
          ${acc.loginError && acc.loginError !== acc.disabledReason ? `<small title="${escapeHtml(acc.loginError)}" style="display:block;color:#fda4af;margin-top:5px;max-width:620px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Cần thao tác: ${escapeHtml(acc.loginError)}</small>` : (acc.hasStoredCredentials && !/^VERIFIED_/.test(acc.status) && !acc.loginProgress) ? '<small style="display:block;color:#60a5fa;margin-top:5px;">Sẵn sàng thông tin để tự đăng nhập</small>' : ''}
          ${acc.disabledReason ? `<small title="${escapeHtml(acc.disabledReason)}" style="display:block;color:#fda4af;margin-top:5px;max-width:620px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Lý do tắt: ${escapeHtml(acc.disabledReason)}</small>` : ''}
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
        <button class="btn-secondary account-toggle" data-id="${escapeHtml(acc.id)}" data-enabled="${acc.enabled === false ? 'true' : 'false'}" ${acc.running || acc.loginProgress ? 'disabled' : ''} style="color:${acc.enabled === false ? '#4ade80' : '#fbbf24'};">${acc.enabled === false ? 'Bật tài khoản' : 'Tạm tắt'}</button>
        <button class="btn-secondary account-check" data-id="${escapeHtml(acc.id)}" ${acc.running || acc.loginProgress ? 'disabled' : ''}>${acc.hasStoredCredentials && !/^VERIFIED_/.test(acc.status) ? 'Tự đăng nhập' : 'Kiểm tra'}</button>
        <button class="btn-secondary account-browser" data-id="${escapeHtml(acc.id)}" ${acc.running || acc.loginProgress ? 'disabled' : ''} title="Mở trình duyệt Chrome để đăng nhập trực tiếp">Mở Chrome</button>
        <button class="btn-secondary account-edit" data-id="${escapeHtml(acc.id)}" ${acc.running || acc.loginProgress ? 'disabled' : ''}>Sửa tên</button>
        <button class="btn-secondary account-delete" data-id="${escapeHtml(acc.id)}" ${acc.running || acc.loginProgress ? 'disabled' : ''} style="color:#fda4af;border-color:#7f1d1d;">Xóa</button>
      </div>
    </div>`).join('') || '<div class="empty">Chưa có tài khoản.</div>';
  listEl.querySelectorAll('.account-check').forEach(button => button.onclick = () => checkAccount(button.dataset.id));
  listEl.querySelectorAll('.account-row-select').forEach(checkbox => checkbox.onchange = () => {
    if (checkbox.checked) state.selectedAccounts.add(checkbox.dataset.id);
    else state.selectedAccounts.delete(checkbox.dataset.id);
    updateBulkAccountActions();
  });
  listEl.querySelectorAll('.account-toggle').forEach(button => button.onclick = () => toggleAccount(button.dataset.id, button.dataset.enabled === 'true'));
  listEl.querySelectorAll('.account-browser').forEach(button => button.onclick = () => openBrowserAccount(button.dataset.id));
  listEl.querySelectorAll('.account-edit').forEach(button => button.onclick = () => editAccount(button.dataset.id));
  listEl.querySelectorAll('.account-delete').forEach(button => button.onclick = () => deleteAccount(button.dataset.id));
}

function updateBulkAccountActions() {
  const count = state.selectedAccounts.size;
  if ($('selectedAccountCount')) $('selectedAccountCount').textContent = `Đã chọn: ${count}`;
  ['bulkCheckSelected', 'bulkDisableSelected', 'bulkDeleteSelected'].forEach(id => {
    if ($(id)) $(id).disabled = count === 0;
  });
  if ($('selectAllAccounts')) {
    $('selectAllAccounts').checked = state.accounts.length > 0 && count === state.accounts.length;
    $('selectAllAccounts').indeterminate = count > 0 && count < state.accounts.length;
  }
}

async function runBulkAccountAction(action, successMessage, concurrency = 1) {
  const ids = [...state.selectedAccounts];
  let succeeded = 0;
  const failures = [];
  let cursor = 0;
  const worker = async () => {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      const account = state.accounts.find(item => item.id === id);
      try {
        await action(id, account);
        succeeded += 1;
      } catch (error) {
        failures.push(`${account?.email || account?.name || id}: ${error.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, () => worker()));
  await loadAccounts(true);
  const result = `${successMessage}: ${succeeded}/${ids.length} tài khoản.`;
  alert(failures.length ? `${result}\n\nKhông xử lý được:\n${failures.join('\n')}` : result);
}

if ($('selectAllAccounts')) $('selectAllAccounts').onchange = event => {
  state.selectedAccounts = event.target.checked ? new Set(state.accounts.map(account => account.id)) : new Set();
  renderAccountsManager();
};

if ($('bulkCheckSelected')) $('bulkCheckSelected').onclick = async () => {
  await runBulkAccountAction(id => window.vidsApp.loginAccount(id), 'Đã kiểm tra', 3);
};

if ($('bulkDisableSelected')) $('bulkDisableSelected').onclick = async () => {
  const count = state.selectedAccounts.size;
  if (!await showAppConfirm(`Tạm tắt ${count} tài khoản đã chọn? Các tài khoản này sẽ không nhận task mới.`)) return;
  await runBulkAccountAction(id => window.vidsApp.toggleAccount(id, false), 'Đã tạm tắt');
};

if ($('bulkDeleteSelected')) $('bulkDeleteSelected').onclick = async () => {
  const count = state.selectedAccounts.size;
  if (!await showAppConfirm(`Xóa vĩnh viễn ${count} tài khoản đã chọn?\n\nProfile Chrome của các tài khoản sẽ bị xóa. Lịch sử video vẫn được giữ.`, 'Xóa hàng loạt tài khoản')) return;
  await runBulkAccountAction(id => window.vidsApp.deleteAccount(id), 'Đã xóa');
  state.selectedAccounts = new Set();
  await loadAccounts(true);
};

async function toggleAccount(id, enabled) {
  const account = state.accounts.find(item => item.id === id);
  try {
    await window.vidsApp.toggleAccount(id, enabled);
    await loadAccounts(true);
    log(`${enabled ? 'Đã bật' : 'Đã tạm tắt'} tài khoản.`, { accountName: account?.name });
  } catch (error) {
    alert(`Không thể thay đổi trạng thái tài khoản: ${error.message}`);
  }
}

async function openBrowserAccount(id) {
  const account = state.accounts.find(item => item.id === id);
  if (account?.email) {
    try {
      await navigator.clipboard.writeText(account.email);
      log(`Đã sao chép Email "${account.email}" vào bộ nhớ tạm (Ctrl+V để dán).`, { accountName: account.name });
    } catch {
      // ignore clipboard error
    }
  }
  try {
    log('Đang mở trình duyệt Chrome chuẩn (không automation). Hãy đăng nhập rồi đóng cửa sổ Chrome để lưu vĩnh viễn...', { accountName: account?.name });
    await window.vidsApp.openBrowserLogin(id);
    await loadAccounts(true);
    log('Đăng nhập và lưu phiên thành công.', { accountName: account?.name });
  } catch (error) {
    await loadAccounts(true);
    alert(`Không thể đăng nhập qua Chrome: ${error.message}`);
  }
}

async function checkAccount(id) {
  const account = state.accounts.find(item => item.id === id);
  try {
    log('Đang thực hiện đăng nhập và kiểm tra phiên...', { accountName: account?.name });
    await window.vidsApp.loginAccount(id);
    await loadAccounts(true);
    log('Kiểm tra tài khoản thành công.', { accountName: account?.name });
  } catch (error) {
    await loadAccounts(true);
    alert(`Không thể kiểm tra tài khoản: ${error.message}`);
  }
}

async function editAccount(id) {
  const account = state.accounts.find(item => item.id === id);
  if (!account) return;
  const name = await showAppPrompt('Nhập tên mới cho tài khoản:', account.name, 'Sửa tên tài khoản');
  if (!name || !name.trim() || name.trim() === account.name) return;
  try { await window.vidsApp.renameAccount(id, name.trim()); await loadAccounts(); }
  catch (error) { alert(`Không thể sửa tài khoản: ${error.message}`); }
}

async function deleteAccount(id) {
  const account = state.accounts.find(item => item.id === id);
  if (!account) return;
  if (!await showAppConfirm(`Xóa tài khoản "${account.name}"?\n\nProfile Chrome riêng sẽ bị xóa. Lịch sử video đã hoàn thành vẫn được giữ.`, 'Xóa tài khoản')) return;
  try {
    await window.vidsApp.deleteAccount(id);
    state.selected.delete(id);
    await Promise.all([loadAccounts(), loadQueue()]);
  } catch (error) { alert(`Không thể xóa tài khoản: ${error.message}`); }
}

if ($('addAccount')) $('addAccount').onclick = async () => {
  const input = $('accountName');
  try {
    const account = await window.vidsApp.addAccount(input?.value?.trim() || '');
    if (input) input.value = '';
    state.selected.add(account.id);
    await loadAccounts();
    await checkAccount(account.id);
  } catch (error) { alert(`Không thể thêm tài khoản: ${error.message}`); }
};

function parseBulkAccounts(value) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const valid = [];
  const errors = [];
  String(value || '').split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line) return;
    let parts = [];
    if (line.includes('|')) parts = line.split('|').map(s => s.trim());
    else if (line.includes('\t')) parts = line.split('\t').map(s => s.trim());
    else if (line.includes(',')) parts = line.split(',').map(s => s.trim());
    else if (line.includes(':')) parts = line.split(':').map(s => s.trim());
    else parts = line.split(/\s+/).map(s => s.trim());
    parts = parts.filter(Boolean);
    if (parts.length < 2) {
      errors.push(`Dòng ${index + 1}: cần ít nhất Email và Mật khẩu.`);
      return;
    }
    if (!emailRegex.test(parts[0])) {
      errors.push(`Dòng ${index + 1}: định dạng email không hợp lệ ("${parts[0]}").`);
      return;
    }
    const email = parts[0].toLowerCase();
    const password = parts[1];
    let totpSecret = undefined;
    let recoveryEmail = undefined;
    for (const rem of parts.slice(2)) {
      if (emailRegex.test(rem)) {
        recoveryEmail = rem.toLowerCase();
      } else {
        const clean = rem.replace(/\s+/g, '');
        if (/^[A-Za-z2-7]{10,}$/.test(clean) || (!totpSecret && clean.length >= 8)) {
          totpSecret = clean.toUpperCase();
        } else if (rem.includes('@')) {
          recoveryEmail = rem.toLowerCase();
        }
      }
    }
    valid.push({ email, password, totpSecret, recoveryEmail });
  });
  return { valid, errors };
}

function updateBulkPreview() {
  const result = parseBulkAccounts($('bulkAccountsInput')?.value);
  const countWith2Fa = result.valid.filter(x => x.totpSecret).length;
  if ($('bulkParseResult')) {
    if (!result.valid.length && !result.errors.length) {
      $('bulkParseResult').innerHTML = '<span>Chưa có dữ liệu.</span>';
    } else {
      $('bulkParseResult').innerHTML = `<strong>${result.valid.length} tài khoản hợp lệ</strong>${countWith2Fa ? ` <span style="color:#60a5fa">(${countWith2Fa} có mã 2FA TOTP)</span>` : ''}${result.errors.length ? `<span style="color:#fda4af"> · ${escapeHtml(result.errors.join(' · '))}</span>` : ' · <span style="color:#86efac">Sẵn sàng tự động đăng nhập. Tài khoản lỗi sẽ tự xóa.</span>'}`;
    }
  }
  if ($('confirmBulkAccounts')) $('confirmBulkAccounts').disabled = !result.valid.length || !!result.errors.length;
}

if ($('openBulkAccounts')) $('openBulkAccounts').onclick = () => {
  $('bulkAccountsInput').value = '';
  updateBulkPreview();
  $('bulkAccountsDialog').showModal();
  $('bulkAccountsInput').focus();
};

if ($('btnQuickSample')) $('btnQuickSample').onclick = () => {
  const sample = `email1@gmail.com | matkhau1 | JBSWY3DPEHPK3PXP\nemail2@gmail.com:matkhau2:4S654S654S654S65\nemail3@gmail.com\tmatkhau3\tJBSWY3DPEHPK3PXP\trecovery@gmail.com`;
  if ($('bulkAccountsInput')) {
    $('bulkAccountsInput').value = sample;
    updateBulkPreview();
    $('bulkAccountsInput').focus();
  }
};

if ($('btnBulkClear')) $('btnBulkClear').onclick = () => {
  if ($('bulkAccountsInput')) {
    $('bulkAccountsInput').value = '';
    updateBulkPreview();
  }
};

if ($('bulkAccountsInput')) $('bulkAccountsInput').addEventListener('input', updateBulkPreview);

if ($('confirmBulkAccounts')) $('confirmBulkAccounts').onclick = async () => {
  const result = parseBulkAccounts($('bulkAccountsInput').value);
  if (!result.valid.length || result.errors.length) return updateBulkPreview();
  const button = $('confirmBulkAccounts');
  button.disabled = true;
  button.textContent = 'Đang thêm...';
  try {
    const response = await window.vidsApp.bulkAddAccounts(result.valid);
    $('bulkAccountsDialog').close();
    await loadAccounts(true);
    log(`[ACCOUNT] Đã nhận ${response.total || response.added} tài khoản. Hệ thống đang tự động đăng nhập & điền 2FA. Tất cả tài khoản và phiên đăng nhập được lưu trữ an toàn.`);
    alert(`Đã nhận ${response.total || response.added} tài khoản!\n\nChrome sẽ tự mở từng profile, tự điền email, mật khẩu và tự sinh mã 2FA TOTP.\nTất cả tài khoản và phiên đăng nhập được lưu vĩnh viễn trên máy của bạn.`);
  } catch (error) {
    alert(`Không thể thêm hàng loạt: ${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = 'Thêm & Tự động đăng nhập';
  }
};

if ($('bulkLoginAccountsBtn')) $('bulkLoginAccountsBtn').onclick = async () => {
  const btn = $('bulkLoginAccountsBtn');
  btn.disabled = true;
  btn.textContent = 'Đang khởi động...';
  try {
    const res = await window.vidsApp.bulkLoginAccounts();
    alert(res.message);
    await loadAccounts(true);
  } catch (err) {
    alert(`Lỗi đăng nhập: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Tự đăng nhập tất cả';
  }
};

// Character counter & Prompt logic
const promptArea = $('firstPrompt');
const charCounter = $('charCount');
if (promptArea && charCounter) {
  const updateCount = () => {
    charCounter.textContent = `${promptArea.value.length}/5000`;
  };
  promptArea.addEventListener('input', updateCount);
  updateCount();
}

// Quick Suggestion Tags
document.querySelectorAll('.tag-btn').forEach(btn => {
  btn.onclick = () => {
    const tag = btn.dataset.tag || btn.textContent.trim();
    if (promptArea) {
      const prefix = promptArea.value.trim() ? promptArea.value.trim() + ', ' : '';
      promptArea.value = `${prefix}Phong cách ${tag}`;
      if (charCounter) charCounter.textContent = `${promptArea.value.length}/5000`;
      promptArea.focus();
    }
  };
});

// Reference Images Thumbnails Strip
function renderThumbnails() {
  const strip = $('thumbnailStrip');
  const countBadge = $('imgCountBadge');
  if (!strip) return;

  const thumbsHtml = state.images.map((filePath, idx) => `
    <div class="thumb-wrap">
      <img src="${toFileUrl(filePath)}" class="thumb-preview" alt="${escapeHtml(filePath.split(/[\\/]/).pop())}" title="${escapeHtml(filePath)}">
      <button type="button" class="thumb-remove" data-idx="${idx}" title="Xóa">×</button>
    </div>
  `).join('');

  const addBtnHtml = `
    <button type="button" class="btn-add-thumb" id="btnAddThumb">
      <span>+</span>
      <small>Thêm ảnh</small>
    </button>
  `;

  strip.innerHTML = thumbsHtml + addBtnHtml;
  if (countBadge) countBadge.textContent = `${state.images.length}/3`;

  strip.querySelectorAll('.thumb-remove').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      state.images.splice(Number(btn.dataset.idx), 1);
      if ($('images')) $('images').value = state.images.join('; ');
      renderThumbnails();
    };
  });

  const btnAdd = $('btnAddThumb');
  if (btnAdd) {
    btnAdd.onclick = pickImages;
  }
}

async function pickImages() {
  if (window.vidsApp) {
    const chosen = await window.vidsApp.chooseImages();
    if (chosen && chosen.length) {
      state.images = [...new Set([...state.images, ...chosen])].slice(0, 3);
      $('images').value = state.images.join('; ');
      renderThumbnails();
    }
  }
}

if ($('pickImages')) {
  $('pickImages').onclick = pickImages;
  $('pickImages').ondragover = event => { event.preventDefault(); $('pickImages').classList.add('drag-over'); };
  $('pickImages').ondragleave = () => $('pickImages').classList.remove('drag-over');
  $('pickImages').ondrop = async event => {
    event.preventDefault();
    $('pickImages').classList.remove('drag-over');
    const files = [...event.dataTransfer.files].filter(file => /^image\/(png|jpeg|webp)$/i.test(file.type));
    const paths = window.vidsApp?.getPathsForFiles ? await window.vidsApp.getPathsForFiles(files) : files.map(file => file.path).filter(Boolean);
    state.images = [...new Set([...state.images, ...paths])].slice(0, 3);
    if ($('images')) $('images').value = state.images.join('; ');
    renderThumbnails();
  };
}

// Collapsible Advanced Options
const advToggle = $('btnAdvancedToggle');
const advContent = $('advancedContent');
const chevron = $('chevronIcon');
if (advToggle && advContent) {
  advToggle.onclick = () => {
    const isHidden = advContent.style.display === 'none';
    advContent.style.display = isHidden ? 'block' : 'none';
    if (chevron) {
      chevron.style.transform = isHidden ? 'rotate(180deg)' : 'none';
    }
  };
}

if ($('videoRatio')) {
  $('videoRatio').onchange = event => { state.ratio = event.target.value || '9:16'; };
}

// Supported generation totals: 5/10 seconds, or 15/20 via one Extend.
if ($('videoDuration')) {
  $('videoDuration').onchange = event => { state.duration = Number(event.target.value || 10); };
}
if ($('videoResolution')) {
  $('videoResolution').onchange = event => { state.resolution = Number(event.target.value || 720); };
}
if ($('removeWatermark')) {
  $('removeWatermark').onchange = event => { state.removeWatermark = event.target.checked; };
}

// Browse Output Folder
if ($('pickOutput')) {
  $('pickOutput').onclick = async () => {
    if (window.vidsApp) {
      const folder = await window.vidsApp.chooseFolder();
      if (folder) $('output').value = folder;
    } else {
      alert('Thư mục xuất mặc định: d:/tools/HT_Studio/HT_VidsGG/downloads');
    }
  };
}

async function refreshTaskName() {
  if (window.vidsApp?.getNextTaskName) {
    try {
      const name = await window.vidsApp.getNextTaskName();
      if ($('filename')) $('filename').value = name;
      return name;
    } catch (e) {
      console.warn('Lỗi lấy tên task mới:', e);
    }
  }
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const rnd = Math.random().toString(36).substring(2, 8);
  const fallback = `task-1-${y}${m}${d}_${rnd}.mp4`;
  if ($('filename')) $('filename').value = fallback;
  return fallback;
}

if ($('btnRefreshTaskName')) {
  $('btnRefreshTaskName').onclick = () => refreshTaskName();
}

// Submit as a draft for review, or enqueue immediately for an idle account.
async function submitTask(autoStart) {
    const promptText = $('firstPrompt') ? $('firstPrompt').value.trim() : '';
    if (!promptText) {
      return alert('Vui lòng nhập mô tả kịch bản video.');
    }

    let taskFilename = $('filename') ? $('filename').value.trim() : '';
    if (!taskFilename) {
      taskFilename = await refreshTaskName();
    }

    const payload = {
      autoStart,
      accountIds: state.accounts.filter(acc => acc.enabled !== false && /^VERIFIED_(STANDARD|PRO|ULTRA|VIDS|UNKNOWN)$/.test(acc.status)).map(acc => acc.id),
      config: {
        projectUrl: '',
        firstPrompt: promptText,
        secondPrompt: $('secondPrompt') ? $('secondPrompt').value.trim() || promptText : promptText,
        imagePaths: state.images,
        outputDirectory: $('output') ? $('output').value : '',
        filename: taskFilename,
        aspectRatio: state.ratio,
        durationSeconds: state.duration,
        resolution: state.resolution,
        removeWatermark: $('removeWatermark') ? $('removeWatermark').checked : true
      }
    };

    try {
      ['runJobs', 'addToQueue'].forEach(id => { if ($(id)) { $(id).disabled = true; $(id).style.opacity = '0.6'; } });
      
      if (window.vidsApp) {
        const task = await window.vidsApp.enqueue(payload);
        log(`${autoStart ? 'Đã chạy ngay' : 'Đã lưu bản nháp'} task ${task.config?.filename || task.id?.slice(0, 8) || ''}.`);
      } else {
        log(`Đã thêm task ${payload.config.filename} vào hàng đợi (Xem trước).`);
      }
      
      $('firstPrompt').value = '';
      if ($('secondPrompt')) $('secondPrompt').value = '';
      state.images = [];
      if ($('images')) $('images').value = '';
      if ($('charCount')) $('charCount').textContent = '0/5000';
      renderThumbnails();
      // Tự động sinh tên cho task tiếp theo theo định dạng task-X-ngàytạo_mãrandom.mp4
      await refreshTaskName();
      alert(autoStart ? 'Task đã được đưa vào hàng chờ chạy tự động.' : 'Đã thêm bản nháp. Hãy kiểm tra tại Hàng đợi rồi bấm Chạy.');
      showView('queue');
    } catch (e) {
      alert('Lỗi: ' + e.message);
    } finally {
      ['runJobs', 'addToQueue'].forEach(id => { if ($(id)) { $(id).disabled = false; $(id).style.opacity = '1'; } });
    }
}
if ($('runJobs')) $('runJobs').onclick = () => submitTask(true);
if ($('addToQueue')) $('addToQueue').onclick = () => submitTask(false);

// Sample Prompt button -> Nạp kịch bản chuẩn 20s (Emily & Jack)
const PRESET_FIRST_PROMPT = `Create the FIRST 10 seconds of a continuous 20-second photorealistic U.S. Army drama. Portrait 9:16. Fast, readable action with realistic momentum, natural body weight and synchronized American English dialogue.

REFERENCE BINDING: @Image1 defines Emily Carter’s exact face, dark low bun, athletic build, olive-green shirt, camouflage trousers and black boots. @Image2 defines Jack Miller’s exact face, short blond hair, muscular physique, olive-green shirt, camouflage trousers and tan boots. @Image3 defines the exact training room, lighting and FOUR supporting soldiers.

ACTION TIMING:
0–2 seconds: Emily stands screen-left and offers her RIGHT hand. Jack, screen-right, sharply knocks it aside and sneers, “Try not to cry.” Emily immediately raises her guard.
2–6 seconds: Jack advances with two quick punches. Emily redirects with her raised forearm, turns with his momentum into one decisive takedown. Show complete movement and landing.
6–7 seconds: Emily releases him and steps back. One sharp whistle sounds from captain offscreen-right.
7–10 seconds: Jack rises. Both standing, three-quarter view. Preserve this frame for next clip.`;

const PRESET_SECOND_PROMPT = `Create the FINAL 10 seconds of the same continuous 20-second military drama. Portrait 9:16, photorealistic live-action cinematography.

REFERENCE BINDING: @Image1 is the FINAL FRAME OF CLIP 1. Use it to preserve Emily and Jack’s exact identities, clothing, positions and camera direction. @Image2 defines Captain David Hayes. @Image3 defines the unchanged room.

START EXACTLY FROM @Image1: Emily stands foreground-left with guard lowered. Jack stands one step behind and to her right.
ACTION TIMING:
0–4 seconds: Jack steps forward, grabs Emily's shoulder. She reacts immediately, blocks and executes a decisive takedown. Jack taps out twice. She releases him.
4–7 seconds: Emily rises: “Whistle means stop.” Captain Hayes enters from right: “That’s your instructor. Off the mat.”
7–10 seconds: Emily offers her hand. Jack accepts, rises, lowers gaze and steps away.`;

function loadOriginalPreset() {
  if (promptArea) {
    promptArea.value = PRESET_FIRST_PROMPT;
    if (charCounter) charCounter.textContent = `${promptArea.value.length}/5000`;
  }
  const secondPromptArea = $('secondPrompt');
  if (secondPromptArea) {
    secondPromptArea.value = PRESET_SECOND_PROMPT;
  }
  const advContent = $('advancedContent');
  if (advContent) advContent.style.display = 'block';
  const chevron = $('chevronIcon');
  if (chevron) chevron.style.transform = 'rotate(180deg)';

  if (!$('filename') || !$('filename').value.trim() || !/^task-/i.test($('filename').value)) {
    void refreshTaskName();
  }
  
  renderThumbnails();
  alert('Đã nạp kịch bản mẫu. Hãy tự chọn tối đa 3 ảnh tham chiếu nếu cần.');
}

if ($('btnSamplePrompt')) {
  $('btnSamplePrompt').onclick = loadOriginalPreset;
}


// Task Inspector Detail Renderer (Cột phải)
function renderTaskDetail(task) {
  const container = $('queueDetailContent');
  if (!container) return;

  if (!task) {
    container.innerHTML = `
      <div class="inspector-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect>
          <line x1="8" y1="7" x2="16" y2="7"></line>
          <line x1="8" y1="12" x2="16" y2="12"></line>
          <line x1="8" y1="17" x2="13" y2="17"></line>
        </svg>
        <h4>Chưa có tác vụ nào được chọn</h4>
        <p>Nhấp vào một task ở danh sách bên trái hoặc bấm "Kiểm tra" để xem chi tiết kịch bản prompt, ảnh tham chiếu và cấu hình.</p>
      </div>
    `;
    return;
  }

  const isReadOnly = (task.status === 'running');
  const progress = task.status === 'completed' ? 100 : Math.max(0, Math.min(100, Number(task.progress || 0)));
  const images = task.config?.imagePaths || [];
  const statusVi = statusLabel(task.status);

  const currentRatio = task.config?.aspectRatio || '9:16';
  const currentRes = Number(task.config?.resolution || 720);
  const currentDuration = Number(task.config?.durationSeconds || 10);
  const firstPrompt = task.config?.firstPrompt || '';
  const secondPrompt = task.config?.secondPrompt || '';

  container.innerHTML = `
    <div class="inspector-header">
      <div class="inspector-title-row">
        <div>
          <h3 class="inspector-title">${escapeHtml(task.config?.filename || 'Tác vụ chưa đặt tên')}</h3>
          <div style="display:flex;align-items:center;gap:8px;margin-top:5px;flex-wrap:wrap;">
            <span class="queue-card-badge ${escapeHtml(task.status)}">${escapeHtml(statusVi)}</span>
            <span style="font-size:11.5px;color:var(--text-dim);">Tài khoản: <b style="color:#cbd5e1;">${escapeHtml(task.assignedAccountName || 'Tự động phân phối')}</b></span>
            ${task.config?.removeWatermark !== false ? '<span style="font-size:11px;color:#4ade80;background:rgba(34,197,94,0.12);padding:2px 7px;border-radius:4px;border:1px solid rgba(34,197,94,0.25);">✨ Delogo xóa logo AI</span>' : ''}
          </div>
        </div>
      </div>

      <div style="margin-top: 14px;">
        <div class="queue-card-progress" style="height: 6px;">
          <div class="queue-card-progress-bar ${escapeHtml(task.status)}" style="width: ${progress}%;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-dim);margin-top:5px;">
          <span>${escapeHtml(task.progressMessage || (task.status === 'waiting' ? 'Đang chờ tài khoản rảnh' : task.status))}</span>
          <span style="font-weight:600;color:#cbd5e1;">${progress}%</span>
        </div>
      </div>
    </div>

    <!-- Mục 1: Chỉnh sửa thông số Video (Kích thước, Độ phân giải, Độ dài) -->
    <div class="inspector-edit-section">
      <div class="inspector-section-label" style="margin-bottom: 10px;">
        <span>⚙️ Thông số video (Có thể thay đổi)</span>
        <span style="font-size: 11px; text-transform: none; color: var(--text-dim); font-weight: normal;">
          ${isReadOnly ? 'Đang chạy (không thể sửa)' : 'Chỉnh sửa rồi bấm Lưu hoặc Chạy lại'}
        </span>
      </div>
      <div class="edit-form-grid">
        <div class="edit-form-field">
          <label class="edit-form-label" for="editTaskRatio">Tỷ lệ khung hình</label>
          <select id="editTaskRatio" class="edit-select" ${isReadOnly ? 'disabled' : ''}>
            <option value="9:16" ${currentRatio === '9:16' ? 'selected' : ''}>Dọc 9:16 (1080×1920)</option>
            <option value="16:9" ${currentRatio === '16:9' ? 'selected' : ''}>Ngang 16:9 (1920×1080)</option>
          </select>
        </div>
        <div class="edit-form-field">
          <label class="edit-form-label" for="editTaskResolution">Độ phân giải AI</label>
          <select id="editTaskResolution" class="edit-select" ${isReadOnly ? 'disabled' : ''}>
            <option value="720" ${currentRes === 720 ? 'selected' : ''}>720p (Chuẩn tương thích cao)</option>
            <option value="1080" ${currentRes === 1080 ? 'selected' : ''}>1080p (Chất lượng cao)</option>
          </select>
        </div>
        <div class="edit-form-field">
          <label class="edit-form-label" for="editTaskDuration">Thời lượng video</label>
          <select id="editTaskDuration" class="edit-select" ${isReadOnly ? 'disabled' : ''}>
            <option value="5" ${currentDuration === 5 ? 'selected' : ''}>5 giây</option>
            <option value="10" ${currentDuration === 10 ? 'selected' : ''}>10 giây</option>
            <option value="15" ${currentDuration === 15 ? 'selected' : ''}>15 giây</option>
            <option value="20" ${currentDuration === 20 ? 'selected' : ''}>20 giây</option>
          </select>
        </div>
        <div class="edit-form-field" style="grid-column: 1 / -1; margin-top: 2px;">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:var(--text);user-select:none;">
            <input type="checkbox" id="editTaskRemoveWatermark" ${task.config?.removeWatermark !== false ? 'checked' : ''} ${isReadOnly ? 'disabled' : ''} style="width:16px;height:16px;accent-color:var(--primary, #6366f1);cursor:pointer;">
            <span>✨ Tự động xóa watermark Google AI (Delogo inpainting • không cắt xén video)</span>
          </label>
        </div>
      </div>
    </div>

    <!-- Mục 2: Chỉnh sửa Kịch bản Prompt 1 -->
    <div>
      <div class="inspector-section-label">
        <span>Kịch bản video chính (Clip đầu 0-10s)</span>
        <button type="button" class="btn-copy-prompt" data-copy="prompt1">📋 Sao chép</button>
      </div>
      <textarea id="editFirstPrompt" class="edit-prompt-textarea" rows="4" placeholder="Nhập mô tả kịch bản video..." ${isReadOnly ? 'disabled' : ''}>${escapeHtml(firstPrompt)}</textarea>
    </div>

    <!-- Mục 3: Chỉnh sửa Kịch bản Prompt Extend (nếu có hoặc nếu thời lượng > 10s) -->
    <div id="wrapSecondPrompt" style="${currentDuration > 10 || secondPrompt ? 'display:block;' : 'display:none;'}">
      <div class="inspector-section-label">
        <span>Kịch bản nối tiếp (Clip Extend 10-20s)</span>
        <button type="button" class="btn-copy-prompt" data-copy="prompt2">📋 Sao chép</button>
      </div>
      <textarea id="editSecondPrompt" class="edit-prompt-textarea" rows="3" placeholder="Nhập mô tả kịch bản đoạn nối tiếp..." ${isReadOnly ? 'disabled' : ''}>${escapeHtml(secondPrompt || firstPrompt)}</textarea>
    </div>

    <!-- Mục 4: Ảnh tham chiếu -->
    <div>
      <div class="inspector-section-label">
        <span>Ảnh tham chiếu (${images.length}/3)</span>
      </div>
      ${images.length ? `
        <div class="ref-thumbnails-grid">
          ${images.map((imgPath, idx) => `
            <div class="ref-thumb-card" title="${escapeHtml(imgPath)}">
              <img src="${toFileUrl(imgPath)}" alt="Ảnh tham chiếu ${idx + 1}">
              <span class="ref-thumb-label">@Image${idx + 1}</span>
            </div>
          `).join('')}
        </div>
      ` : `
        <div style="font-size: 12px; color: var(--text-dim); padding: 8px 0;">Không sử dụng ảnh tham chiếu.</div>
      `}
    </div>

    <!-- Mục 5: Báo lỗi nếu task thất bại -->
    ${task.error ? `
      <div class="inspector-error-box">
        <strong>⚠️ Tác vụ gặp lỗi khi thực hiện:</strong>
        ${escapeHtml(task.error)}
        <div style="margin-top: 6px; font-size: 11px; color: #fca5a5;">
          💡 Gợi ý: Hãy đổi Độ phân giải từ 1080p sang <b>720p</b> hoặc chỉnh sửa lại kịch bản rồi bấm <b>"Lưu & Chạy lại"</b> bên dưới.
        </div>
      </div>
    ` : ''}

    <!-- Mục 6: Thanh hành động Action Bar -->
    <div class="inspector-action-bar">
      <div style="margin-right: auto; display: flex; gap: 8px;">
        <button type="button" class="btn-danger" id="btnDeleteTaskBottom" ${isReadOnly ? 'disabled' : ''}>
          🗑️ Xóa task
        </button>
      </div>

      ${task.status === 'completed' && task.outputPath ? `
        <button class="btn-secondary queue-open" data-path="${escapeHtml(task.outputPath)}" style="min-height:38px;">
          ▶ Xem video
        </button>
        <button class="btn-secondary queue-folder" data-path="${escapeHtml(task.outputPath)}" style="min-height:38px;">
          📁 Mở thư mục
        </button>
      ` : ''}

      ${!isReadOnly ? `
        <button type="button" class="btn-save-task" id="btnSaveTaskOnly" title="Lưu cấu hình và prompt mới vào task">
          💾 Lưu thay đổi
        </button>
      ` : ''}

      ${task.status === 'failed' || task.status === 'draft' ? `
        <button type="button" class="btn-save-retry" id="btnSaveAndRetryTask" title="Lưu thông số mới và chạy lại ngay">
          ${task.status === 'draft' ? '▶ Lưu & Bắt đầu chạy' : '🔄 Lưu & Chạy lại task'}
        </button>
      ` : ''}
    </div>
  `;

  // Tự động ẩn/hiện ô Prompt 2 khi đổi thời lượng
  const durationSelect = $('editTaskDuration');
  if (durationSelect) {
    durationSelect.onchange = () => {
      const dur = Number(durationSelect.value);
      const wrap = $('wrapSecondPrompt');
      if (wrap) {
        wrap.style.display = dur > 10 ? 'block' : 'none';
      }
    };
  }

  // Hàm thực hiện lưu thay đổi (kèm chạy lại nếu retryNow = true)
  async function saveTaskConfig(retryNow = false) {
    const ratio = $('editTaskRatio')?.value || '9:16';
    const resolution = Number($('editTaskResolution')?.value || 720);
    const durationSeconds = Number($('editTaskDuration')?.value || 10);
    const removeWatermark = $('editTaskRemoveWatermark') ? $('editTaskRemoveWatermark').checked : true;
    const prompt1 = $('editFirstPrompt')?.value.trim() || '';
    const prompt2 = $('editSecondPrompt')?.value.trim() || prompt1;

    if (!prompt1) {
      alert('Kịch bản video chính không được để trống.');
      return;
    }

    const btn = retryNow ? $('btnSaveAndRetryTask') : $('btnSaveTaskOnly');
    const oldText = btn ? btn.textContent : '';
    if (btn) {
      btn.disabled = true;
      btn.textContent = retryNow ? 'Đang đưa vào hàng chờ...' : 'Đang lưu...';
    }

    try {
      await window.vidsApp?.updateTask({
        taskId: task.id,
        config: {
          aspectRatio: ratio,
          resolution,
          durationSeconds,
          removeWatermark,
          firstPrompt: prompt1,
          secondPrompt: prompt2
        },
        retryNow
      });
      await loadQueue();
      if (!retryNow) {
        alert('Đã cập nhật thông số và kịch bản cho task thành công!');
      } else {
        log(`Đã cập nhật cấu hình và đưa task ${task.config?.filename || task.id.slice(0, 8)} vào hàng chờ chạy lại.`);
      }
    } catch (e) {
      alert('Không thể cập nhật task: ' + e.message);
      if (btn) {
        btn.disabled = false;
        btn.textContent = oldText;
      }
    }
  }

  // Hàm xóa task
  async function deleteTaskItem() {
    if (!await showAppConfirm(`Xóa task "${task.config?.filename || task.id}" khỏi hàng đợi?`, 'Xóa task')) return;
    try {
      await window.vidsApp?.deleteTask(task.id);
      state.selectedTaskId = null;
      await loadQueue();
    } catch (e) {
      alert('Không thể xóa task: ' + e.message);
    }
  }

  // Gắn sự kiện các nút
  if ($('btnSaveTaskOnly')) $('btnSaveTaskOnly').onclick = () => saveTaskConfig(false);
  if ($('btnSaveAndRetryTask')) $('btnSaveAndRetryTask').onclick = () => saveTaskConfig(true);
  if ($('btnDeleteTaskBottom')) $('btnDeleteTaskBottom').onclick = deleteTaskItem;

  // Gắn sự kiện copy prompt
  container.querySelectorAll('.btn-copy-prompt').forEach(btn => {
    btn.onclick = () => {
      const type = btn.dataset.copy;
      const text = type === 'prompt1' ? $('editFirstPrompt')?.value : $('editSecondPrompt')?.value;
      if (text) {
        navigator.clipboard.writeText(text);
        const originalText = btn.textContent;
        btn.textContent = '✓ Đã chép!';
        setTimeout(() => { btn.textContent = originalText; }, 1500);
      }
    };
  });

  // Gắn sự kiện mở video / mở thư mục
  container.querySelectorAll('.queue-open').forEach(btn => {
    btn.onclick = () => window.vidsApp?.openFile(btn.dataset.path);
  });
  container.querySelectorAll('.queue-folder').forEach(btn => {
    btn.onclick = () => window.vidsApp?.revealFile(btn.dataset.path);
  });
}

// Queue, Library, and Stats Loaders
async function loadQueue() {
  const queueList = $('queueList');
  if (!queueList) return;

  let tasks = [];
  if (window.vidsApp) {
    tasks = await window.vidsApp.listQueue();
  }
  state.tasks = tasks;
  
  const activeCount = tasks.filter(t => ['draft', 'running', 'waiting'].includes(t.status)).length;
  if ($('queueCount')) $('queueCount').textContent = activeCount;
  if (typeof updateNotificationsBadge === 'function') updateNotificationsBadge();

  if (!tasks.length) {
    queueList.innerHTML = '<div class="empty" style="padding: 40px 15px; text-align: center;">Chưa có tác vụ nào trong hàng đợi.</div>';
    renderTaskDetail(null);
    if (typeof updateNotificationsBadge === 'function') updateNotificationsBadge();
    return;
  }

  // Tự động chọn task đầu tiên nếu chưa chọn hoặc task đang chọn không còn tồn tại
  if (!state.selectedTaskId || !tasks.some(t => t.id === state.selectedTaskId)) {
    state.selectedTaskId = tasks[0].id;
  }

  const statusIcons = {
    completed: '✓',
    running: '▶',
    waiting: '…',
    failed: '!',
    draft: '✎'
  };

  queueList.innerHTML = tasks.map(t => {
    const isSelected = (t.id === state.selectedTaskId);
    const progress = t.status === 'completed' ? 100 : Math.max(0, Math.min(100, Number(t.progress || 0)));
    const statusVi = statusLabel(t.status);
    const icon = statusIcons[t.status] || '…';

    return `
      <div class="queue-card ${isSelected ? 'active' : ''}" data-task-id="${escapeHtml(t.id)}">
        <div class="queue-card-top">
          <div class="queue-status-icon ${escapeHtml(t.status)}">${icon}</div>
          <div class="queue-card-title-wrap">
            <span class="queue-card-name" title="${escapeHtml(t.config?.filename || '')}">${escapeHtml(t.config?.filename || 'Tác vụ chưa đặt tên')}</span>
            <span class="queue-card-badge ${escapeHtml(t.status)}">${escapeHtml(statusVi)}</span>
          </div>
        </div>
        <div class="queue-card-progress">
          <div class="queue-card-progress-bar ${escapeHtml(t.status)}" style="width: ${progress}%;"></div>
        </div>
        <div class="queue-card-meta">
          <span>${escapeHtml(t.assignedAccountName || 'Tự động')} • ${escapeHtml(t.config?.aspectRatio || '9:16')}</span>
          <div class="queue-card-actions">
            <span class="queue-btn-inspect">Kiểm tra →</span>
            <button type="button" class="queue-card-delete-quick" data-del-id="${escapeHtml(t.id)}" title="Xóa task này">✕</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Render chi tiết task đang chọn ở cột phải
  const currentTask = tasks.find(t => t.id === state.selectedTaskId) || tasks[0];
  renderTaskDetail(currentTask || null);

  // Click vào card để kiểm tra task đó và kích hoạt highlight
  queueList.querySelectorAll('.queue-card').forEach(card => {
    card.onclick = () => {
      const taskId = card.dataset.taskId;
      state.selectedTaskId = taskId;
      queueList.querySelectorAll('.queue-card').forEach(c => {
        c.classList.toggle('active', c.dataset.taskId === taskId);
      });
      const selected = state.tasks.find(t => t.id === taskId);
      renderTaskDetail(selected || null);
    };
  });

  // Bắt sự kiện xóa nhanh trên từng card
  queueList.querySelectorAll('.queue-card-delete-quick').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const delId = btn.dataset.delId;
      const target = state.tasks.find(t => t.id === delId);
      if (!await showAppConfirm(`Xóa task "${target?.config?.filename || delId}" khỏi hàng đợi?`, 'Xóa task')) return;
      try {
        await window.vidsApp?.deleteTask(delId);
        if (state.selectedTaskId === delId) {
          state.selectedTaskId = null;
        }
        await loadQueue();
      } catch (err) {
        alert('Không thể xóa task: ' + err.message);
      }
    };
  });
}

if ($('refreshQueue')) {
  $('refreshQueue').onclick = () => loadQueue();
}

// Video Inspector Renderer (Cột phải Kho video)
function renderVideoDetail(video) {
  const container = $('libraryDetailContent');
  if (!container) return;

  if (!video) {
    container.innerHTML = `
      <div class="inspector-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
        <h4>Chưa chọn video nào</h4>
        <p>Nhấp vào một video trong danh sách bên trái để phát và quan sát chi tiết.</p>
      </div>
    `;
    return;
  }

  const filename = video.outputPath?.split(/[\\/]/).pop() || 'video.mp4';
  const matchedTask = (state.tasks || []).find(t => 
    (t.outputPath && t.outputPath === video.outputPath) ||
    (t.videoId && t.videoId === video.id) ||
    (t.config?.filename && video.outputPath && video.outputPath.endsWith(t.config.filename))
  );

  const resText = (video.width && video.height) ? `${video.width} × ${video.height}` : (matchedTask?.config?.resolution ? `${matchedTask.config.resolution}p` : '1080 × 1920');
  const ratioText = (video.width && video.height) ? (video.width < video.height ? 'Dọc 9:16' : 'Ngang 16:9') : (matchedTask?.config?.aspectRatio || '9:16');
  const durSec = Number(video.duration || matchedTask?.config?.durationSeconds || 10).toFixed(1);
  const prompt1 = matchedTask?.config?.firstPrompt || '';
  const prompt2 = matchedTask?.config?.secondPrompt || '';
  const images = matchedTask?.config?.imagePaths || [];

  container.innerHTML = `
    <!-- 1. Header chi tiết video -->
    <div class="inspector-header" style="flex-shrink:0;">
      <div class="inspector-title-row">
        <div>
          <h3 class="inspector-title">${escapeHtml(filename)}</h3>
          <div style="display:flex;align-items:center;gap:8px;margin-top:5px;flex-wrap:wrap;">
            <span class="queue-card-badge completed">Hoàn tất</span>
            <span style="font-size:11.5px;color:var(--text-dim);">Kích thước: <b style="color:#cbd5e1;">${escapeHtml(resText)} (${escapeHtml(ratioText)})</b></span>
            <span style="font-size:11.5px;color:var(--text-dim);">• Thời lượng: <b style="color:#cbd5e1;">${durSec}s</b></span>
            <span style="font-size:11.5px;color:var(--text-dim);">• Tài khoản: <b style="color:#cbd5e1;">${escapeHtml(video.accountName || matchedTask?.assignedAccountName || 'Studio')}</b></span>
            ${matchedTask?.config?.removeWatermark !== false ? '<span style="font-size:11px;color:#4ade80;background:rgba(34,197,94,0.12);padding:2px 7px;border-radius:4px;border:1px solid rgba(34,197,94,0.25);">✨ Đã xóa watermark AI</span>' : ''}
          </div>
        </div>
      </div>
    </div>

    <!-- 2. Khung Video Player lớn khít toàn box, click để Play/Pause -->
    <div class="library-player-box" id="libraryPlayerContainer" title="Nhấp vào video để Phát / Tạm dừng">
      <video id="libraryMainVideoPlayer" preload="metadata" playsinline src="${toFileUrl(video.outputPath)}#t=0.001"></video>
      <div class="video-play-overlay" id="videoPlayOverlay">
        <div class="video-play-circle">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>
        </div>
      </div>
    </div>

    <!-- 3. Bảng thông số & Kịch bản (Ẩn mặc định, nhấn nút bên dưới để mở rộng) -->
    <div id="libraryDetailsPanel" class="library-details-panel" style="display: none;">
      <!-- Thông số chi tiết -->
      <div class="inspector-chips">
        <div class="spec-chip">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect></svg>
          <span>Kích thước: <b>${escapeHtml(resText)}</b> (${escapeHtml(ratioText)})</span>
        </div>
        <div class="spec-chip">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          <span>Thời lượng: <b>${durSec}s</b></span>
        </div>
        <div class="spec-chip">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          <span>Tài khoản: <b>${escapeHtml(video.accountName || matchedTask?.assignedAccountName || 'Studio')}</b></span>
        </div>
      </div>

      <div style="font-size: 11.5px; color: var(--text-dim); word-break: break-all; background: #070c16; padding: 8px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: space-between; gap: 8px;">
        <span>📁 ${escapeHtml(video.outputPath)}</span>
        <button type="button" class="btn-copy-prompt" id="btnCopyVideoPath" title="Sao chép đường dẫn">📋 Chép path</button>
      </div>

      <!-- Kịch bản Prompt đã dùng -->
      ${prompt1 ? `
        <div>
          <div class="inspector-section-label">
            <span>Kịch bản video đã tạo</span>
            <button type="button" class="btn-copy-prompt" id="btnCopyLibraryPrompt">📋 Sao chép</button>
          </div>
          <pre class="prompt-code-box">${escapeHtml(prompt1)}</pre>
        </div>
      ` : ''}

      ${prompt2 ? `
        <div>
          <div class="inspector-section-label">
            <span>Kịch bản nối tiếp (Extend)</span>
          </div>
          <pre class="prompt-code-box">${escapeHtml(prompt2)}</pre>
        </div>
      ` : ''}

      <!-- Ảnh tham chiếu đã dùng -->
      ${images.length ? `
        <div>
          <div class="inspector-section-label">
            <span>Ảnh tham chiếu đã dùng (${images.length}/3)</span>
          </div>
          <div class="ref-thumbnails-grid">
            ${images.map((imgPath, idx) => `
              <div class="ref-thumb-card" title="${escapeHtml(imgPath)}">
                <img src="${toFileUrl(imgPath)}" alt="Ảnh tham chiếu ${idx + 1}">
                <span class="ref-thumb-label">@Image${idx + 1}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>

    <!-- 4. Thanh nút bấm Action Bar dưới cùng -->
    <div class="inspector-action-bar" style="margin-top:0;padding-top:8px;flex-shrink:0;">
      <button type="button" class="btn-secondary" id="btnToggleVideoDetails" title="Bấm để xem/ẩn thông số và kịch bản chi tiết">
        <span id="toggleDetailsIcon">ℹ️</span>
        <span id="toggleDetailsText">Xem thông số &amp; Kịch bản ▾</span>
      </button>

      <div style="margin-left: auto; display: flex; gap: 8px;">
        <button class="btn-secondary" id="btnLibraryOpenExt">
          ▶ Mở ngoài
        </button>
        <button class="btn-secondary" id="btnLibraryReveal">
          📁 Mở thư mục
        </button>
      </div>
    </div>
  `;

  // Gắn sự kiện Video Play/Pause khi bấm vào video
  const vPlayer = $('libraryMainVideoPlayer');
  const vOverlay = $('videoPlayOverlay');
  const pContainer = $('libraryPlayerContainer');

  if (vPlayer && pContainer) {
    pContainer.onclick = () => {
      if (vPlayer.paused) {
        vPlayer.play();
      } else {
        vPlayer.pause();
      }
    };
    vPlayer.onplay = () => {
      if (vOverlay) vOverlay.classList.add('hidden');
    };
    vPlayer.onpause = () => {
      if (vOverlay) vOverlay.classList.remove('hidden');
    };
    vPlayer.onended = () => {
      if (vOverlay) vOverlay.classList.remove('hidden');
    };
  }

  // Gắn sự kiện nút Mở rộng / Thu gọn thông số & kịch bản
  const btnToggle = $('btnToggleVideoDetails');
  const detailsPanel = $('libraryDetailsPanel');
  const toggleText = $('toggleDetailsText');

  if (btnToggle && detailsPanel) {
    btnToggle.onclick = () => {
      const isHidden = (detailsPanel.style.display === 'none' || !detailsPanel.style.display);
      detailsPanel.style.display = isHidden ? 'flex' : 'none';
      if (toggleText) {
        toggleText.textContent = isHidden ? 'Thu gọn thông số & Kịch bản ▴' : 'Xem thông số & Kịch bản ▾';
      }
      btnToggle.classList.toggle('active', isHidden);
    };
  }

  // Gắn sự kiện nút Mở ngoài và Mở thư mục
  if ($('btnLibraryOpenExt')) $('btnLibraryOpenExt').onclick = () => window.vidsApp?.openFile(video.outputPath);
  if ($('btnLibraryReveal')) $('btnLibraryReveal').onclick = () => window.vidsApp?.revealFile(video.outputPath);
  if ($('btnCopyVideoPath')) {
    $('btnCopyVideoPath').onclick = () => {
      navigator.clipboard.writeText(video.outputPath);
      $('btnCopyVideoPath').textContent = '✓ Đã chép!';
      setTimeout(() => { if ($('btnCopyVideoPath')) $('btnCopyVideoPath').textContent = '📋 Chép path'; }, 1500);
    };
  }
  if ($('btnCopyLibraryPrompt') && prompt1) {
    $('btnCopyLibraryPrompt').onclick = () => {
      navigator.clipboard.writeText(prompt1);
      $('btnCopyLibraryPrompt').textContent = '✓ Đã chép!';
      setTimeout(() => { if ($('btnCopyLibraryPrompt')) $('btnCopyLibraryPrompt').textContent = '📋 Sao chép'; }, 1500);
    };
  }
}

async function loadLibrary() {
  const libList = $('libraryList');
  if (!libList) return;

  let videos = [];
  if (window.vidsApp) {
    videos = await window.vidsApp.listLibrary();
  }

  state.videos = videos || [];
  videos = (videos || []).filter(v => v.status === 'completed' && v.outputPath);

  if (!videos.length) {
    libList.innerHTML = '<div class="empty" style="padding: 40px 15px; text-align: center;">Chưa có video hoàn tất nào.</div>';
    renderVideoDetail(null);
    return;
  }

  // Chọn video đầu tiên nếu chưa chọn hoặc video đang chọn không tồn tại
  if (!state.selectedVideoPath || !videos.some(v => v.outputPath === state.selectedVideoPath)) {
    state.selectedVideoPath = videos[0].outputPath;
  }

  libList.innerHTML = videos.map(v => {
    const isSelected = (v.outputPath === state.selectedVideoPath);
    const fname = v.outputPath?.split(/[\\/]/).pop() || 'video.mp4';
    const durSec = Number(v.duration || 10).toFixed(1);
    const resText = (v.width && v.height) ? `${v.width}×${v.height}` : '1080×1920';

    return `
      <div class="library-card ${isSelected ? 'active' : ''}" data-video-path="${escapeHtml(v.outputPath)}">
        <div class="library-card-top">
          <div class="library-video-icon">▶</div>
          <div class="library-card-title-wrap">
            <span class="library-card-name" title="${escapeHtml(fname)}">${escapeHtml(fname)}</span>
            <div style="display:flex;align-items:center;gap:6px;margin-top:3px;">
              <span class="queue-card-badge completed" style="font-size:10px;">Hoàn tất</span>
              <span style="font-size:10.5px;color:var(--text-dim);">${escapeHtml(resText)}</span>
            </div>
          </div>
        </div>
        <div class="library-card-meta">
          <span>${escapeHtml(v.accountName || 'Studio')} • ${durSec}s</span>
          <span class="queue-btn-inspect">Quan sát →</span>
        </div>
      </div>
    `;
  }).join('');

  // Render chi tiết và player video đang chọn ở cột phải
  const currentVideo = videos.find(v => v.outputPath === state.selectedVideoPath) || videos[0];
  renderVideoDetail(currentVideo || null);

  // Click vào card để xem video đó
  libList.querySelectorAll('.library-card').forEach(card => {
    card.onclick = () => {
      const vPath = card.dataset.videoPath;
      state.selectedVideoPath = vPath;
      libList.querySelectorAll('.library-card').forEach(c => {
        c.classList.toggle('active', c.dataset.videoPath === vPath);
      });
      const selected = state.videos.find(v => v.outputPath === vPath);
      renderVideoDetail(selected || null);
    };
  });
}

if ($('refreshLibrary')) {
  $('refreshLibrary').onclick = () => loadLibrary();
}

function updateStats() {
  if ($('statAccounts')) $('statAccounts').textContent = state.accounts.length;
  if ($('statRunning')) $('statRunning').textContent = state.accounts.filter(a => a.running).length;
  if ($('statVideos')) $('statVideos').textContent = state.videos.filter(v => v.status === 'completed').length;
}

const sameLocalDay = (value, day = new Date()) => {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getFullYear() === day.getFullYear() && date.getMonth() === day.getMonth() && date.getDate() === day.getDate();
};

const statusLabel = status => ({ draft: 'Bản nháp', waiting: 'Đang chờ', running: 'Đang xử lý', completed: 'Hoàn tất', failed: 'Thất bại' }[status] || status);
const formatDuration = seconds => seconds >= 60 ? `${Math.floor(seconds / 60)} phút ${Math.round(seconds % 60)} giây` : `${Math.round(seconds)} giây`;

async function loadDashboard() {
  if (!$('todayTotal')) return;
  let tasks = state.tasks;
  let videos = state.videos;
  let accounts = state.accounts;
  if (window.vidsApp) {
    [tasks, videos, accounts] = await Promise.all([window.vidsApp.listQueue(), window.vidsApp.listLibrary(), window.vidsApp.listAccounts()]);
    state.tasks = tasks || [];
    state.videos = videos || [];
    state.accounts = accounts || [];
  }
  const now = new Date();
  const todayTasks = (tasks || []).filter(task => sameLocalDay(task.createdAt, now));
  const completedVideos = (videos || []).filter(video => video.status === 'completed' && sameLocalDay(video.updatedAt || video.createdAt, now));
  const completed = todayTasks.filter(task => task.status === 'completed').length;
  const active = todayTasks.filter(task => ['draft', 'waiting', 'running'].includes(task.status)).length;
  const failed = todayTasks.filter(task => task.status === 'failed').length;
  const totalDuration = completedVideos.reduce((sum, video) => sum + Number(video.duration || 0), 0);

  $('dashboardDate').textContent = now.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  $('todayTotal').textContent = todayTasks.length;
  $('todayCompleted').textContent = completedVideos.length;
  $('todayActive').textContent = active;
  $('todayFailed').textContent = failed;
  $('todayDuration').textContent = `Tổng thời lượng ${formatDuration(totalDuration)}`;

  const statusChart = $('statusChart');
  const total = todayTasks.length;
  if (!total) {
    statusChart.className = 'dashboard-chart-empty';
    statusChart.innerHTML = 'Chưa có nội dung nào được thêm hôm nay.';
  } else {
    const doneEnd = completed / total * 100;
    const activeEnd = doneEnd + active / total * 100;
    statusChart.className = 'status-chart-wrap';
    statusChart.innerHTML = `<div class="donut" style="background:conic-gradient(#10b981 0 ${doneEnd}%,#3b82f6 ${doneEnd}% ${activeEnd}%,#ef4444 ${activeEnd}% 100%)"><div><strong>${total}</strong><span>Nội dung</span></div></div><div class="chart-legend"><div><i class="green"></i><span>Hoàn tất</span><b>${completed}</b></div><div><i class="blue"></i><span>Chờ / xử lý</span><b>${active}</b></div><div><i class="red"></i><span>Thất bại</span><b>${failed}</b></div></div>`;
  }

  const days = Array.from({ length: 7 }, (_, index) => { const day = new Date(now); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() - (6 - index)); return day; });
  const counts = days.map(day => (videos || []).filter(video => video.status === 'completed' && sameLocalDay(video.updatedAt || video.createdAt, day)).length);
  const max = Math.max(1, ...counts);
  $('weeklyChart').innerHTML = days.map((day, index) => `<div class="weekly-column"><span class="bar-value">${counts[index]}</span><div class="bar-track"><div class="bar-fill" style="height:${counts[index] ? Math.max(12, counts[index] / max * 100) : 3}%"></div></div><small>${day.toLocaleDateString('vi-VN', { weekday: 'short' })}</small><em>${day.getDate()}/${day.getMonth() + 1}</em></div>`).join('');

  const recent = [...(tasks || [])].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 6);
  $('recentActivity').innerHTML = recent.map(task => `<div class="activity-row"><span class="activity-dot ${escapeHtml(task.status)}"></span><div><strong>${escapeHtml(task.config?.filename || 'Video chưa đặt tên')}</strong><small>${escapeHtml(task.assignedAccountName || 'Tự động phân tài khoản')} · ${new Date(task.updatedAt).toLocaleString('vi-VN')}</small></div><b class="activity-status ${escapeHtml(task.status)}">${escapeHtml(statusLabel(task.status))}</b></div>`).join('') || '<div class="dashboard-chart-empty">Chưa có hoạt động.</div>';

  const ready = (accounts || []).filter(account => /^VERIFIED_/.test(account.status)).length;
  const running = (accounts || []).filter(account => account.running).length;
  $('accountSummary').innerHTML = `<div class="account-stat"><span>Tổng tài khoản</span><strong>${(accounts || []).length}</strong></div><div class="account-stat"><span>Sẵn sàng</span><strong class="green-text">${ready}</strong></div><div class="account-stat"><span>Đang thực thi</span><strong class="blue-text">${running}</strong></div><div class="account-capacity"><span>Công suất khả dụng</span><b>${ready ? Math.max(0, ready - running) : 0}/${ready}</b><div><i style="width:${ready ? Math.max(0, ready - running) / ready * 100 : 0}%"></i></div></div>`;
}

if ($('refreshDashboard')) $('refreshDashboard').onclick = loadDashboard;

// Guide Modal & Knowledge Base
function openGuideModal(tabName) {
  const modal = $('guideModal');
  if (modal) {
    if (tabName) {
      switchGuideTab(tabName);
    }
    if (typeof modal.showModal === 'function') {
      modal.showModal();
    } else {
      modal.setAttribute('open', '');
    }
  }
}

function closeGuideModal() {
  const modal = $('guideModal');
  if (modal) {
    if (typeof modal.close === 'function') {
      modal.close();
    } else {
      modal.removeAttribute('open');
    }
  }
}

function switchGuideTab(tabName) {
  document.querySelectorAll('.guide-nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.guide-pane').forEach(p => p.classList.remove('active'));
  const activeBtn = document.querySelector(`.guide-nav-tab[data-guide-tab="${tabName}"]`);
  const activePane = $(`guide-pane-${tabName}`);
  if (activeBtn) activeBtn.classList.add('active');
  if (activePane) activePane.classList.add('active');
}

if ($('btnGuide')) $('btnGuide').onclick = () => openGuideModal('quickstart');
if ($('closeGuideModal')) $('closeGuideModal').onclick = closeGuideModal;
if ($('btnCloseGuideBottom')) $('btnCloseGuideBottom').onclick = closeGuideModal;

document.querySelectorAll('.guide-nav-tab').forEach(btn => {
  btn.onclick = () => switchGuideTab(btn.dataset.guideTab);
});

if ($('guideBtnToCreate')) {
  $('guideBtnToCreate').onclick = () => {
    closeGuideModal();
    showView('create');
  };
}

if ($('guideBtnToSupport')) {
  $('guideBtnToSupport').onclick = () => {
    closeGuideModal();
    openSupportModal();
  };
}

if ($('btnGuideSupportModal')) {
  $('btnGuideSupportModal').onclick = () => {
    closeGuideModal();
    openSupportModal();
  };
}

const guideModalEl = $('guideModal');
if (guideModalEl) {
  guideModalEl.addEventListener('click', (event) => {
    const rect = guideModalEl.getBoundingClientRect();
    const isInDialog = (
      rect.top <= event.clientY &&
      event.clientY <= rect.top + rect.height &&
      rect.left <= event.clientX &&
      event.clientX <= rect.left + rect.width
    );
    if (!isInDialog) {
      closeGuideModal();
    }
  });
}

// Support Modal & Channels Interactivity (Zalo & Telegram QR)
function openSupportModal() {
  const modal = $('supportModal');
  if (modal) {
    if (typeof modal.showModal === 'function') {
      modal.showModal();
    } else {
      modal.setAttribute('open', '');
    }
  }
}

function closeSupportModal() {
  const modal = $('supportModal');
  if (modal) {
    if (typeof modal.close === 'function') {
      modal.close();
    } else {
      modal.removeAttribute('open');
    }
  }
}

if ($('btnSupport')) $('btnSupport').onclick = openSupportModal;
if ($('closeSupportModal')) $('closeSupportModal').onclick = closeSupportModal;
if ($('btnDismissSupport')) $('btnDismissSupport').onclick = closeSupportModal;

const supportModalEl = $('supportModal');
if (supportModalEl) {
  supportModalEl.addEventListener('click', (event) => {
    const rect = supportModalEl.getBoundingClientRect();
    const isInDialog = (
      rect.top <= event.clientY &&
      event.clientY <= rect.top + rect.height &&
      rect.left <= event.clientX &&
      event.clientX <= rect.left + rect.width
    );
    if (!isInDialog) {
      closeSupportModal();
    }
  });
}

if ($('btnActionTelegram')) {
  $('btnActionTelegram').onclick = () => {
    const url = 'https://t.me/NLTH_MEDIA';
    if (window.vidsApp && typeof window.vidsApp.openExternal === 'function') {
      window.vidsApp.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };
}

if ($('btnCopyTelegramId')) {
  $('btnCopyTelegramId').onclick = async () => {
    const username = '@NLTH_MEDIA';
    try {
      await navigator.clipboard.writeText(username);
      const btn = $('btnCopyTelegramId');
      const label = $('copyTelegramLabel');
      if (btn) btn.classList.add('copied');
      if (label) label.textContent = '✓ Đã chép ID!';
      setTimeout(() => {
        if (btn) btn.classList.remove('copied');
        if (label) label.textContent = 'Sao chép ID';
      }, 2000);
    } catch {
      await showAppPrompt('Tên Telegram hỗ trợ:', username, 'Thông tin hỗ trợ');
    }
  };
}

if ($('btnActionZalo')) {
  $('btnActionZalo').onclick = () => {
    const url = 'https://chat.zalo.me';
    if (window.vidsApp && typeof window.vidsApp.openExternal === 'function') {
      window.vidsApp.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };
}

// ==========================================================================
// NOTIFICATIONS PANEL & BADGE (TASK STATUS: COMPLETED & FAILED FIX)
// ==========================================================================
let currentNotifFilter = 'all';

function updateNotificationsBadge() {
  const tasks = state.tasks || [];
  const failed = tasks.filter(t => t.status === 'failed');
  const completed = tasks.filter(t => t.status === 'completed');
  
  if ($('countNotifAll')) $('countNotifAll').textContent = failed.length + completed.length;
  if ($('countNotifFailed')) $('countNotifFailed').textContent = failed.length;
  if ($('countNotifCompleted')) $('countNotifCompleted').textContent = completed.length;
  
  const badge = $('notifCountBadge');
  const btn = $('btnNotifications');
  
  if (failed.length > 0) {
    if (badge) {
      badge.style.display = 'flex';
      badge.style.background = '#ef4444';
      badge.textContent = failed.length;
    }
    if (btn) btn.title = `${failed.length} task gặp lỗi cần sửa!`;
  } else if (completed.length > 0) {
    if (badge) {
      badge.style.display = 'flex';
      badge.style.background = '#10b981';
      badge.textContent = completed.length;
    }
    if (btn) btn.title = `${completed.length} video đã tạo hoàn tất`;
  } else {
    if (badge) {
      badge.style.display = 'none';
      badge.textContent = '0';
    }
    if (btn) btn.title = 'Thông báo nhiệm vụ';
  }

  const retryAllBtn = $('btnRetryAllFailed');
  if (retryAllBtn) {
    retryAllBtn.style.display = failed.length > 1 ? 'inline-flex' : 'none';
  }

  const panel = $('notificationsPanel');
  if (panel && panel.classList.contains('active')) {
    renderNotificationsList();
  }
}

function renderNotificationsList() {
  const listEl = $('notifList');
  if (!listEl) return;

  const tasks = state.tasks || [];
  const failed = tasks.filter(t => t.status === 'failed');
  const completed = tasks.filter(t => t.status === 'completed');

  let displayTasks = [];
  if (currentNotifFilter === 'failed') {
    displayTasks = failed;
  } else if (currentNotifFilter === 'completed') {
    displayTasks = completed;
  } else {
    // 'all': failed tasks first, then completed
    displayTasks = [...failed, ...completed];
  }

  if (!displayTasks.length) {
    const emptyMsg = currentNotifFilter === 'failed' 
      ? 'Tuyệt vời! Không có task nào bị lỗi.' 
      : (currentNotifFilter === 'completed' 
          ? 'Chưa có task nào hoàn thành.' 
          : 'Chưa có thông báo nào. Các task hoàn thành hoặc gặp lỗi sẽ xuất hiện tại đây.');
    listEl.innerHTML = `
      <div class="notif-empty-state">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <strong>Không có thông báo</strong>
        <p>${emptyMsg}</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = displayTasks.map(task => {
    const isFailed = task.status === 'failed';
    const filename = escapeHtml(task.config?.filename || 'video.mp4');
    const timeStr = task.updatedAt ? new Date(task.updatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';
    const dateStr = task.updatedAt ? new Date(task.updatedAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : '';
    const duration = task.config?.duration || 10;
    const res = task.config?.resolution || 720;
    const ratio = task.config?.aspectRatio || '9:16';

    if (isFailed) {
      const errorMsg = escapeHtml(task.error || task.progressMessage || 'Quá trình render hoặc tải video gặp sự cố. Bấm sửa kịch bản hoặc chạy lại.');
      return `
        <div class="notif-item notif-item-failed">
          <div class="notif-item-head">
            <span class="notif-badge-pill failed">✕ Thất bại</span>
            <span class="notif-time">${dateStr} ${timeStr}</span>
          </div>
          <div class="notif-item-title">${filename}</div>
          <div class="notif-error-text">
            <strong>Nguyên nhân:</strong> ${errorMsg}
          </div>
          <div class="notif-item-actions">
            <button type="button" class="notif-btn-retry" data-retry-id="${escapeHtml(task.id)}" title="Thử chạy lại task này ngay">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
              <span>Chạy lại</span>
            </button>
            <button type="button" class="notif-btn-edit" data-edit-id="${escapeHtml(task.id)}" title="Mở task trong Hàng đợi để sửa kịch bản, thời lượng hoặc tỉ lệ">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
              <span>Sửa kịch bản</span>
            </button>
            <button type="button" class="notif-btn-folder" data-delete-id="${escapeHtml(task.id)}" title="Xóa task lỗi này" style="margin-left:auto;color:#f87171;">
              ✕ Xóa
            </button>
          </div>
        </div>
      `;
    } else {
      const outputPath = task.outputPath || '';
      return `
        <div class="notif-item notif-item-completed">
          <div class="notif-item-head">
            <span class="notif-badge-pill completed">✓ Hoàn thành</span>
            <span class="notif-time">${dateStr} ${timeStr}</span>
          </div>
          <div class="notif-item-title">${filename}</div>
          <div class="notif-meta-text">
            Thời lượng: <strong>${duration}s</strong> · Độ phân giải: <strong>${res}p</strong> · Tỉ lệ: <strong>${ratio}</strong>
          </div>
          <div class="notif-item-actions">
            ${outputPath ? `
              <button type="button" class="notif-btn-play" data-open-path="${escapeHtml(outputPath)}" title="Mở xem video trên máy tính">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                <span>Xem video</span>
              </button>
              <button type="button" class="notif-btn-folder" data-reveal-path="${escapeHtml(outputPath)}" title="Mở thư mục chứa file">
                📁 Thư mục
              </button>
            ` : ''}
            <button type="button" class="notif-btn-folder" data-go-library="true" title="Chuyển tới Kho video" style="margin-left:auto;">
              Kho video &rarr;
            </button>
          </div>
        </div>
      `;
    }
  }).join('');
}

// Event Delegation for Notification List Actions
if ($('notifList')) {
  $('notifList').onclick = async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    // 1. Chạy lại (Retry) task lỗi
    if (btn.dataset.retryId) {
      const taskId = btn.dataset.retryId;
      btn.disabled = true;
      btn.textContent = 'Đang chạy lại...';
      try {
        await window.vidsApp?.retryTask(taskId);
        await loadQueue();
        updateNotificationsBadge();
      } catch (err) {
        alert('Không thể chạy lại task: ' + err.message);
        btn.disabled = false;
        btn.textContent = 'Chạy lại';
      }
      return;
    }

    // 2. Sửa kịch bản (Edit Task) -> chuyển sang Hàng đợi và mở form chỉnh sửa
    if (btn.dataset.editId) {
      const taskId = btn.dataset.editId;
      if ($('notificationsPanel')) $('notificationsPanel').classList.remove('active');
      showView('queue');
      state.selectedTaskId = taskId;
      await loadQueue();
      const target = (state.tasks || []).find(t => t.id === taskId);
      if (target) {
        renderTaskDetail(target);
        const formWrap = $('queueDetailContent') || $('taskEditForm');
        if (formWrap) formWrap.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    // 3. Xóa task lỗi
    if (btn.dataset.deleteId) {
      const taskId = btn.dataset.deleteId;
      if (!await showAppConfirm('Xóa thông báo và tác vụ này?', 'Xóa thông báo')) return;
      try {
        await window.vidsApp?.deleteTask(taskId);
        await loadQueue();
        updateNotificationsBadge();
      } catch (err) {
        alert('Không thể xóa: ' + err.message);
      }
      return;
    }

    // 4. Mở video
    if (btn.dataset.openPath) {
      window.vidsApp?.openFile(btn.dataset.openPath);
      return;
    }

    // 5. Mở thư mục
    if (btn.dataset.revealPath) {
      window.vidsApp?.revealFile(btn.dataset.revealPath);
      return;
    }

    // 6. Đi tới Kho video
    if (btn.dataset.goLibrary) {
      if ($('notificationsPanel')) $('notificationsPanel').classList.remove('active');
      showView('library');
      return;
    }
  };
}

// Toggle notifications dropdown
if ($('btnNotifications')) {
  $('btnNotifications').onclick = (e) => {
    e.stopPropagation();
    const panel = $('notificationsPanel');
    if (panel) {
      const isOpen = panel.classList.contains('active');
      if (!isOpen) {
        panel.classList.add('active');
        renderNotificationsList();
      } else {
        panel.classList.remove('active');
      }
    }
  };
}

if ($('closeNotifPanel')) {
  $('closeNotifPanel').onclick = () => {
    if ($('notificationsPanel')) $('notificationsPanel').classList.remove('active');
  };
}

// Tabs filtering inside notification panel
document.querySelectorAll('.notif-filter-tabs .notif-tab').forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll('.notif-filter-tabs .notif-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentNotifFilter = tab.dataset.filter || 'all';
    renderNotificationsList();
  };
});

// Chạy lại tất cả task lỗi cùng lúc
if ($('btnRetryAllFailed')) {
  $('btnRetryAllFailed').onclick = async () => {
    const failedTasks = (state.tasks || []).filter(t => t.status === 'failed');
    if (!failedTasks.length) return;
    const btn = $('btnRetryAllFailed');
    btn.disabled = true;
    btn.textContent = 'Đang xếp lại...';
    try {
      for (const t of failedTasks) {
        await window.vidsApp?.retryTask(t.id);
      }
      await loadQueue();
      updateNotificationsBadge();
    } catch (err) {
      alert('Không thể thử lại toàn bộ: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Chạy lại tất cả lỗi';
    }
  };
}

// Chuyển tới tab Hàng đợi
if ($('btnNotifToQueue')) {
  $('btnNotifToQueue').onclick = () => {
    if ($('notificationsPanel')) $('notificationsPanel').classList.remove('active');
    showView('queue');
  };
}

// Close notification panel when clicking outside
document.addEventListener('click', (e) => {
  const panel = $('notificationsPanel');
  const btn = $('btnNotifications');
  if (panel && panel.classList.contains('active')) {
    if (!panel.contains(e.target) && !btn?.contains(e.target)) {
      panel.classList.remove('active');
    }
  }
});

// ============================================================================
// HỆ THỐNG BẢN QUYỀN & MÀN HÌNH ĐĂNG NHẬP KEY (LICENSE ACTIVATION)
// ============================================================================

let currentHwid = '';

function setActivationAlert(message, type = 'error') {
  const alertEl = $('activationAlert');
  if (!alertEl) return;
  if (!message) {
    alertEl.style.display = 'none';
    alertEl.textContent = '';
    return;
  }
  alertEl.className = `activation-alert alert-${type}`;
  alertEl.textContent = message;
  alertEl.style.display = 'block';
}

async function checkLicenseStatus() {
  const activationScreen = $('activationScreen');
  const mainAppContainer = $('mainAppContainer');
  const topbarBadge = $('topbarLicenseBadge');
  const topbarText = $('topbarLicenseText');

  if (!window.vidsApp?.checkLicense) {
    // Trường hợp chạy ngoài Electron
    if (activationScreen) activationScreen.style.display = 'none';
    if (mainAppContainer) mainAppContainer.style.display = 'flex';
    return true;
  }

  try {
    const res = await window.vidsApp.checkLicense();
    currentHwid = res.hwid || 'HT-UNKNOWN';
    if ($('activationHwid')) $('activationHwid').textContent = currentHwid;

    if (res.licensed) {
      if (activationScreen) activationScreen.style.display = 'none';
      if (mainAppContainer) mainAppContainer.style.display = 'flex';
      if (topbarBadge) topbarBadge.style.display = 'inline-flex';
      if (topbarText) topbarText.textContent = res.type === 'LIFETIME' ? 'PRO TRỌN ĐỜI' : 'PRO LICENSE';
      return true;
    } else {
      if (activationScreen) activationScreen.style.display = 'flex';
      if (mainAppContainer) mainAppContainer.style.display = 'none';
      if (topbarBadge) topbarBadge.style.display = 'none';
      if (res.error) {
        setActivationAlert(res.error, 'error');
      }
      setTimeout(tryAutoDetectKeyFromClipboard, 400);
      return false;
    }
  } catch (err) {
    console.error('License check error:', err);
    if (activationScreen) activationScreen.style.display = 'flex';
    if (mainAppContainer) mainAppContainer.style.display = 'none';
    setTimeout(tryAutoDetectKeyFromClipboard, 400);
    return false;
  }
}

// Tự động nhận diện mã key từ clipboard khi khách copy từ Zalo/Telegram
async function tryAutoDetectKeyFromClipboard() {
  const activationScreen = $('activationScreen');
  if (!activationScreen || activationScreen.style.display === 'none') return;
  const inputKey = $('inputLicenseKey');
  if (!inputKey || inputKey.value.trim().length >= 29) return;

  try {
    const text = await navigator.clipboard.readText();
    if (!text) return;
    const match = text.trim().match(/HTVIDS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/i);
    if (match) {
      const detectedKey = match[0].toUpperCase();
      inputKey.value = detectedKey;
      setActivationAlert('✨ Đã phát hiện mã bản quyền từ bộ nhớ tạm! Đang tự động kích hoạt...', 'success');
      setTimeout(() => {
        $('btnActivateSubmit')?.click();
      }, 600);
    }
  } catch {
    // Trình duyệt có thể hỏi quyền hoặc clipboard trống
  }
}

window.addEventListener('focus', () => {
  tryAutoDetectKeyFromClipboard();
  checkLicenseStatus();
});

// Gắn sự kiện màn hình kích hoạt
function initActivationListeners() {
  const btnCopyHwid = $('btnCopyHwid');
  if (btnCopyHwid) {
    btnCopyHwid.onclick = async () => {
      const hwidText = $('activationHwid')?.textContent?.trim() || currentHwid;
      if (!hwidText) return;
      try {
        await navigator.clipboard.writeText(hwidText);
        const label = $('copyHwidLabel');
        if (label) {
          const original = label.textContent;
          label.textContent = 'Đã chép!';
          setTimeout(() => { label.textContent = original; }, 2000);
        }
      } catch {
        alert('Mã máy của bạn: ' + hwidText);
      }
    };
  }

  const btnPasteKey = $('btnPasteKey');
  const inputKey = $('inputLicenseKey');
  if (btnPasteKey && inputKey) {
    btnPasteKey.onclick = async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          inputKey.value = text.trim().toUpperCase();
          inputKey.focus();
        }
      } catch {
        inputKey.focus();
      }
    };
  }

  if (inputKey) {
    inputKey.addEventListener('input', () => {
      inputKey.value = inputKey.value.toUpperCase();
      setActivationAlert('');
    });
    inputKey.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        $('btnActivateSubmit')?.click();
      }
    });
  }

  const btnActivateSubmit = $('btnActivateSubmit');
  if (btnActivateSubmit) {
    btnActivateSubmit.onclick = async () => {
      const keyVal = $('inputLicenseKey')?.value?.trim().toUpperCase();
      if (!keyVal) {
        setActivationAlert('Vui lòng nhập mã key bản quyền (ví dụ: HTVIDS-7A9B-4F2C-8E1D-9350).', 'error');
        $('inputLicenseKey')?.focus();
        return;
      }

      const btnText = $('btnActivateText');
      btnActivateSubmit.disabled = true;
      if (btnText) btnText.textContent = 'Đang xác thực mã bản quyền...';
      setActivationAlert('');

      try {
        const res = await window.vidsApp?.activateLicense(keyVal);
        if (res?.ok) {
          setActivationAlert('🎉 Kích hoạt thành công! Đang khởi động ứng dụng...', 'success');
          setTimeout(async () => {
            $('activationScreen').style.display = 'none';
            $('mainAppContainer').style.display = 'flex';
            if ($('topbarLicenseBadge')) $('topbarLicenseBadge').style.display = 'inline-flex';
            // Tải dữ liệu ban đầu
            if (window.vidsApp && $('output') && !$('output').value) $('output').value = await window.vidsApp.defaultOutput();
            await refreshTaskName();
            renderThumbnails();
            await loadAccounts();
            await loadQueue();
            await loadLibrary();
            if (typeof updateNotificationsBadge === 'function') updateNotificationsBadge();
          }, 800);
        } else {
          setActivationAlert(res?.error || 'Mã bản quyền không hợp lệ hoặc đã bị khóa.', 'error');
          btnActivateSubmit.disabled = false;
          if (btnText) btnText.textContent = 'KÍCH HOẠT VÀO ỨNG DỤNG';
        }
      } catch (err) {
        setActivationAlert('Lỗi kết nối hoặc xác thực: ' + (err.message || String(err)), 'error');
        btnActivateSubmit.disabled = false;
        if (btnText) btnText.textContent = 'KÍCH HOẠT VÀO ỨNG DỤNG';
      }
    };
  }

  // Nút mở modal Zalo/Telegram từ màn hình kích hoạt
  const btnActivationContact = $('btnActivationContact');
  if (btnActivationContact) {
    btnActivationContact.onclick = () => {
      const modal = $('supportModal');
      if (modal && typeof modal.showModal === 'function') {
        modal.showModal();
      } else {
        window.vidsApp?.openExternal('https://zalo.me/0349887132');
      }
    };
  }
}

// Gắn sự kiện modal Hỗ trợ và Hướng dẫn
function initModalListeners() {
  const supportModal = $('supportModal');
  const btnSupport = $('btnSupport');
  const closeSupportModal = $('closeSupportModal');
  const btnDismissSupport = $('btnDismissSupport');

  if (btnSupport && supportModal) {
    btnSupport.onclick = () => supportModal.showModal();
  }
  if (closeSupportModal && supportModal) {
    closeSupportModal.onclick = () => supportModal.close();
  }
  if (btnDismissSupport && supportModal) {
    btnDismissSupport.onclick = () => supportModal.close();
  }

  // Nút gọi điện / nhắn tin
  const btnActionZalo = $('btnActionZalo');
  if (btnActionZalo) {
    btnActionZalo.onclick = () => window.vidsApp?.openExternal('https://zalo.me/0349887132');
  }
  const btnActionTelegram = $('btnActionTelegram');
  if (btnActionTelegram) {
    btnActionTelegram.onclick = () => window.vidsApp?.openExternal('https://t.me/NLTH_MEDIA');
  }
  const btnCopyZaloPhone = $('btnCopyZaloPhone');
  if (btnCopyZaloPhone) {
    btnCopyZaloPhone.onclick = async () => {
      try {
        await navigator.clipboard.writeText('0349887132');
        const lbl = $('copyZaloLabel');
        if (lbl) {
          const orig = lbl.textContent;
          lbl.textContent = 'Đã chép!';
          setTimeout(() => { lbl.textContent = orig; }, 2000);
        }
      } catch {
        alert('SĐT Zalo: 0349887132');
      }
    };
  }
  const btnCopyTelegramId = $('btnCopyTelegramId');
  if (btnCopyTelegramId) {
    btnCopyTelegramId.onclick = async () => {
      try {
        await navigator.clipboard.writeText('@NLTH_MEDIA');
        const lbl = $('copyTelegramLabel');
        if (lbl) {
          const orig = lbl.textContent;
          lbl.textContent = 'Đã chép!';
          setTimeout(() => { lbl.textContent = orig; }, 2000);
        }
      } catch {
        alert('Telegram: @NLTH_MEDIA');
      }
    };
  }

  // Guide Modal
  const guideModal = $('guideModal');
  const btnGuide = $('btnGuide');
  const closeGuideModal = $('closeGuideModal');
  const btnCloseGuideBottom = $('btnCloseGuideBottom');
  const btnGuideSupportModal = $('btnGuideSupportModal');

  if (btnGuide && guideModal) {
    btnGuide.onclick = () => guideModal.showModal();
  }
  if (closeGuideModal && guideModal) {
    closeGuideModal.onclick = () => guideModal.close();
  }
  if (btnCloseGuideBottom && guideModal) {
    btnCloseGuideBottom.onclick = () => guideModal.close();
  }
  if (btnGuideSupportModal && supportModal && guideModal) {
    btnGuideSupportModal.onclick = () => {
      guideModal.close();
      supportModal.showModal();
    };
  }

  // Guide sidebar tabs
  document.querySelectorAll('.guide-tab-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.guide-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.guide-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const pane = $(btn.dataset.pane);
      if (pane) pane.classList.add('active');
    };
  });
}

// Initial Boot
(async () => {
  initActivationListeners();
  initModalListeners();

  const isLicensed = await checkLicenseStatus();
  if (isLicensed) {
    if (window.vidsApp && $('output') && !$('output').value) $('output').value = await window.vidsApp.defaultOutput();
    await refreshTaskName();
    renderThumbnails();
    await loadAccounts();
    await loadQueue();
    await loadLibrary();
    if (typeof updateNotificationsBadge === 'function') updateNotificationsBadge();
  }

  // Đồng bộ trạng thái khóa từ Google Sheets trong khi ứng dụng đang mở.
  // BLOCKED/REVOKED có hiệu lực tối đa sau 60 giây hoặc ngay khi cửa sổ được focus lại.
  window.setInterval(() => {
    checkLicenseStatus();
  }, 60_000);
})();
