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
await cdp.send('Network.enable');
await cdp.send('Network.setBlockedURLs', { urls: ['https://protovid.dasgroupllc.com/*'] });
const analytics = [];
cdp.events.set('Network.requestWillBeSent', [event => {
  if (event.request.url.endsWith('/api/track') && event.request.postData) {
    try { analytics.push(JSON.parse(event.request.postData)); } catch {}
  }
}]);
await cdp.send('Browser.setDownloadBehavior', {
  behavior: 'allow',
  downloadPath: '/tmp/protovid-ui-downloads',
});

async function evaluate(expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result.value;
}

async function setViewport(width, height) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: width,
    screenHeight: height,
  });
}

async function navigate(query, expectedText, width = 400, height = 700) {
  await setViewport(width, height);
  await cdp.send('Page.navigate', { url: `${previewUrl}?${query}` });
  await waitForText(expectedText);
}

async function waitFor(predicateExpression, label, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(predicateExpression)) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  const visibleText = await evaluate(`JSON.stringify({
    text: document.querySelector('#plugin')?.contentDocument?.body?.innerText || document.body.innerText,
    iframeUrl: document.querySelector('#plugin')?.contentWindow?.location?.href,
    harnessUrl: location.href
  })`)
    .catch(() => 'unavailable');
  throw new Error(`Timed out waiting for ${label}. Visible UI: ${String(visibleText).slice(0, 800)}`);
}

function pluginDocumentExpression() {
  return `document.querySelector('#plugin')?.contentDocument`;
}

async function waitForText(text, timeoutMs = 5000) {
  const encoded = JSON.stringify(text);
  await waitFor(
    `Boolean(${pluginDocumentExpression()}?.body?.innerText.includes(${encoded}))`,
    `text ${encoded}`,
    timeoutMs,
  );
}

async function pluginText() {
  return evaluate(`${pluginDocumentExpression()}.body.innerText`);
}

async function clickText(text, selector = 'button, a, summary') {
  const encodedText = JSON.stringify(text);
  const encodedSelector = JSON.stringify(selector);
  const clicked = await evaluate(`(() => {
    const doc = ${pluginDocumentExpression()};
    const element = [...doc.querySelectorAll(${encodedSelector})]
      .find(candidate => candidate.textContent.replace(/\\s+/g, ' ').trim().includes(${encodedText}));
    if (!element) return false;
    element.click();
    return true;
  })()`);
  assert(clicked, `Could not find control containing “${text}”`);
}

