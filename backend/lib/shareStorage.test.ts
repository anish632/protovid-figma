import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeShareExperimentVariant,
  resolveShareTtlDays,
  FREE_SHARE_TTL_DAYS,
  PAID_SHARE_TTL_DAYS,
  SUBSCRIPTION_SHARE_TTL_DAYS,
} from './shareStorage.js';

test('share experiment variants are restricted to the registered cohorts', () => {
  assert.equal(normalizeShareExperimentVariant('control'), 'control');
  assert.equal(normalizeShareExperimentVariant('invite_panel'), 'invite_panel');
  assert.equal(normalizeShareExperimentVariant('referral'), null);
  assert.equal(normalizeShareExperimentVariant(undefined), null);
});

test('link lifespan is the recurring tier differentiator', () => {
  // A subscription is the only tier whose delivered work outlives a month.
  assert.equal(resolveShareTtlDays('subscription'), SUBSCRIPTION_SHARE_TTL_DAYS);
  assert.equal(resolveShareTtlDays('subscription'), 365);

  // A one-time Project Pass keeps its long-standing 30-day window unchanged,
  // so no existing paid buyer loses retention from the subscription change.
  assert.equal(resolveShareTtlDays('one_time_access'), PAID_SHARE_TTL_DAYS);
  assert.equal(resolveShareTtlDays('one_time_access'), 30);

  assert.equal(resolveShareTtlDays('none'), FREE_SHARE_TTL_DAYS);
  assert.equal(resolveShareTtlDays('none'), 7);

  // The subscription must strictly outlast the Pass for persistence to be a
  // real, defensible reason to pay recurringly rather than buy a Pass.
  assert.ok(resolveShareTtlDays('subscription') > resolveShareTtlDays('one_time_access'));
  assert.ok(resolveShareTtlDays('one_time_access') >= resolveShareTtlDays('none'));
});
