import fs from 'node:fs';
import path from 'node:path';
import Stripe from 'stripe';
import { neon } from '@neondatabase/serverless';

function loadEnvFile(filePath: string) {
  const text = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    value = value.replace(/\\n/g, '\n').trim();
    process.env[key] = value;
  }
}

loadEnvFile(path.join(process.cwd(), '.env.production'));

const stripeKey = process.env.STRIPE_SECRET_KEY;
const dbUrl = process.env.NEON_DATABASE_URL;

if (!stripeKey || !dbUrl) {
  throw new Error('Missing required environment variables');
}

const stripe = new Stripe(stripeKey, { apiVersion: '2026-01-28.clover' });
const sql = neon(dbUrl);

type EventRow = {
  email: string | null;
  event_type: string;
  plugin_version: string | null;
  metadata: any;
  created_at: string;
};

function scoreOutcome(events: EventRow[]) {
  const byType = new Map<string, EventRow[]>();
  for (const event of events) {
    const list = byType.get(event.event_type) || [];
    list.push(event);
    byType.set(event.event_type, list);
  }

  const exportEvents =
    (byType.get('video_export_completed')?.length || 0) +
    (byType.get('export_success')?.length || 0) +
    (byType.get('export_completed')?.length || 0);
  const paywallViews = byType.get('paywall_viewed')?.length || 0;
  const checkoutStarts =
    (byType.get('checkout_start')?.length || 0) +
    (byType.get('checkout_opened')?.length || 0);
  const checkoutCompleted = byType.get('checkout_completed')?.length || 0;
  const paymentConfirmed = byType.get('payment_confirmed')?.length || 0;
  const trialConverted = byType.get('trial_converted')?.length || 0;
  const cancellations =
    (byType.get('trial_cancelled_manually')?.length || 0) +
    (byType.get('subscription_cancelled_user')?.length || 0) +
    (byType.get('subscription_cancelled_refunded_admin')?.length || 0);

  let score = 50;

  score += Math.min(exportEvents * 4, 24);
  score += Math.min(paywallViews * 3, 12);
  score += Math.min(checkoutStarts * 8, 16);
  score += Math.min(checkoutCompleted * 8, 16);
  score += Math.min(paymentConfirmed * 12, 20);
  score += Math.min(trialConverted * 20, 20);
  score -= Math.min(cancellations * 25, 25);

  const recentDays = events.slice(0, 7);
  const recentActivity = recentDays.length;
  score += Math.min(recentActivity * 2, 10);

  score = Math.max(0, Math.min(100, score));

  const prediction =
    score >= 70 ? 'likely_convert' : score >= 45 ? 'uncertain' : 'likely_cancel';

  return {
    score,
    prediction,
    signals: {
      exportEvents,
      paywallViews,
      checkoutStarts,
      checkoutCompleted,
      paymentConfirmed,
      trialConverted,
      cancellations,
      recentActivity,
    },
  };
}

async function main() {
  const stripeCustomerId = 'cus_Uj5xFI0xRIGUxi';

  const customer = await stripe.customers.retrieve(stripeCustomerId);
  const customerAny = customer as any;
  const customerEmail = customerAny.email || null;

  const subscriptionList = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: 'all',
    limit: 10,
  });

  const appEmail =
    customerEmail ||
    subscriptionList.data.find((sub) => sub.metadata?.email)?.metadata?.email ||
    null;

  if (!appEmail) {
    throw new Error(`Could not determine email for Stripe customer ${stripeCustomerId}`);
  }

  const normalizedEmail = appEmail.toLowerCase().trim();

  const [subscriptionRow] = await sql`
    SELECT email, tier, status, current_period_end, updated_at
    FROM protovid_subscriptions
    WHERE email = ${normalizedEmail}
  `;

  const recentEvents = await sql`
    SELECT email, event_type, plugin_version, metadata, created_at
    FROM protovid_events
    WHERE email = ${normalizedEmail}
      AND created_at >= ${new Date('2026-06-01T00:00:00.000Z')}
    ORDER BY created_at DESC
  `;

  const allKnownEvents = await sql`
    SELECT email, event_type, plugin_version, metadata, created_at
    FROM protovid_events
    WHERE email = ${normalizedEmail}
    ORDER BY created_at DESC
    LIMIT 200
  `;

  const prediction = scoreOutcome(allKnownEvents as EventRow[]);

  const summary = {
    stripeCustomerId,
    appEmail: normalizedEmail,
    stripeCustomerEmail: customerEmail,
    subscriptionRow: subscriptionRow || null,
    stripeSubscriptions: subscriptionList.data.map((sub) => ({
      ...(() => {
        const subAny = sub as any;
        return {
          id: subAny.id,
          status: subAny.status,
          trial_start: subAny.trial_start,
          trial_end: subAny.trial_end,
          current_period_end: subAny.current_period_end,
          cancel_at_period_end: subAny.cancel_at_period_end,
          canceled_at: subAny.canceled_at,
          latest_invoice:
            typeof subAny.latest_invoice === 'string'
              ? subAny.latest_invoice
              : subAny.latest_invoice?.id,
        };
      })(),
    })),
    recentEvents: (recentEvents as EventRow[]).slice(0, 50).map((e) => ({
      event_type: e.event_type,
      created_at: e.created_at,
      metadata: e.metadata,
    })),
    prediction,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