async function fillEmail(value) {
  const encoded = JSON.stringify(value);
  const filled = await evaluate(`(() => {
    const input = ${pluginDocumentExpression()}.querySelector('input[type="email"]');
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, ${encoded});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  assert(filled, 'Email input was not available');
}

async function screenshot(name) {
  await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  const result = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  });
  const path = `/tmp/protovid-ui-${name}.png`;
  await fs.writeFile(path, Buffer.from(result.data, 'base64'));
  return path;
}

async function layoutSnapshot() {
  return evaluate(`(() => {
    const doc = ${pluginDocumentExpression()};
    const action = doc.querySelector('.sticky-action-bar');
    const scroll = doc.querySelector('.screen-scroll');
    const actionRect = action?.getBoundingClientRect();
    const scrollRect = scroll?.getBoundingClientRect();
    const targetViolations = [...doc.querySelectorAll('button, a, summary, input')]
      .filter(element => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.height < 39.5;
      })
      .map(element => ({ tag: element.tagName, text: element.textContent.trim().slice(0, 40), height: element.getBoundingClientRect().height }));
    const nameViolations = [...doc.querySelectorAll('button, a, summary, input')]
      .filter(element => {
        const rect = element.getBoundingClientRect();
        if (!rect.width || !rect.height) return false;
        const label = element.getAttribute('aria-label') || element.textContent.trim() || element.labels?.[0]?.textContent.trim();
        return !label;
      }).length;
    return {
      innerWidth: doc.defaultView.innerWidth,
      innerHeight: doc.defaultView.innerHeight,
      scrollWidth: doc.documentElement.scrollWidth,
      bodyScrollWidth: doc.body.scrollWidth,
      actionVisible: Boolean(action && actionRect.top < doc.defaultView.innerHeight && actionRect.bottom <= doc.defaultView.innerHeight + 1),
      actionTop: actionRect?.top || null,
      scrollBottom: scrollRect?.bottom || null,
      primaryLabel: doc.querySelector('.sticky-action-bar .primary-action')?.textContent.trim() || null,
      headerHeight: Math.round(doc.querySelector('.app-header')?.getBoundingClientRect().height || 0),
      targetViolations,
      nameViolations,
    };
  })()`);
}

async function keyboardSnapshot() {
  return evaluate(`(() => {
    const doc = ${pluginDocumentExpression()};
    const controls = [...doc.querySelectorAll('button, a[href], summary, input')]
      .filter(element => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && !element.disabled;
      });
    const focusFailures = [];
    for (const element of controls) {
      element.focus();
      if (doc.activeElement !== element) {
        focusFailures.push(element.getAttribute('aria-label') || element.textContent.trim().slice(0, 40) || element.tagName);
      }
    }
    const positiveTabIndexes = controls
      .filter(element => element.tabIndex > 0)
      .map(element => element.tabIndex);
    const negativeTabIndexes = controls
      .filter(element => element.tabIndex < 0)
      .map(element => element.getAttribute('aria-label') || element.textContent.trim().slice(0, 40) || element.tagName);
    controls[0]?.focus();
    return {
      controlCount: controls.length,
      focusFailures,
      positiveTabIndexes,
      negativeTabIndexes,
    };
  })()`);
}

async function keyboardFocusRingSnapshot() {
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab' });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab' });
  return evaluate(`(() => {
    const doc = ${pluginDocumentExpression()};
    const active = doc.activeElement;
    const style = active ? doc.defaultView.getComputedStyle(active) : null;
    return {
      label: active?.getAttribute('aria-label') || active?.textContent?.trim().slice(0, 40) || active?.tagName || '',
      outlineStyle: style?.outlineStyle || '',
      outlineWidth: Number.parseFloat(style?.outlineWidth || '0'),
      outlineColor: style?.outlineColor || '',
    };
  })()`);
}

const screenshots = [];
const viewports = [
  [360, 600],
  [400, 700],
  [480, 800],
  [560, 900],
];

for (const [width, height] of viewports) {
  await navigate('state=detected&frames=3', 'Detected flow', width, height);
  const layout = await layoutSnapshot();
  assert(layout.scrollWidth <= layout.innerWidth, `${width}×${height} has horizontal document overflow`);
  assert(layout.bodyScrollWidth <= layout.innerWidth, `${width}×${height} has horizontal body overflow`);
  assert(layout.actionVisible, `${width}×${height} sticky action is not fully visible`);
  assert(layout.scrollBottom <= layout.actionTop + 1, `${width}×${height} sticky action overlaps the scroll viewport`);
  assert(layout.primaryLabel === 'Export free proof', `${width}×${height} has unexpected primary action`);
  assert(layout.headerHeight === 56, `${width}×${height} header is not compact`);
  assert(layout.targetViolations.length === 0, `${width}×${height} has controls below 40px: ${JSON.stringify(layout.targetViolations)}`);
  assert(layout.nameViolations === 0, `${width}×${height} has unlabeled interactive controls`);
  screenshots.push(await screenshot(`${width}x${height}-detected`));
}

await navigate('state=detected&frames=3', 'Detected flow', 400, 700);
const keyboard = await keyboardSnapshot();
assert(keyboard.controlCount > 0, 'Keyboard audit found no interactive controls');
assert(keyboard.focusFailures.length === 0, `Some controls cannot receive focus: ${JSON.stringify(keyboard.focusFailures)}`);
assert(keyboard.positiveTabIndexes.length === 0, 'Positive tabindex values disrupt logical keyboard order');
assert(keyboard.negativeTabIndexes.length === 0, `Interactive controls are missing from the tab order: ${JSON.stringify(keyboard.negativeTabIndexes)}`);
const focusRing = await keyboardFocusRingSnapshot();
assert(focusRing.outlineStyle === 'solid' && focusRing.outlineWidth >= 2, `Visible focus ring is missing: ${JSON.stringify(focusRing)}`);

await navigate('state=progress&frames=8', 'Creating your MP4', 400, 700);
let text = await pluginText();
assert(text.includes('Preparing frames') && text.includes('Rendering transitions') && text.includes('Encoding file') && text.includes('Finalizing download'), 'Progress screen is missing named stages');
assert(text.includes('8 frames') && text.includes('720p'), 'Progress screen is missing export facts');
screenshots.push(await screenshot('400x700-progress'));

await navigate('state=success&frames=3', 'Your MP4 is ready', 400, 700);
text = await pluginText();
assert(text.includes('Download file'), 'Success screen is missing its primary download action');
assert(text.indexOf('Download file') < text.indexOf('Ready to ship this project?'), 'Upgrade appears before the download action');
assert(text.includes('Copy export details') && text.includes('Export another'), 'Success actions are incomplete');
screenshots.push(await screenshot('400x700-success'));

await navigate('state=detected&frames=3', 'Export free proof');
await clickText('1080p');
await waitForText('Buy Project Pass');
text = await pluginText();
assert(!text.includes('Email address'), 'Selecting a Studio resolution forced checkout/email capture');
await clickText('720p');
await waitForText('Export free proof');
await evaluate(`(() => {
  const doc = ${pluginDocumentExpression()};
  const button = [...doc.querySelectorAll('button')]
    .find(candidate => candidate.textContent.replace(/\\s+/g, ' ').trim().includes('Export free proof'));
  if (!button) return false;
  button.click();
  button.click();
  return true;
})()`);
await waitFor(
  `window.__harnessStats.exportRequests === 1`,
  'single export request',
);
await waitForText('Your MP4 is ready');
await clickText('Export another');
await waitForText('Detected flow');

await navigate('state=detected&frames=3', 'Export free proof');
await clickText('Export free proof');
await waitForText('Your MP4 is ready');
await clickText('Copy export details');
await waitFor(
  `(() => { const text = ${pluginDocumentExpression()}.body.innerText; return text.includes('Export details copied.') || text.includes('Could not copy automatically.'); })()`,
  'copy-details outcome',
);
await clickText('Export another');
await waitForText('Detected flow');

await clickText('Account', 'summary');
await clickText('Restore purchase');
await waitForText('Email address');
await fillEmail('designer@example.com');
await clickText('Restore purchase');
await waitForText('Paid access restored for this email.');
text = await pluginText();
assert(text.includes('Unlimited exports included'), 'Restore did not expose active Studio allowance');

await navigate('state=detected&frames=3&restoreOutcome=failure', 'Export free proof');
await clickText('Account', 'summary');
await clickText('Restore purchase');
await waitForText('Email address');
await fillEmail('designer@example.com');
await clickText('Restore purchase');
await waitForText('No active Project Pass or Studio purchase was found');
text = await pluginText();
assert(text.includes('Email address'), 'Failed restore should keep the email capture visible');

await navigate('state=success&frames=5', 'Ready to ship this project?');
await clickText('Buy Project Pass —');
await waitForText('Email address');
assert(!(await pluginText()).includes('Buy Project Pass —'), 'Competing offers remain visible during checkout');
assert((await pluginText()).includes('No subscription.'), 'Pass terms missing from email step');
await clickText('Back to plans');
await waitForText('Buy Project Pass —');
await clickText('Buy Project Pass —');
await waitForText('Email address');
const upgradesBeforeSubmit = analytics.filter(event => event.eventType === 'upgrade_clicked').length;
await fillEmail('client@');
assert(await evaluate(`${pluginDocumentExpression()}.querySelector('.email-capture .upgrade-cta').disabled`), 'Incomplete email can start checkout');
await fillEmail('client@example.com');
await evaluate(`(() => { const button = ${pluginDocumentExpression()}.querySelector('.email-capture .upgrade-cta'); button.click(); button.click(); })()`);
await waitForText('Studio is active.');
assert(await evaluate('window.__harnessStats.checkoutRequests') === 1, 'Double click created duplicate checkouts');
assert(analytics.filter(event => event.eventType === 'upgrade_clicked').length === upgradesBeforeSubmit, 'Email submission inflated upgrade clicks');
assert(analytics.some(event => event.eventType === 'checkout_email_submitted'), 'Email submission was not tracked');
assert(analytics.filter(event => event.eventType === 'checkout_email_submitted').every(event => event.pluginVersion === '1.3.24'), 'Checkout UI events report the wrong release');
text = await pluginText();
assert(text.includes('Export client-ready video'), 'Checkout success did not return to a Studio export setup: '+text);

await navigate('state=detected&frames=3&exportOutcome=failure', 'Export free proof');
await clickText('Export free proof');
await waitForText('Export could not be completed');
text = await pluginText();
assert(text.includes('Your selected flow and settings are still available.'), 'Failure recovery does not reassure the user');
assert(!text.includes('hidden backend details'), 'Raw diagnostic details leaked into the UI');
assert(text.includes('720p'), 'Selected settings were not preserved after failure');
screenshots.push(await screenshot('400x700-failure'));

await navigate('state=limit&frames=3', 'Buy Project Pass');
const limitActionEnabled = await evaluate(`!${pluginDocumentExpression()}.querySelector('.sticky-action-bar .primary-action').disabled`);
assert(limitActionEnabled, 'Free-limit action is ambiguously disabled');
screenshots.push(await screenshot('400x700-limit'));

await navigate('state=one-left&frames=3', '1 free export remaining this month');

await navigate('state=entitlement-error&frames=3', 'Allowance unavailable');
text = await pluginText();
assert(!text.includes('No free exports remaining'), 'Unavailable entitlement was presented as an exhausted allowance');
assert(text.includes('Try again'), 'Entitlement recovery action is missing');

await navigate('state=offline&frames=3', 'You appear to be offline');
text = await pluginText();
assert(text.includes('Reconnect and try again.'), 'Offline recovery guidance is missing');

await navigate('state=invalid&frames=3', 'Flow needs attention');
text = await pluginText();
assert(text.includes('Review flow'), 'Invalid flow is missing its recovery action');
assert(!text.includes('Ready for a quick review export.'), 'Invalid flow still displays a ready state');
screenshots.push(await screenshot('400x700-invalid'));

await navigate('state=unsupported&frames=3', 'Some frame content is not supported');
text = await pluginText();
assert(text.includes('Review flow'), 'Unsupported-content state is missing its recovery action');

await navigate('state=branching&frames=3', 'Choose another start frame');
await clickText('Home → Settings');
await waitForText('Export free proof');

await navigate('state=large&frames=55', 'This is a very large flow');
await navigate('state=looped&frames=5', 'This path contains a loop');

await navigate('state=checkout-opening&frames=3', 'Opening secure checkout in your browser');
const openingActionDisabled = await evaluate(`${pluginDocumentExpression()}.querySelector('.sticky-action-bar .primary-action').disabled`);
assert(openingActionDisabled, 'Checkout opening state allows a duplicate primary action');

await navigate('state=checkout-pending&frames=3', 'Confirming Studio');
text = await pluginText();
assert(text.includes('Back to export setup'), 'Pending checkout is missing a safe return action');

await navigate('state=checkout-cancelled&frames=3', 'Checkout was not confirmed');
text = await pluginText();
assert(text.includes('flow and settings are unchanged'), 'Cancelled checkout does not preserve/reassure about setup');

await navigate('state=checkout-error&frames=3', 'Checkout could not be opened');
text = await pluginText();
assert(text.includes('No charge was made.'), 'Checkout failure does not explain the billing outcome');
assert(!text.includes('hidden diagnostic'), 'Checkout failure leaked a raw diagnostic');

await navigate('state=detected&frames=3', 'Export free proof');
await clickText('Account', 'summary');
await clickText('Use another email');
await waitForText('Use another email');
await fillEmail('new-account@example.com');
await clickText('Use this email');
await waitForText('Account switched. Studio is active.');

await navigate('state=pro&frames=3', 'Export client-ready video');
await clickText('4K');
await waitForText('4K without a watermark');

await navigate('state=mixed&frames=4', 'Frame dimensions vary');
await navigate('state=one-frame', 'Only one frame is connected');
await navigate('state=empty', 'No connected prototype flow found');
assert(await evaluate(`(() => { const doc = ${pluginDocumentExpression()}; return doc.querySelector('.empty-state').getBoundingClientRect().bottom <= doc.querySelector('.empty-screen-wrap > .account-menu').getBoundingClientRect().top; })()`), 'Empty-state controls overlap the account menu');
screenshots.push(await screenshot('400x700-empty'));
for (const [slug, label] of [['client-delivery', 'Client booking walkthrough'], ['saas-walkthrough', 'SaaS task-planning demo'], ['portfolio-case-study', 'Portfolio interaction']]) {
  await navigate('state=empty', 'No connected prototype flow found');
  assert(await evaluate(`${pluginDocumentExpression()}.querySelector('.example-picker').open`), 'Ready-connected examples are hidden');
  await clickText(label);
  await waitForText('Detected flow');
  assert(await evaluate(`window.__harnessStats.exampleSlug === ${JSON.stringify(slug)}`), 'Wrong example requested');
  assert(await evaluate('window.__harnessStats.exportRequests === 0'), 'Example creation must not consume an export');
}


await navigate('state=success&frames=3', 'Download file');
await clickText('Download file', 'a');

console.log(JSON.stringify({
  passed: true,
  viewports: viewports.map(([width, height]) => `${width}x${height}`),
  screenshots,
  journeys: [
    'detect and configure',
    'Studio resolution explanation',
    'free export and download',
    'copy details and export another',
    'restore purchase',
    'checkout success',
    'recoverable export failure',
    'free limit',
    'one free export remaining',
    'entitlement and offline recovery',
    'invalid and unsupported flow recovery',
    'branching path selection',
    'large and looped flow warnings',
    'checkout opening, pending, cancelled, and error',
    'account switching',
    'keyboard focus order and visibility',
    'Studio 4K',
    'mixed dimensions',
    'single frame',
    'empty flow',
  ],
}, null, 2));

cdp.close();
