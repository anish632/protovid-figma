import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getCheckoutEmail,
  getCheckoutEventMetadata,
  getCheckoutSubscriptionUpdate,
} from './checkoutConfirmation.js';

test('checkout confirmation uses customer details email when present', () => {
  const email = getCheckoutEmail({
    id: 'cs_test_123',
    customer: 'cus_123',
    customer_details: { email: 'buyer@example.com' },
    customer_email: 'fallback@example.com',
    metadata: { email: 'metadata@example.com' },
    subscription: 'sub_123',
  } as any);

  assert.equal(email, 'buyer@example.com');
});

test('checkout confirmation falls back to metadata email', () => {
  const email = getCheckoutEmail({
    id: 'cs_test_123',
    customer: null,
    customer_details: null,
    customer_email: null,
    metadata: { email: 'metadata@example.com' },
    subscription: null,
  } as any);

  assert.equal(email, 'metadata@example.com');
});

test('checkout confirmation builds active Pro entitlement update', () => {
  const update = getCheckoutSubscriptionUpdate({
    id: 'cs_test_123',
    customer: 'cus_123',
    customer_details: null,
    customer_email: 'buyer@example.com',
    metadata: {},
    subscription: 'sub_123',
  } as any);

  assert.deepEqual(update, {
    tier: 'pro',
    status: 'active',
    stripeCustomerId: 'cus_123',
    stripeSubscriptionId: 'sub_123',
  });
});

test('checkout event metadata preserves pricing variant attribution', () => {
  const metadata = getCheckoutEventMetadata(
    {
      id: 'cs_test_123',
      customer: 'cus_123',
      customer_details: null,
      customer_email: 'buyer@example.com',
      metadata: {
        pricing_variant: 'monthly_5',
        price_label: '$5/mo',
        amount_cents: '500',
      },
      subscription: 'sub_123',
    } as any,
    'stripe_webhook',
    'checkout.session.completed'
  );

  assert.deepEqual(metadata, {
    source: 'stripe_webhook',
    event: 'checkout.session.completed',
    stripe_session_id: 'cs_test_123',
    stripe_subscription_id: 'sub_123',
    pricing_variant: 'monthly_5',
    price_label: '$5/mo',
    amount_cents: '500',
  });
});
