const DEBUGGER_VERSION = '1.3';
const attachedTabs = new Set();
const patterns = [
  { urlPattern: '*dola.com/samantha/skill/pack*', requestStage: 'Response' },
  { urlPattern: '*.com/alice/slot/action_bar_v3/get_item_conf*', requestStage: 'Response' },
];

const shouldAttach = (url) => typeof url === 'string' && /^https?:\/\//i.test(url) && url.includes('dola.com');
const command = (tabId, method, params = {}) => new Promise((resolve, reject) => {
  chrome.debugger.sendCommand({ tabId }, method, params, (result) => {
    const error = chrome.runtime.lastError;
    if (error) reject(new Error(error.message));
    else resolve(result);
  });
});
const attach = (tabId) => new Promise((resolve, reject) => {
  chrome.debugger.attach({ tabId }, DEBUGGER_VERSION, () => {
    const error = chrome.runtime.lastError;
    if (error) reject(new Error(error.message));
    else resolve();
  });
});

async function ensureAttached(tabId) {
  if (attachedTabs.has(tabId)) return;
  try {
    await attach(tabId);
    await command(tabId, 'Fetch.enable', { patterns });
    attachedTabs.add(tabId);
    await chrome.action.setBadgeText({ tabId, text: '30' });
  } catch (error) {
    console.warn('HT Seedance 30s attach failed:', error?.message || error);
  }
}

async function attachExisting() {
  for (const tab of await chrome.tabs.query({})) if (tab.id && shouldAttach(tab.url)) void ensureAttached(tab.id);
}
chrome.runtime.onInstalled.addListener(attachExisting);
chrome.runtime.onStartup.addListener(attachExisting);
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (tab && shouldAttach(tab.url)) void ensureAttached(tabId);
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (shouldAttach(changeInfo.url || tab.url)) void ensureAttached(tabId);
});
chrome.tabs.onRemoved.addListener((tabId) => attachedTabs.delete(tabId));
chrome.debugger.onDetach.addListener((source) => source.tabId && attachedTabs.delete(source.tabId));

const optionValue = (option) => String(option?.option_key ?? option?.value ?? '');
const durationOption = (sample = {}) => ({
  ...sample,
  id: Number.isFinite(Number(sample.id)) ? Number(sample.id) + 1000 : 30,
  display_text: '30s',
  show_name: '30s (HT Native)',
  message_text: '',
  option_key: '30',
  value: '30',
  is_default: false,
});

function patchCapabilities(value, seen = new Set()) {
  if (value == null || typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  let changed = false;
  if (!Array.isArray(value)) {
    for (const key of ['supported_durations', 'support_durations']) {
      if (Array.isArray(value[key]) && !value[key].map(String).includes('30')) {
        value[key].push(typeof value[key][0] === 'number' ? 30 : '30');
        changed = true;
      }
    }
    const label = String(value.label || value.display_text || value.show_name || '');
    const selectorKey = String(value.key || value.value || '');
    const options = Array.isArray(value.option_list) ? value.option_list : Array.isArray(value.options) ? value.options : null;
    const looksLikeDuration = selectorKey === 'video-duration' || selectorKey === 'duration' || /duration|时长|時間|長さ/i.test(label)
      || Boolean(options?.some((option) => optionValue(option) === '10'));
    if (looksLikeDuration && options && !options.some((option) => optionValue(option) === '30')) {
      const ten = options.findIndex((option) => optionValue(option) === '10');
      options.splice(ten >= 0 ? ten + 1 : options.length, 0, durationOption(options[Math.max(0, ten)]));
      changed = true;
    }
  }
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === 'string' && /^[\s]*[\[{]/.test(child)) {
      try {
        const nested = JSON.parse(child);
        if (patchCapabilities(nested)) { value[key] = JSON.stringify(nested); changed = true; }
      } catch {}
    } else if (typeof child === 'object') changed = patchCapabilities(child, seen) || changed;
  }
  return changed;
}

function responseHeaders(headers, body) {
  const result = (headers || []).filter((header) => !['content-encoding', 'content-length'].includes(header.name.toLowerCase()));
  result.push({ name: 'content-length', value: String(new TextEncoder().encode(body).length) });
  return result;
}
const base64 = (text) => {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

chrome.debugger.onEvent.addListener((source, method, event) => {
  if (method !== 'Fetch.requestPaused' || !source.tabId) return;
  void (async () => {
    try {
      const response = await command(source.tabId, 'Fetch.getResponseBody', { requestId: event.requestId });
      const text = response.base64Encoded ? atob(response.body) : response.body;
      const json = JSON.parse(text);
      if (!patchCapabilities(json)) {
        await command(source.tabId, 'Fetch.continueRequest', { requestId: event.requestId });
        return;
      }
      const body = JSON.stringify(json);
      await command(source.tabId, 'Fetch.fulfillRequest', {
        requestId: event.requestId,
        responseCode: event.responseStatusCode || 200,
        responseHeaders: responseHeaders(event.responseHeaders, body),
        body: base64(body),
      });
    } catch (error) {
      console.warn('HT Seedance 30s patch failed:', error?.message || error);
      await command(source.tabId, 'Fetch.continueRequest', { requestId: event.requestId }).catch(() => {});
    }
  })();
});
