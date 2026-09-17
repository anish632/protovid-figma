import fs from 'node:fs';
import Stripe from 'stripe';
import { neon } from '@neondatabase/serverless';
for (const line of fs.readFileSync(process.env.BILLING_ENV_FILE || '.env.production', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '').replace(/\\n/g, '\n').trim();
}
const sql = neon(process.env.NEON_DATABASE_URL);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-01-28.clover' });
if (process.argv.includes('--migrate')) {
  for (const statement of fs.readFileSync('scripts/billing-recovery-migration.sql', 'utf8').replace(/^--.*$/gm, '').split(';').filter(s => s.trim())) await sql.query(statement);
  console.log('Additive billing migration applied.');
}
const configs = await stripe.billingPortal.configurations.list({ limit: 100 });
let config = configs.data.find(c => c.metadata?.product === 'protovid' && c.active);
console.log(JSON.stringify({ configurations: configs.data.map(c => ({ id: c.id, active: c.active, isDefault: c.is_default, product: c.metadata?.product })) }));
if (process.argv.includes('--portal')) {
  if (!config) config = await stripe.billingPortal.configurations.create({
    business_profile: { headline: 'Manage your ProtoVid subscription' },
    metadata: { product: 'protovid' },
    default_return_url: 'https://protovid.dasgroupllc.com/account',
    features: { payment_method_update: { enabled: true }, invoice_history: { enabled: true },
      subscription_cancel: { enabled: true, mode: 'at_period_end' } },
  }, { idempotencyKey: 'protovid-billing-portal-v1' });
  const updated = await stripe.billingPortal.configurations.update(config.id, {
    login_page: { enabled: true }, features: { payment_method_update: { enabled: true }, invoice_history: { enabled: true } },
  });
  fs.writeFileSync('/private/tmp/protovid-portal-url.txt', updated.login_page.url + '\n', { mode: 0o600 });
  fs.writeFileSync('/private/tmp/protovid-portal-config.txt', updated.id + '\n', { mode: 0o600 });
  console.log('Stripe portal login enabled; URL and configuration saved for Vercel.');
} else console.log(JSON.stringify({ portalConfigured: Boolean(config) }));
const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
console.log(JSON.stringify({ webhooks: endpoints.data.map(e => ({ id: e.id, url: e.url, status: e.status, events: e.enabled_events })) }));
if (process.argv.includes('--webhook')) {
  const endpoint = endpoints.data.find(e => e.url === 'https://backend-one-nu-28.vercel.app/api/billing/webhook');
  if (!endpoint) throw new Error('Production webhook not found');
  if (!endpoint.enabled_events.includes('*') && !endpoint.enabled_events.includes('invoice.payment_action_required')) {
    await stripe.webhookEndpoints.update(endpoint.id, { enabled_events: [...endpoint.enabled_events, 'invoice.payment_action_required'] });
    console.log('Authentication-required webhook enabled.');
  }
}
