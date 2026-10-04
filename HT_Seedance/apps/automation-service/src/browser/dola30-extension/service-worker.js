const DEBUGGER_VERSION = '1.3';
const attached = new Set();
const ACTION_BAR = 'dola.com/alice/slot/action_bar_v3/get_item_conf';

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const url = changeInfo.url || tab.url || '';
  if (/^https?:\/\/.*dola\.com\//i.test(url)) attach(tabId);
});
chrome.tabs.onRemoved.addListener((tabId) => attached.delete(tabId));
chrome.runtime.onInstalled.addListener(async () => {
  for (const tab of await chrome.tabs.query({})) {
    if (/^https?:\/\/.*dola\.com\//i.test(tab.url || '') && tab.id) attach(tab.id);
  }
});
chrome.debugger.onDetach.addListener(({ tabId }) => attached.delete(tabId));
chrome.debugger.onEvent.addListener((source, method, params) => {
  if (method === 'Fetch.requestPaused' && source.tabId && params) handlePaused(source.tabId, params);
});

function send(tabId, method, params = {}) {
  return new Promise((resolve, reject) => chrome.debugger.sendCommand({ tabId }, method, params, (result) => {
    const error = chrome.runtime.lastError;
    if (error) reject(new Error(error.message)); else resolve(result);
  }));
}
async function attach(tabId) {
  if (attached.has(tabId)) return;
  try { await new Promise((resolve, reject) => chrome.debugger.attach({ tabId }, DEBUGGER_VERSION, () => { const e = chrome.runtime.lastError; e ? reject(new Error(e.message)) : resolve(); })); } catch { return; }
  try { await send(tabId, 'Fetch.enable', { patterns: [{ urlPattern: `*${ACTION_BAR}*`, requestStage: 'Response' }] }); attached.add(tabId); } catch { attached.delete(tabId); }
}
async function handlePaused(tabId, event) {
  try {
    if (!String(event.request?.url || '').includes(ACTION_BAR)) return continueRequest(tabId, event.requestId);
    const body = await send(tabId, 'Fetch.getResponseBody', { requestId: event.requestId });
    const text = body.base64Encoded ? decode(body.body) : body.body;
    const patched = patchText(text);
    await send(tabId, 'Fetch.fulfillRequest', {
      requestId: event.requestId,
      responseCode: event.responseStatusCode || 200,
      responsePhrase: event.responseStatusText || 'OK',
      responseHeaders: (event.responseHeaders || []).filter((h) => !/content-length|content-encoding/i.test(h.name)),
      body: encode(patched),
    });
  } catch { await continueRequest(tabId, event.requestId).catch(() => {}); }
}
function continueRequest(tabId, requestId) { return send(tabId, 'Fetch.continueRequest', { requestId }); }
function patchText(text) {
  try { const value = JSON.parse(text); return JSON.stringify(patchValue(value)); } catch { return text; }
}
function patchValue(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  if (Array.isArray(value)) { value.forEach((item, index) => { value[index] = patchValue(item, seen); }); return value; }
  const label = String(value.label || value.display_text || value.show_name || '');
  const key = String(value.key || value.value || '');
  const options = Array.isArray(value.option_list) ? value.option_list : null;
  const looksLikeDuration = options && (key === 'duration' || key === 'video-duration' || /duration|时长|時間|長さ/i.test(label) || options.some((o) => String(o?.option_key || o?.value || '') === '5') && options.some((o) => String(o?.option_key || o?.value || '') === '10'));
  if (looksLikeDuration && !options.some((o) => String(o?.option_key || o?.value || '') === '30')) options.push({ id: options.length + 1, display_text: '30s', message_text: '', option_key: '30' });
  for (const keyName of Object.keys(value)) value[keyName] = typeof value[keyName] === 'string' ? patchString(value[keyName], seen) : patchValue(value[keyName], seen);
  return value;
}
function patchString(text, seen) { try { const parsed = JSON.parse(text); return JSON.stringify(patchValue(parsed, seen)); } catch { return text; } }
function encode(text) { return btoa(unescape(encodeURIComponent(text))); }
function decode(text) { return decodeURIComponent(escape(atob(text))); }
