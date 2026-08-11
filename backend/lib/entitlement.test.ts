import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEntitlementResponse } from './entitlement.js';
import { FREE_TIER_EXPORT_LIMIT } from './plans.js';
import { formatQuotaText } from '../../src/entitlement.js';

const billingDate = new Date('2026-06-05T12:00:00.000Z');

test('free entitlement allows backend-configured watermarked exports', () => {
  const entitlement = buildEntitlementResponse('pv_free', {
    email: 'pv_free',
    tier: 'free',
    status: 'active',
    exportsThisMonth: 0,
    lastResetMonth: '2026-06',
  }, billingDate);

  assert.equal(FREE_TIER_EXPORT_LIMIT, 3);
  assert.equal(entitlement.canExport, true);
  assert.equal(entitlement.watermarkRequired, true);
  assert.equal(entitlement.freeExportsLimit, 3);
  assert.equal(entitlement.freeExportsUsed, 0);
  assert.equal(entitlement.freeExportsRemaining, 3);
  assert.equal(formatQuotaText(entitlement), '3 free exports remaining this month');
});

test('free entitlement blocks export when the backend quota is exhausted', () => {
  const entitlement = buildEntitlementResponse('pv_exhausted', {
    email: 'pv_exhausted',
    tier: 'free',
    status: 'active',
    exportsThisMonth: 3,
    lastResetMonth: '2026-06',
  }, billingDate);

  assert.equal(entitlement.canExport, false);
  assert.equal(entitlement.upgradeRequired, true);
  assert.equal(entitlement.freeExportsRemaining, 0);
  assert.equal(formatQuotaText(entitlement), 'No free exports remaining this month');
});

test('paid entitlement wins even when free quota is zero', () => {
  const entitlement = buildEntitlementResponse('buyer@example.com', {
    email: 'buyer@example.com',
    tier: 'pro',
    status: 'active',
    exportsThisMonth: 1,
    lastResetMonth: '2026-06',
  }, billingDate);

  assert.equal(entitlement.isPaid, true);
  assert.equal(entitlement.canExport, true);
  assert.equal(entitlement.watermarkRequired, false);
  assert.equal(entitlement.upgradeRequired, false);
  assert.equal(entitlement.freeExportsRemaining, 0);
  assert.equal(formatQuotaText(entitlement), 'Unlimited exports included');
});

test('UI quota helper uses backend values and has no fallback to three', () => {
  const entitlement = {
    ...buildEntitlementResponse('pv_limit_one', {
      email: 'pv_limit_one',
      tier: 'free',
      status: 'active',
      exportsThisMonth: 0,
      lastResetMonth: '2026-06',
    }, billingDate),
    freeExportsLimit: 1,
    freeExportsRemaining: 1,
  };

  assert.doesNotMatch(formatQuotaText(entitlement), /\b3\b/);
  assert.equal(formatQuotaText(entitlement), '1 free export remaining this month');
});

test('UI quota helper displays three when the backend entitlement returns three', () => {
  const entitlement = buildEntitlementResponse('pv_limit_three', {
    email: 'pv_limit_three',
    tier: 'free',
    status: 'active',
    exportsThisMonth: 0,
    lastResetMonth: '2026-06',
  }, billingDate);

  assert.equal(formatQuotaText(entitlement), '3 free exports remaining this month');
});
