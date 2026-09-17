import fs from 'node:fs/promises';

const chromePort = process.env.CHROME_PORT || '9333';
const appOrigin = process.env.PROTOVID_UI_ORIGIN || 'http://127.0.0.1:4197';
const previewUrl = `${appOrigin}/test/uiHarness.html`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function createTarget() {
  const response = await fetch(`http://127.0.0.1:${chromePort}/json/new?${encodeURIComponent('about:blank')}`, {
    method: 'PUT',
  });
  if (!response.ok) throw new Error(`Could not create Chrome target (${response.status})`);
  return response.json();
}

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.events = new Map();
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      const listeners = this.events.get(message.method) || [];
      listeners.forEach(listener => listener(message.params));
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}


const target = await createTarget();
const cdp = new CdpClient(target.webSocketDebuggerUrl);
await cdp.connect();
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');
await cdp.send('Network.enable');
await cdp.send('Network.setBlockedURLs', { urls: ['https://protovid.dasgroupllc.com/*'] });
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 420, height: 760, deviceScaleFactor: 1, mobile: false });
async function evaluate(expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
for (const state of ['grace', 'authentication', 'canceled', 'paused']) {
  await cdp.send('Page.navigate', { url: `${previewUrl}?billing=${state}` });
  let notice;
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 100));
    notice = await evaluate(`document.querySelector('iframe')?.contentDocument?.querySelector('.billing-notice')?.innerText`);
    if (notice) break;
  }
  assert(notice, `${state}: billing notice missing`);
  const expected = state === 'grace' ? 'stay available until' : state === 'authentication' ? 'Bank verification needed' : state === 'canceled' ? 'subscription has ended' : 'features are paused';
  assert(notice.includes(expected), `${state}: wrong notice`);
  const overflow = await evaluate(`document.querySelector('iframe').contentDocument.documentElement.scrollWidth > 420`);
  assert(!overflow, `${state}: horizontal overflow`);
  await evaluate(`window.__billingMessages = []; window.addEventListener('message', e => window.__billingMessages.push(e.data)); document.querySelector('iframe').contentDocument.querySelector('.billing-notice button').click()`);
  await new Promise(r => setTimeout(r, 100));
  assert(await evaluate(`window.__billingMessages.some(m => m.pluginMessage?.type === 'open-billing-portal')`), `${state}: recovery action did not open billing`);
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile(`/private/tmp/protovid-billing-${state}.png`, Buffer.from(shot.data, 'base64'));
  console.log(`${state}: notice, recovery button, and narrow layout passed`);
}
cdp.close();
