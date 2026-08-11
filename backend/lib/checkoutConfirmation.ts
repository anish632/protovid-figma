import type Stripe from 'stripe';
import type { Subscription } from './storage';
import { LARGE_FLOW_PASS_ACCESS_DAYS } from './plans';

type CheckoutLike = Pick<
  Stripe.Checkout.Session,
  'id' | 'customer' | 'customer_details' | 'customer_email' | 'metadata' | 'subscription'
>;

export function getCheckoutEmail(session: CheckoutLike): string | null {
  return (
    session.customer_details?.email ||
    session.customer_email ||
    session.metadata?.email ||
    null
  );
}

export function getCheckoutSubscriptionUpdate(session: CheckoutLike): Partial<Subscription> {
  if (session.metadata?.offer_type === 'large_flow_pass') {
    const parsedDays = Number.parseInt(session.metadata.access_days || '', 10);
    const accessDays = Number.isFinite(parsedDays) && parsedDays > 0
      ? parsedDays
      : LARGE_FLOW_PASS_ACCESS_DAYS;
    const currentPeriodEnd = new Date(Date.now() + accessDays * 24 * 60 * 60 * 1000).toISOString();

    return {
      tier: 'pro',
      status: 'active',
      stripeCustomerId: typeof session.customer === 'string' ? session.customer : undefined,
      // A Project Pass is a one-time payment. Explicitly clear a stale
      // recurring ID when an account previously had a subscription.
      stripeSubscriptionId: undefined,
      currentPeriodEnd,
    };
  }

  return {
    tier: 'pro',
    status: 'active',
    stripeCustomerId: typeof session.customer === 'string' ? session.customer : undefined,
    stripeSubscriptionId: typeof session.subscription === 'string' ? session.subscription : undefined,
    currentPeriodEnd: undefined,
  };
}

export function getCheckoutEventMetadata(
  session: CheckoutLike,
  source: 'stripe_success_redirect' | 'stripe_webhook',
  event?: string
): Record<string, string | null> {
  return {
    source,
    event: event || null,
    stripe_session_id: session.id,
    stripe_subscription_id: typeof session.subscription === 'string' ? session.subscription : null,
    pricing_variant: session.metadata?.pricing_variant || null,
    price_label: session.metadata?.price_label || null,
    amount_cents: session.metadata?.amount_cents || null,
    offer_type: session.metadata?.offer_type || null,
    access_days: session.metadata?.access_days || null,
    offer_experiment_id: session.metadata?.offer_experiment_id || null,
    offer_experiment_variant: session.metadata?.offer_experiment_variant || null,
    primary_offer: session.metadata?.primary_offer || null,
    ...(session.metadata?.anonymousId ? { anonymousId: session.metadata.anonymousId } : {}),
  };
}
