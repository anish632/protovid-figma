import assert from 'node:assert/strict';
import test from 'node:test';
import { getBillingAccessType, hasActivePaidEntitlement } from './billingAccess.js';

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    email: 'buyer@example.com',
    tier: 'free' as const,
    status: 'active' as const,
    exportsThisMonth: 0,
    lastResetMonth: '2026-07',
    ...overrides,
  } as any;
}

test('active Stripe subscriptions are recurring billing access', () => {
  const value = subscription({
    tier: 'pro',
    stripeCustomerId: 'cus_123',
    stripeSubscriptionId: 'sub_123',
  });

  assert.equal(getBillingAccessType(value), 'subscription');
  assert.equal(hasActivePaidEntitlement(value), true);
});

test('a fixed-term Large Flow Pass is paid access but not cancelable subscription access', () => {
  const value = subscription({
    tier: 'pro',
    stripeCustomerId: 'cus_123',
    currentPeriodEnd: '2099-07-18T00:00:00.000Z',
  });

  assert.equal(getBillingAccessType(value), 'one_time_access');
  assert.equal(hasActivePaidEntitlement(value), true);
});

test('expired or canceled fixed-term access does not block a new checkout', () => {
  const value = subscription({
    tier: 'pro',
    status: 'canceled',
    currentPeriodEnd: '2099-07-18T00:00:00.000Z',
  });

  assert.equal(getBillingAccessType(value), 'none');
  assert.equal(hasActivePaidEntitlement(value), false);
});
