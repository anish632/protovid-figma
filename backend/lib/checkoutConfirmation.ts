import type Stripe from 'stripe';
import type { Subscription } from './storage';

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
  return {
    tier: 'pro',
    status: 'active',
    stripeCustomerId: typeof session.customer === 'string' ? session.customer : undefined,
    stripeSubscriptionId: typeof session.subscription === 'string' ? session.subscription : undefined,
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
  };
}
