// Minimal Chrome DevTools Protocol driver (Node 22 global WebSocket).
const { spawn } = require('node:child_process');
const http = require('node:http');
const get = (url) => new Promise((res, rej) => http.get(url, r => { let d=''; r.on('data', c => d+=c); r.on('end', () => res(d)); }).on('error', rej));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// profile: reuse a named profile directory (keepProfile: true keeps its data between launches,
// to simulate restarting the app); args: extra Chrome flags.
async function launch({ width = 1280, height = 900, port = 9333, profile = null, keepProfile = false, args = [] } = {}) {
  const dir = require('os').tmpdir() + '/cdp-prof-' + (profile || port);
  if (!keepProfile) require('fs').rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  const chrome = spawn('google-chrome', ['--headless=new', '--no-sandbox', `--remote-debugging-port=${port}`,
    '--autoplay-policy=no-user-gesture-required', `--window-size=${width},${height}`, '--user-data-dir=' + dir, ...args, 'about:blank'], { stdio: 'ignore' });
  let tabs;
  for (let i = 0; i < 50; i++) { try { tabs = JSON.parse(await get(`http://127.0.0.1:${port}/json`)); if (tabs.length) break; } catch (e) {} await sleep(200); }
  const tab = tabs.find(t => t.type === 'page');
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  let id = 0; const pending = new Map(); const logs = []; const requests = [];
  ws.addEventListener('message', (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
    else if (d.method === 'Network.requestWillBeSent') requests.push(d.params.request.url);
    else if (d.method === 'Runtime.consoleAPICalled') logs.push(`[${d.params.type}] ` + d.params.args.map(a => a.value ?? a.description).join(' '));
    else if (d.method === 'Runtime.exceptionThrown') logs.push('[EXC] ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
  });
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 700 });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'eval failed'); return r.result.result.value; };
  const goto = async (url) => { await send('Page.navigate', { url }); await sleep(800); };
  const shot = async (file) => { const r = await send('Page.captureScreenshot', { format: 'png' }); require('fs').writeFileSync(file, Buffer.from(r.result.data, 'base64')); };
  const waitFor = async (expr, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (await ev(expr)) return true; } catch (e) {} await sleep(250); } return false; };
  const close = () => { try { ws.close(); } catch (e) {} chrome.kill(); };
  // Graceful shutdown (Browser.close) so localStorage/IndexedDB are flushed to the profile,
  // as on a normal browser exit; falls back to killing the process.
  const closeAndWait = async () => {
    const exited = new Promise(r => { chrome.once('exit', r); setTimeout(r, 10000); });
    try {
      const v = JSON.parse(await get(`http://127.0.0.1:${port}/json/version`));
      const bws = new WebSocket(v.webSocketDebuggerUrl);
      await new Promise((res, rej) => { bws.addEventListener('open', res); bws.addEventListener('error', rej); });
      bws.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
    } catch (e) { close(); }
    await exited;
    try { ws.close(); } catch (e) {}
    if (chrome.exitCode === null) chrome.kill();
  };
  return { ev, goto, shot, waitFor, logs, requests, close, closeAndWait, sleep, send };
}
module.exports = { launch };
