import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeShareExperimentVariant } from './shareStorage.js';

test('share experiment variants are restricted to the registered cohorts', () => {
  assert.equal(normalizeShareExperimentVariant('control'), 'control');
  assert.equal(normalizeShareExperimentVariant('invite_panel'), 'invite_panel');
  assert.equal(normalizeShareExperimentVariant('referral'), null);
  assert.equal(normalizeShareExperimentVariant(undefined), null);
});
