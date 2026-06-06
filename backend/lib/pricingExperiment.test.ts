import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getMonthlyPricingVariant,
  getPricingVariant,
  getPricingVariantWithPriceId,
} from './pricingExperiment.js';

test('monthly pricing cohort is stable for normalized email', () => {
  const first = getMonthlyPricingVariant(' Designer@Example.com ');
  const second = getMonthlyPricingVariant('designer@example.com');

  assert.equal(first.id, second.id);
  assert.equal(first.label, second.label);
});

test('monthly pricing always uses the $5 Pro plan', () => {
  assert.equal(getMonthlyPricingVariant('designer@example.com').id, 'monthly_5');
  assert.equal(getMonthlyPricingVariant('designer@example.com').label, '$5/mo');
  assert.equal(getMonthlyPricingVariant('designer@example.com').amountCents, 500);
});

test('checkout price id uses the configured $5 monthly price', () => {
  const env = {
    PROTOVID_MONTHLY_5_PRICE_ID: 'price_monthly_5',
  } as unknown as NodeJS.ProcessEnv;

  assert.equal(getPricingVariantWithPriceId('designer@example.com', 'monthly', env).priceId, 'price_monthly_5');
});

test('legacy monthly price env var can still provide the $5 Stripe price id', () => {
  const env = {
    PROTOVID_PRICE_ID: 'price_monthly_5_legacy',
  } as unknown as NodeJS.ProcessEnv;

  assert.equal(getPricingVariantWithPriceId('designer@example.com', 'monthly', env).priceId, 'price_monthly_5_legacy');
});

test('yearly requests are normalized to the current monthly Pro offer', () => {
  const env = {
    PROTOVID_MONTHLY_5_PRICE_ID: 'price_monthly_5',
  } as unknown as NodeJS.ProcessEnv;

  assert.equal(getPricingVariant('designer@example.com', 'yearly').id, 'monthly_5');
  assert.equal(getPricingVariantWithPriceId('designer@example.com', 'yearly', env).priceId, 'price_monthly_5');
});
