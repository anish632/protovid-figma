import Stripe from 'stripe';

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
}) {
  const stripe = getStripe();
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
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    payment_method_types: ['card'],
    wallet_options: {
      link: { display: 'never' },
    },
    metadata: {
      email: params.customerEmail,
      trial_days: String(params.trialDays || 0),
      ...params.metadata,
    },
  };

  // Add trial period if specified
  if (mode === 'subscription' && params.trialDays && params.trialDays > 0) {
    sessionParams.subscription_data = {
      trial_period_days: params.trialDays,
    };
  }

  return sessionParams;
}

export async function createPortalSession(customerId: string, returnUrl: string) {
  const stripe = getStripe();
  
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
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
