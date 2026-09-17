import assert from 'node:assert/strict';
import test from 'node:test';
import { getRefundedAmountCents, summarizeChargeRevenue, subscriptionMonthlyRevenueCents } from './revenue.js';

test('MRR normalizes annual and multi-month items and quantities, excluding trials', () => {
  const subscription = { status: 'active', items: { data: [
    { quantity: 2, price: { unit_amount: 500, recurring: { interval: 'month', interval_count: 1 } } },
    { quantity: 1, price: { unit_amount: 39000, recurring: { interval: 'year', interval_count: 1 } } },
    { price: { unit_amount: 1500, recurring: { interval: 'month', interval_count: 3 } } },
  ] } };
  assert.equal(subscriptionMonthlyRevenueCents(subscription), 4750);
  assert.equal(subscriptionMonthlyRevenueCents({ ...subscription, status: 'trialing' }), 0);
  assert.equal(subscriptionMonthlyRevenueCents({ ...subscription, status: 'canceled' }), 0);
});

test('revenue includes paid charges before subtracting a full refund once', () => {
  const summary = summarizeChargeRevenue([
    { paid: true, amount: 500, amount_refunded: 0, refunded: false },
    { paid: true, amount: 500, amount_refunded: 500, refunded: true },
    { paid: true, amount: 1_000, amount_refunded: 0, refunded: false },
  ]);

  assert.deepEqual(summary, {
    paidChargeCount: 3,
    refundedChargeCount: 1,
    fullyRefundedChargeCount: 1,
    partiallyRefundedChargeCount: 0,
    grossRevenueCents: 2_000,
    refundedRevenueCents: 500,
    netRevenueCents: 1_500,
  });
});

test('revenue handles partial refunds without treating the charge as fully refunded', () => {
  const summary = summarizeChargeRevenue([
    { paid: true, amount: 1_000, amount_refunded: 250, refunded: false },
    { paid: false, amount: 500, amount_refunded: 500, refunded: true },
  ]);

  assert.equal(summary.grossRevenueCents, 1_000);
  assert.equal(summary.refundedRevenueCents, 250);
  assert.equal(summary.netRevenueCents, 750);
  assert.equal(summary.refundedChargeCount, 1);
  assert.equal(summary.fullyRefundedChargeCount, 0);
  assert.equal(summary.partiallyRefundedChargeCount, 1);
});

test('legacy full-refund records without amount_refunded still subtract once', () => {
  assert.equal(
    getRefundedAmountCents({ paid: true, amount: 500, refunded: true }),
    500
  );
});

test('refund amounts are bounded to the original paid charge amount', () => {
  assert.equal(
    getRefundedAmountCents({ paid: true, amount: 500, amount_refunded: 999 }),
    500
  );
});
