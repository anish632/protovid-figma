import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getMonthlyPricingVariant,
  getPricingVariant,
  getPricingVariantForEnvironment,
  getPricingVariantWithPriceId,
} from './pricingExperiment.js';

function emailForVariant(target: 'monthly_5' | 'monthly_8'): string {
  for (let i = 0; i < 1000; i++) {
    const email = `pricing-test-${i}@example.com`;
    if (getMonthlyPricingVariant(email).id === target) return email;
  }

  throw new Error(`Could not find ${target} test email`);
}

test('monthly pricing cohort is stable for normalized email', () => {
  const first = getMonthlyPricingVariant(' Designer@Example.com ');
  const second = getMonthlyPricingVariant('designer@example.com');

  assert.equal(first.id, second.id);
  assert.equal(first.label, second.label);
});

test('monthly pricing experiment can assign both $5 and $8 variants', () => {
  const fiveDollarEmail = emailForVariant('monthly_5');
  const eightDollarEmail = emailForVariant('monthly_8');

  assert.equal(getMonthlyPricingVariant(fiveDollarEmail).label, '$5/mo');
  assert.equal(getMonthlyPricingVariant(eightDollarEmail).label, '$8/mo');
});

test('checkout price id follows assigned monthly variant', () => {
  const env = {
    PROTOVID_MONTHLY_5_PRICE_ID: 'price_monthly_5',
    PROTOVID_PRICE_ID: 'price_monthly_8',
    PROTOVID_YEARLY_PRICE_ID: 'price_yearly_29',
  } as unknown as NodeJS.ProcessEnv;

  assert.equal(getPricingVariantWithPriceId(emailForVariant('monthly_5'), 'monthly', env).priceId, 'price_monthly_5');
  assert.equal(getPricingVariantWithPriceId(emailForVariant('monthly_8'), 'monthly', env).priceId, 'price_monthly_8');
});

test('monthly $5 cohort falls back to $8 until the $5 Stripe price is configured', () => {
  const env = {
    PROTOVID_PRICE_ID: 'price_monthly_8',
    PROTOVID_YEARLY_PRICE_ID: 'price_yearly_29',
  } as unknown as NodeJS.ProcessEnv;

  assert.equal(getMonthlyPricingVariant(emailForVariant('monthly_5')).id, 'monthly_5');
  assert.equal(getPricingVariantForEnvironment(emailForVariant('monthly_5'), 'monthly', env).id, 'monthly_8');
  assert.equal(getPricingVariantWithPriceId(emailForVariant('monthly_5'), 'monthly', env).priceId, 'price_monthly_8');
});

test('yearly pricing is not part of the monthly price experiment', () => {
  const env = {
    PROTOVID_MONTHLY_5_PRICE_ID: 'price_monthly_5',
    PROTOVID_PRICE_ID: 'price_monthly_8',
    PROTOVID_YEARLY_PRICE_ID: 'price_yearly_29',
  } as unknown as NodeJS.ProcessEnv;

  assert.equal(getPricingVariant('designer@example.com', 'yearly').id, 'yearly_29');
  assert.equal(getPricingVariantWithPriceId('designer@example.com', 'yearly', env).priceId, 'price_yearly_29');
});
