import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCheckoutSessionParams, assertCheckoutPrice } from './stripe.js';

test('checkout refuses a legacy price with a different amount or billing interval', () => {
  const price = { active: true, currency: 'usd', unit_amount: 500, recurring: { interval: 'month', interval_count: 1 } };
  assert.doesNotThrow(() => assertCheckoutPrice(price, { amountCents: 500, interval: 'month' }));
  assert.throws(() => assertCheckoutPrice({ ...price, unit_amount: 800 }, { amountCents: 500, interval: 'month' }));
  assert.throws(() => assertCheckoutPrice(price, { amountCents: 500, interval: null }));
  assert.throws(() => assertCheckoutPrice({ ...price, active: false }, { amountCents: 500, interval: 'month' }));
  assert.doesNotThrow(() => assertCheckoutPrice({ ...price, unit_amount: 400, recurring: null }, { amountCents: 400, interval: null }));
});

test('checkout is self-serve and preserves growth attribution on the subscription', () => {
  const params = buildCheckoutSessionParams({
    priceId: 'price_test',
    customerEmail: 'buyer@example.com',
    successUrl: 'https://example.com/success',
    cancelUrl: 'https://example.com/cancel',
    mode: 'subscription',
    metadata: { pricing_variant: 'studio_monthly' },
  });

  assert.equal(params.customer_email, 'buyer@example.com');
  assert.equal(params.payment_method_types, undefined);
  assert.equal(params.wallet_options, undefined);
  assert.equal(params.metadata?.email, 'buyer@example.com');
  assert.equal(params.metadata?.pricing_variant, 'studio_monthly');
  assert.equal(params.allow_promotion_codes, true);
  assert.equal(params.tax_id_collection?.enabled, true);
  assert.equal(params.subscription_data?.metadata?.pricing_variant, 'studio_monthly');
});

test('one-time checkout creates a reusable Stripe customer', () => {
  const params = buildCheckoutSessionParams({
    priceId: 'price_pass',
    customerEmail: 'buyer@example.com',
    successUrl: 'https://example.com/success',
    cancelUrl: 'https://example.com/cancel',
    mode: 'payment',
  });

  assert.equal(params.customer_creation, 'always');
  assert.equal(params.subscription_data, undefined);
});
