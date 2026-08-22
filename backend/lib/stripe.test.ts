import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCheckoutSessionParams } from './stripe.js';

test('checkout session avoids Link-first authentication so Stripe shows payment options first', () => {
  const params = buildCheckoutSessionParams({
    priceId: 'price_test',
    customerEmail: 'buyer@example.com',
    successUrl: 'https://example.com/success',
    cancelUrl: 'https://example.com/cancel',
    mode: 'subscription',
    metadata: { pricing_variant: 'monthly_5' },
  });

  assert.equal('customer_email' in params, false);
  assert.deepEqual(params.payment_method_types, ['card']);
  assert.deepEqual(params.wallet_options, {
    link: { display: 'never' },
  });
  assert.equal(params.metadata?.email, 'buyer@example.com');
  assert.equal(params.metadata?.pricing_variant, 'monthly_5');
});
