import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OFFER_EXPERIMENT_ID,
  getLargeFlowPassForEnvironment,
  getMonthlyPricingVariant,
  getOfferExperimentAssignment,
  getPricingVariant,
  getPricingVariantWithPriceId,
} from './pricingExperiment.js';

test('Project Pass primary experiment assignment is stable for an actor', () => {
  const first = getOfferExperimentAssignment('pv_actor_123');
  const second = getOfferExperimentAssignment('pv_actor_123');

  assert.deepEqual(first, second);
  assert.equal(first.id, OFFER_EXPERIMENT_ID);
  assert.equal(['pro_first', 'project_pass_first'].includes(first.variant), true);
  assert.equal(first.primaryOffer, first.variant === 'project_pass_first' ? 'large_export' : 'monthly');
});

test('Project Pass experiment falls back to Pro first when the pass is unavailable', () => {
  assert.deepEqual(getOfferExperimentAssignment('pv_actor_123', false), {
    id: OFFER_EXPERIMENT_ID,
    variant: 'pro_first',
    primaryOffer: 'monthly',
  });
});

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

test('Project Pass uses the dedicated one-time price before legacy env vars', () => {
  const env = {
    PROTOVID_PROJECT_PASS_PRICE_ID: 'price_project_pass',
    PROTOVID_LARGE_EXPORT_PRICE_ID: 'price_legacy_pass',
  } as unknown as NodeJS.ProcessEnv;

  const pass = getLargeFlowPassForEnvironment(env);
  assert.equal(pass?.priceId, 'price_project_pass');
  assert.equal(pass?.label, '$4 once');
  assert.equal(pass?.amountCents, 400);
  assert.equal(pass?.accessDays, 7);
});
