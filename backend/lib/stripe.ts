import Stripe from 'stripe';

export function assertCheckoutPrice(price: {
  active: boolean; currency: string; unit_amount: number | null;
  recurring?: { interval: string; interval_count: number } | null;
}, expected: { amountCents: number; interval: 'month' | 'year' | null }) {
  if (!price.active || price.currency !== 'usd' || price.unit_amount !== expected.amountCents
    || (expected.interval === null ? Boolean(price.recurring)
      : price.recurring?.interval !== expected.interval || price.recurring?.interval_count !== 1)) {
    throw new Error('Checkout price configuration does not match the displayed offer');
  }
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(key, {
    apiVersion: '2026-01-28.clover',
  });
}

export async function createCheckoutSession(params: {
  priceId: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
  mode?: 'subscription' | 'payment';
  metadata?: Record<string, string>;
  trialDays?: number;
  expectedPrice?: { amountCents: number; interval: 'month' | 'year' | null };
}) {
  const stripe = getStripe();
  if (params.expectedPrice) {
    assertCheckoutPrice(await stripe.prices.retrieve(params.priceId), params.expectedPrice);
  }
  const sessionParams = buildCheckoutSessionParams(params);
  const session = await stripe.checkout.sessions.create(sessionParams);
  if (!session.url) {
    throw new Error('Stripe did not return a checkout URL');
  }

  return {
    id: session.id,
    url: session.url,
  };
}

export function buildCheckoutSessionParams(params: {
  priceId: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
  mode?: 'subscription' | 'payment';
  metadata?: Record<string, string>;
  trialDays?: number;
}): Stripe.Checkout.SessionCreateParams {
  const mode = params.mode || 'subscription';

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    line_items: [
      {
        price: params.priceId,
        quantity: 1,
      },
    ],
    mode,
    customer_email: params.customerEmail,
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    tax_id_collection: { enabled: true },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      email: params.customerEmail,
      trial_days: String(params.trialDays || 0),
      ...params.metadata,
    },
  };

  if (mode === 'subscription') {
    sessionParams.subscription_data = {
      metadata: sessionParams.metadata,
      ...(params.trialDays && params.trialDays > 0
        ? { trial_period_days: params.trialDays }
        : {}),
    };
  }

  if (mode === 'payment') {
    sessionParams.customer_creation = 'always';
  }

  return sessionParams;
}

export async function createPortalSession(customerId: string, returnUrl: string) {
  const stripe = getStripe();
  
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    configuration: process.env.STRIPE_CUSTOMER_PORTAL_CONFIGURATION_ID?.trim() || undefined,
    return_url: returnUrl,
  });

  return session.url;
}

export async function retrieveCheckoutSession(sessionId: string) {
  const stripe = getStripe();
  return stripe.checkout.sessions.retrieve(sessionId);
}

export async function retrieveSubscription(subscriptionId: string) {
  const stripe = getStripe();
  return stripe.subscriptions.retrieve(subscriptionId);
}

export function verifyWebhook(body: string, signature: string): Stripe.Event {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET not configured');
  }

  return stripe.webhooks.constructEvent(body, signature, secret);
}
