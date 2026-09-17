import fs from 'node:fs';
import assert from 'node:assert/strict';
const env = {};
for (const line of fs.readFileSync('.env.billing-recovery.local', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (match) env[match[1]] = match[2].replace(/^['"]|['"]$/g, '').replace(/\\n/g, '\n').trim();
}
const origin = 'https://protovid.dasgroupllc.com';
const account = await fetch(`${origin}/account`);
assert.equal(account.status, 200);
const html = await account.text();
assert(html.includes('Resolve payments and manage your subscription.'));
assert(html.includes('https://billing.stripe.com/p/login/'));
console.log('Production account page and hosted portal link passed.');
for (const [email, status, title] of [
  ['adidush28@gmail.com', 'past_due', 'Your renewal needs attention'],
  ['arjun.s.s.murthy@gmail.com', 'canceled', 'Your paid subscription has ended'],
]) {
  const response = await fetch(`${origin}/api/exports/check`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.subscriptionStatus, status);
  assert.equal(data.isPaid, false);
  assert.equal(data.billingNotice.title, title);
  console.log(`${status}: production entitlement and billing notice passed.`);
}
const unpaidCheckout = await fetch(`${origin}/api/billing/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'adidush28@gmail.com', plan: 'monthly' }) });
assert.equal(unpaidCheckout.status, 409);
assert.equal((await unpaidCheckout.json()).code, 'billing_recovery_required');
console.log('Past-due duplicate checkout blocked without creating a payment.');
const unauthorized = await fetch(`${origin}/api/maintenance/billing-recovery`);
assert.equal(unauthorized.status, 401);
const unsignedWebhook = await fetch(`${origin}/api/billing/webhook`, { method: 'POST', body: '{}' });
assert.equal(unsignedWebhook.status, 400);
console.log('Cron authentication and webhook signature enforcement passed.');
if (env.RESEND_API_KEY || env.BILLING_MANAGEMENT_EMAIL_FROM) throw new Error('Refusing notification smoke test with an active email sender');
const cron = await fetch(`${origin}/api/maintenance/billing-recovery`, { headers: { Authorization: `Bearer ${env.CRON_SECRET}` } });
assert.equal(cron.status, 200);
const result = await cron.json();
assert(!result.results.sent);
assert(!result.results.failed);
console.log('Production reconciliation passed; no emails sent:', JSON.stringify(result));
