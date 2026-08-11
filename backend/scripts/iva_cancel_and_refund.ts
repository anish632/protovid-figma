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

  const customers = await stripe.customers.search({
    query: `email:'${normalized}'`,
    limit: 10,
  });

  const customer = customers.data[0];
  if (!customer) {
    throw new Error(`No Stripe customer found for ${normalized}`);
  }

  const subs = await stripe.subscriptions.list({
    customer: customer.id,
    status: 'all',
    limit: 10,
  });

  const subscription = subs.data[0];
  if (!subscription) {
    throw new Error(`No Stripe subscription found for ${customer.id}`);
  }

  const latestInvoiceId =
    typeof subscription.latest_invoice === 'string'
      ? subscription.latest_invoice
      : subscription.latest_invoice?.id;
  if (!latestInvoiceId) {
    throw new Error(`Subscription ${subscription.id} has no latest invoice`);
  }

  const invoice = await stripe.invoices.retrieve(latestInvoiceId);
  const invoiceAny = invoice as any;
  const chargeId =
    typeof invoiceAny.charge === 'string' ? invoiceAny.charge : invoiceAny.charge?.id;
  const paymentIntentId =
    typeof invoiceAny.payment_intent === 'string'
      ? invoiceAny.payment_intent
      : invoiceAny.payment_intent?.id;
  const charges = await stripe.charges.list({
    customer: customer.id,
    limit: 10,
  });
  const matchedCharge =
    charges.data.find(
      (charge) => {
        const chargeAny = charge as any;
        return (
          chargeAny.invoice === invoice.id ||
          chargeAny.payment_intent === paymentIntentId ||
          chargeAny.amount === invoiceAny.amount_paid
        );
      }
    ) || charges.data[0];
  const resolvedChargeId = chargeId || matchedCharge?.id;

  console.log(
    JSON.stringify(
      {
        customer: { id: customer.id, email: customer.email },
        subscription: {
          id: subscription.id,
          status: subscription.status,
          trial_start: subscription.trial_start,
          trial_end: subscription.trial_end,
          cancel_at_period_end: subscription.cancel_at_period_end,
        },
        invoice: {
          id: invoiceAny.id,
          status: invoiceAny.status,
          amount_paid: invoiceAny.amount_paid,
          amount_due: invoiceAny.amount_due,
          paid: invoiceAny.paid,
          billing_reason: invoiceAny.billing_reason,
          chargeId,
          resolvedChargeId,
          paymentIntentId,
          charges: charges.data.map((c) => ({
            ...(() => {
              const cAny = c as any;
              return {
                id: cAny.id,
                amount: cAny.amount,
                created: cAny.created,
                refunded: cAny.refunded,
                invoice: cAny.invoice,
                payment_intent: cAny.payment_intent,
              };
            })(),
          })),
        },
      },
      null,
      2
    )
  );

  if (subscription.status !== 'canceled' && subscription.status !== 'incomplete_expired') {
    const canceled = await stripe.subscriptions.cancel(subscription.id);
    console.log(
      JSON.stringify(
        {
          subscription_canceled: {
            id: canceled.id,
            status: canceled.status,
            canceled_at: canceled.canceled_at,
          },
        },
        null,
        2
      )
    );
  } else {
    console.log(`Subscription already in terminal state: ${subscription.status}`);
  }

  if (invoiceAny.amount_paid > 0) {
    const refundParams: Stripe.RefundCreateParams = {
      reason: 'requested_by_customer',
    };
    if (resolvedChargeId) {
      refundParams.charge = resolvedChargeId;
    } else if (paymentIntentId) {
      refundParams.payment_intent = paymentIntentId;
    } else {
      throw new Error('No charge or payment intent available for refund');
    }

    const refund = await stripe.refunds.create(refundParams);
    console.log(
      JSON.stringify(
        {
          refund: {
            id: refund.id,
            amount: refund.amount,
            currency: refund.currency,
            status: refund.status,
            charge: refund.charge,
            payment_intent: refund.payment_intent,
          },
        },
        null,
        2
      )
    );
  } else {
    console.log('Invoice has no paid amount; skipping refund.');
  }

  await sql`
    INSERT INTO protovid_events (
      email,
      event_type,
      plugin_version,
      metadata,
      created_at
    ) VALUES (
      ${normalized},
      ${'subscription_cancelled_refunded_admin'},
      ${'support'},
      ${JSON.stringify({
        source: 'manual_support',
        stripe_customer_id: customer.id,
        stripe_subscription_id: subscription.id,
        stripe_invoice_id: invoice.id,
        stripe_charge_id: resolvedChargeId || chargeId,
        stripe_payment_intent_id: paymentIntentId,
      })},
      CURRENT_TIMESTAMP
    )
  `;

  await sql`
    UPDATE protovid_subscriptions
    SET tier = 'free',
        status = 'canceled',
        stripe_customer_id = NULL,
        stripe_subscription_id = NULL,
        current_period_end = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE email = ${normalized}
  `;

  console.log(
    JSON.stringify(
      {
        done: true,
        email: normalized,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
