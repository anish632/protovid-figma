import fs from 'node:fs/promises';

const chromePort = process.env.CHROME_PORT || '9222';
const appOrigin = process.env.PROTOVID_UI_ORIGIN || 'http://127.0.0.1:4173';
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
await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `
  Object.defineProperty(Storage.prototype, 'getItem', { value() { throw new Error('Storage blocked'); } });
  Object.defineProperty(Storage.prototype, 'setItem', { value() { throw new Error('Storage blocked'); } });
  const nativeFetch = window.fetch.bind(window);
  window.__checkoutRequests = [];
  window.fetch = async (url, options) => {
    if (url === '/api/track') return new Response('{}', {status: 200});
    if (url === '/api/billing/checkout') {
      window.__checkoutRequests.push(JSON.parse(options.body));
      return new Response(JSON.stringify({error: 'Test checkout unavailable. Try again.'}), {status: 503});
    }
    return nativeFetch(url, options);
  };
` });
async function evaluate(expression) {
  const result = await cdp.send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(expression) {
  for (let i=0;i<100;i++) {
    if (await evaluate(expression)) return;
    await new Promise(r=>setTimeout(r,50));
  }
  throw new Error('Timed out: '+expression);
}
for (const width of [375, 1280]) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {width, height: 900, deviceScaleFactor: 1, mobile: false});
  await cdp.send('Page.navigate', {url: 'http://127.0.0.1:3007/pricing'});
  await waitFor("document.body?.innerText.includes('Buy Project Pass')");
  await new Promise(r=>setTimeout(r,800));
  assert(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'Pricing overflows viewport');
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Buy Project Pass')).click()");
  await waitFor("document.querySelector('[role=alert]')?.textContent.includes('Enter the email')");
  assert(await evaluate('window.__checkoutRequests.length === 0'), 'Invalid email reached checkout');
  await evaluate(`(() => {
    const input = document.querySelector('input[type=email]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'qa@example.com');
    input.dispatchEvent(new Event('input', {bubbles:true}));
  })()`);
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Buy Project Pass')).click()");
  await waitFor("document.querySelector('[role=alert]')?.textContent.includes('Test checkout unavailable')");
  assert(await evaluate("window.__checkoutRequests[0].plan === 'large_export' && Boolean(window.__checkoutRequests[0].anonymousId)"), 'Pass or storage-free identity lost');
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Start Studio')).click()");
  await waitFor('window.__checkoutRequests.length === 2');
  assert(await evaluate("window.__checkoutRequests[1].plan === 'monthly'"), 'Studio selection lost');
  const shot = await cdp.send('Page.captureScreenshot', {format:'png'});
  await fs.writeFile(`/private/tmp/protovid-pricing-${width}.png`, Buffer.from(shot.data,'base64'));
}
console.log('PASS: mobile/desktop layout, blocked storage, invalid email, Pass/Studio requests, failed-checkout recovery. No real checkout created.');
cdp.close();
