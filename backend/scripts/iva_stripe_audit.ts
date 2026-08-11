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

async function main() {
  const email = 'iva@clarion.agency';
  const normalized = email.toLowerCase().trim();

  const dbRows = await sql`
    SELECT
      email,
      tier,
      status,
      stripe_customer_id AS "stripeCustomerId",
      stripe_subscription_id AS "stripeSubscriptionId",
      current_period_end AS "currentPeriodEnd",
      updated_at
    FROM protovid_subscriptions
    WHERE email = ${normalized}
  `;

  console.log(JSON.stringify({ dbRows }, null, 2));

  const customers = await stripe.customers.search({
    query: `email:'${normalized}'`,
    limit: 10,
  });
  console.log(
    JSON.stringify(
      {
        customers: customers.data.map((c) => ({
          id: c.id,
          email: c.email,
          created: c.created,
        })),
      },
      null,
      2
    )
  );

  for (const customer of customers.data) {
    const subs = await stripe.subscriptions.list({
      customer: customer.id,
      limit: 10,
    });
    console.log(
      JSON.stringify(
        {
          customerId: customer.id,
          subscriptions: subs.data.map((s) => {
            const sAny = s as any;
            return {
              id: sAny.id,
              status: sAny.status,
              trial_start: sAny.trial_start,
              trial_end: sAny.trial_end,
              current_period_start: sAny.current_period_start,
              current_period_end: sAny.current_period_end,
              cancel_at_period_end: sAny.cancel_at_period_end,
              canceled_at: sAny.canceled_at,
              latest_invoice:
                typeof sAny.latest_invoice === 'string' ? sAny.latest_invoice : sAny.latest_invoice?.id,
            };
          }),
        },
        null,
        2
      )
    );

    const charges = await stripe.charges.list({
      customer: customer.id,
      limit: 10,
    });
    console.log(
      JSON.stringify(
        {
          customerId: customer.id,
          charges: charges.data.map((c) => {
            const cAny = c as any;
            return {
              id: cAny.id,
              amount: cAny.amount,
              currency: cAny.currency,
              paid: cAny.paid,
              refunded: cAny.refunded,
              created: cAny.created,
              invoice: cAny.invoice,
              payment_intent: cAny.payment_intent,
            };
          }),
        },
        null,
        2
      )
    );

    for (const sub of subs.data) {
      const latestInvoiceId =
        typeof sub.latest_invoice === 'string' ? sub.latest_invoice : sub.latest_invoice?.id;
      if (!latestInvoiceId) continue;
    }
  }

  const eventTypes = [
    'checkout.session.completed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'invoice.payment_succeeded',
  ] as const;

  for (const type of eventTypes) {
    const events = await stripe.events.list({ type, limit: 20 });
    const relevant = events.data.filter((event) => {
      const obj: any = event.data.object;
      return (
        obj?.customer === 'cus_UfihWgIXVmrs8k' ||
        obj?.subscription === 'sub_1TgNGMKOR3CPCI6HmoU7Mn1q' ||
        obj?.client_reference_id === normalized ||
        obj?.customer_email === normalized ||
        obj?.customer_details?.email === normalized
      );
    });

    console.log(
      JSON.stringify(
        {
          type,
          events: relevant.map((event) => {
            const obj: any = event.data.object;
            return {
              id: event.id,
              created: event.created,
              object: event.type,
              customer: obj?.customer,
              subscription: obj?.subscription,
              billing_reason: obj?.billing_reason,
              latest_invoice: obj?.latest_invoice,
              payment_intent: obj?.payment_intent,
              charge: obj?.charge,
              status: obj?.status,
              amount_total: obj?.amount_total,
              amount_paid: obj?.amount_paid,
            };
          }),
        },
        null,
        2
      )
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
