// Read-only production audit. Exports aggregates only, never customer identities.
// Run from backend: node scripts/growth-snapshot.mjs [output-directory]
import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import Stripe from 'stripe';

for (const line of fs.readFileSync(process.env.GROWTH_ENV_FILE || '.env.production', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '').replace(/\\n/g, '\n').trim();
}
const asOf = new Date();
const output = path.resolve(process.argv[2] || `../analysis/${asOf.toISOString().slice(0, 10)}-usage`);
fs.mkdirSync(output, { recursive: true });
const save = (name, data) => fs.writeFileSync(path.join(output, `${name}.json`), JSON.stringify(data, null, 2) + '\n');
const sql = neon(process.env.NEON_DATABASE_URL);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const since = Math.floor(asOf.getTime() / 1000) - 30 * 86400;
const until = Math.floor(asOf.getTime() / 1000);
const results = await Promise.allSettled([
  (async () => {
    const response = await fetch('https://protovid.dasgroupllc.com/api/stats', { headers: { 'x-api-key': process.env.STATS_API_KEY }, signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`Stats HTTP ${response.status}`);
    const { recentEvents, ...aggregates } = await response.json();
    save('stats', aggregates);
    return 'stats';
  })(),
  (async () => {
    const query = fs.readFileSync('../growth/2026-09-organic/weekly-cohorts.sql', 'utf8').replace('CURRENT_TIMESTAMP AS as_of', `'${asOf.toISOString()}'::timestamptz AS as_of`);
    save('cohorts', await sql.query(query));
    save('versions', await sql`SELECT plugin_version, count(*) events, count(DISTINCT metadata::jsonb->>'anonymousId') actors FROM protovid_events WHERE event_type='session_opened' AND created_at >= ${asOf.toISOString()}::timestamptz - interval '7 days' AND created_at < ${asOf.toISOString()}::timestamptz GROUP BY 1 ORDER BY events DESC`);
    save('errors', await sql`SELECT event_type, metadata::jsonb->>'reason' reason, count(*) events, count(DISTINCT metadata::jsonb->>'anonymousId') anonymous_actors FROM protovid_events WHERE created_at >= ${asOf.toISOString()}::timestamptz - interval '7 days' AND created_at < ${asOf.toISOString()}::timestamptz AND (event_type LIKE '%failed%' OR event_type LIKE '%error%') GROUP BY 1,2 ORDER BY events DESC`);
    save('checkout-diagnostics', await sql`SELECT plugin_version, event_type, metadata::jsonb->>'plan' plan, metadata::jsonb->>'source' source, count(*) events, count(DISTINCT metadata::jsonb->>'anonymousId') anonymous_actors FROM protovid_events WHERE created_at >= ${asOf.toISOString()}::timestamptz - interval '7 days' AND created_at < ${asOf.toISOString()}::timestamptz AND event_type IN ('upgrade_clicked','checkout_email_prompt_shown','checkout_email_submitted','checkout_email_validation_failed','checkout_email_abandoned','checkout_created','checkout_error','payment_confirmed') GROUP BY 1,2,3,4 ORDER BY 1,2`);
    return 'database';
  })(),
  (async () => {
    const [subscriptions, charges, sessions] = await Promise.all([
      stripe.subscriptions.list({ status: 'all', limit: 100 }).autoPagingToArray({ limit: 10000 }),
      stripe.charges.list({ limit: 100 }).autoPagingToArray({ limit: 10000 }),
      stripe.checkout.sessions.list({ created: { gte: since, lt: until }, limit: 100 }).autoPagingToArray({ limit: 10000 }),
    ]);
    const currencies = [...new Set(charges.map(c => c.currency).concat(subscriptions.flatMap(s => s.items.data.map(i => i.price.currency))))];
    const revenue = currencies.map(currency => {
      const paid = charges.filter(c => c.currency === currency && c.paid && c.created < until);
      const recent = paid.filter(c => c.created >= since);
      const active = subscriptions.filter(s => s.status === 'active');
      const mrrCents = active.flatMap(s => s.items.data).filter(i => i.price.currency === currency).reduce((sum, i) => {
        const r = i.price.recurring;
        const months = r && ({ month: 1, year: 12, week: 12 / 52, day: 12 / 365 })[r.interval];
        return sum + (months ? (i.price.unit_amount || 0) * (i.quantity ?? 1) / (months * r.interval_count) : 0);
      }, 0);
      return { currency, activeSubscriptions: active.filter(s => s.items.data.some(i => i.price.currency === currency)).length, mrrCents,
        lifetimeGrossCents: paid.reduce((n,c) => n+c.amount,0), lifetimeRefundedCents: paid.reduce((n,c) => n+c.amount_refunded,0),
        grossCollected30dCents: recent.reduce((n,c) => n+c.amount,0), paidCharges30d: recent.length,
        paidCheckoutSessions30d: sessions.filter(s => s.currency === currency && s.payment_status === 'paid').length,
        paidPassSessions30d: sessions.filter(s => s.currency === currency && s.mode === 'payment' && s.payment_status === 'paid').length };
    });
    save('revenue', { asOf: asOf.toISOString(), scope: 'Configured Stripe account; not product filtered. Gross excludes no fees or taxes. Checkout window uses creation date. Refunds are lifetime to retrieval.', revenue });
    return 'stripe';
  })(),
]);
const status = results.map((r, i) => ({ source: ['stats', 'database', 'stripe'][i], status: r.status, ...(r.status === 'rejected' ? { error: r.reason?.message || 'Request failed' } : {}) }));
save('collection', { asOf: asOf.toISOString(), status });
console.log(JSON.stringify({ output, status }, null, 2));
if (results.some(r => r.status === 'rejected')) process.exitCode = 1;
