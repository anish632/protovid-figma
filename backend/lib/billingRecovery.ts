import { neon } from '@neondatabase/serverless';
import { getStripe } from './stripe';
import { getSubscription } from './storage';
import { deriveBillingState, isInBillingGrace } from './billingState';

/** Refresh current Stripe state instead of trusting possibly late webhook snapshots. */
export async function syncBillingRecovery(email: string) {
  const existing = await getSubscription(email);
  if (!existing.stripeSubscriptionId) return existing;
  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(existing.stripeSubscriptionId);
  const invoiceId = typeof subscription.latest_invoice === 'string'
    ? subscription.latest_invoice : subscription.latest_invoice?.id;
  let invoiceCreated: number | undefined;
  let authenticationRequired = false;
  let establishedRenewal = false;
  if (invoiceId && ['past_due', 'incomplete'].includes(subscription.status)) {
    const invoice = await stripe.invoices.retrieve(invoiceId);
    invoiceCreated = invoice.status_transitions.finalized_at || invoice.created;
    const [payments, paidInvoices] = await Promise.all([
      stripe.invoicePayments.list({ invoice: invoiceId, limit: 10, expand: ['data.payment.payment_intent'] }),
      stripe.invoices.list({ subscription: subscription.id, status: 'paid', limit: 100 }),
    ]);
    authenticationRequired = payments.data.some(payment => {
      const intent = payment.payment.payment_intent;
      return intent && typeof intent !== 'string' && intent.status === 'requires_action';
    });
    establishedRenewal = invoice.billing_reason === 'subscription_cycle'
      && paidInvoices.data.some(paid => paid.id !== invoiceId && paid.amount_paid > 0);
  }
  const state = deriveBillingState({
    status: subscription.status, subscriptionId: subscription.id, invoiceId,
    invoiceCreated, canceledAt: subscription.ended_at || subscription.canceled_at || undefined,
    authenticationRequired, establishedRenewal, previous: existing.billingState,
  });
  const status = ['active', 'trialing', 'past_due', 'canceled'].includes(subscription.status)
    ? subscription.status : subscription.status === 'incomplete' ? 'past_due' : 'canceled';
  const tier = ['active', 'trialing'].includes(status) || isInBillingGrace(state) ? 'pro' : 'free';
  const periodEnd = subscription.items.data[0]?.current_period_end;
  const sql = neon(process.env.NEON_DATABASE_URL!);
  // Do not overwrite a new purchase that changed the subscription ID while Stripe was read.
  await sql`UPDATE protovid_subscriptions SET
    tier = ${tier}, status = ${status}, billing_state = ${JSON.stringify(state)}::jsonb,
    current_period_end = COALESCE(${periodEnd ? new Date(periodEnd * 1000).toISOString() : null}::timestamptz, current_period_end),
    updated_at = CURRENT_TIMESTAMP
    WHERE email = ${existing.email} AND stripe_subscription_id = ${subscription.id}`;
  return getSubscription(email);
}
