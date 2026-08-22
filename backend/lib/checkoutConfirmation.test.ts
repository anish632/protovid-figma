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
    currentPeriodEnd: undefined,
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
    offer_type: null,
    access_days: null,
    offer_experiment_id: null,
    offer_experiment_variant: null,
    primary_offer: null,
    pricing_page_experiment_id: null,
    pricing_page_experiment_variant: null,
  });
});

test('checkout event metadata preserves paid-offer experiment attribution', () => {
  const metadata = getCheckoutEventMetadata({
    id: 'cs_test_offer_experiment',
    customer: 'cus_test',
    customer_details: null,
    customer_email: 'designer@example.com',
    metadata: {
      offer_experiment_id: 'project_pass_primary_v1',
      offer_experiment_variant: 'project_pass_first',
      primary_offer: 'large_export',
    },
    subscription: null,
  }, 'stripe_webhook');

  assert.equal(metadata.offer_experiment_id, 'project_pass_primary_v1');
  assert.equal(metadata.offer_experiment_variant, 'project_pass_first');
  assert.equal(metadata.primary_offer, 'large_export');
});

test('checkout event metadata preserves pricing page experiment attribution', () => {
  const metadata = getCheckoutEventMetadata({
    id: 'cs_test_pricing_page_experiment',
    customer: 'cus_test',
    customer_details: null,
    customer_email: 'designer@example.com',
    metadata: {
      pricing_page_experiment_id: 'good_better_best_pricing_v1',
      pricing_page_experiment_variant: 'good_better_best',
      anonymousId: 'pricing_actor_123',
    },
    subscription: null,
  }, 'stripe_webhook');

  assert.equal(metadata.pricing_page_experiment_id, 'good_better_best_pricing_v1');
  assert.equal(metadata.pricing_page_experiment_variant, 'good_better_best');
  assert.equal(metadata.anonymousId, 'pricing_actor_123');
});

test('checkout confirmation builds temporary Pro access for large flow pass', () => {
  const before = Date.now();
  const update = getCheckoutSubscriptionUpdate({
    id: 'cs_test_456',
    customer: 'cus_456',
    customer_details: null,
    customer_email: 'buyer@example.com',
    metadata: {
      offer_type: 'large_flow_pass',
      access_days: '7',
    },
    subscription: null,
  } as any);

  assert.equal(update.tier, 'pro');
  assert.equal(update.status, 'active');
  assert.equal(update.stripeCustomerId, 'cus_456');
  assert.equal(update.stripeSubscriptionId, undefined);
  assert.ok(update.currentPeriodEnd);

  const periodEnd = new Date(update.currentPeriodEnd!).getTime();
  const accessMs = 7 * 24 * 60 * 60 * 1000;
  assert.ok(periodEnd >= before + accessMs - 1000);
  assert.ok(periodEnd <= Date.now() + accessMs + 1000);
});
