const deadline = Date.now() + 10000;
let page;
while (Date.now() < deadline) {
  try {
    const targets = await fetch('http://127.0.0.1:9333/json').then(r => r.json());
    page = targets.find(x => x.type === 'page');
    if (page) break;
  } catch {}
  await new Promise(resolve => setTimeout(resolve, 250));
}
if (!page) throw new Error('Renderer DevTools target not found');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
await new Promise(resolve => setTimeout(resolve, 1500));
const result = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('CDP timeout')), 5000);
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id === 1) { clearTimeout(timer); resolve(message); }
  };
  ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: '({text:document.body.innerText.slice(0,500),rootChildren:document.querySelector("#root")?.children.length,url:location.href,apiKeys:Object.keys(window.ht??{}),script:[...document.scripts].map(x=>x.src),resources:performance.getEntriesByType("resource").map(x=>({name:x.name,duration:x.duration}))})', returnByValue: true } }));
});
ws.close();
const value = result.result?.result?.value;
console.log(JSON.stringify(value ?? result));
if (!value?.rootChildren || !value.text.includes('HT Craw Video') || !value.text.includes('Tổng quan') || !value.apiKeys?.includes('datasets')) throw new Error('Giao diện hoặc preload API không hoạt động đúng');
