import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPrototypeDecisionBrief } from './prototypeIntelligence.js';

test('prototype decision brief summarizes route and delivery quality locally', () => {
  const brief = buildPrototypeDecisionBrief({
    filename: 'checkout-flow.mp4',
    frameCount: 8,
    resolution: '1080p',
    startFrameName: 'Cart',
    endFrameName: 'Success',
    estimatedDurationSeconds: 18.2,
  });

  assert.equal(brief.signals.complexity, 'moderate');
  assert.equal(brief.signals.deliveryQuality, 'client-ready');
  assert.equal(brief.signals.reviewMode, 'stakeholder-review');
  assert.match(brief.summary, /8 connected frames from Cart to Success/);
  assert.match(brief.walkthroughScript, /starts at Cart/);
  assert.ok(brief.reviewFocus.length >= 4);
});

test('prototype decision brief falls back when optional metadata is missing', () => {
  const brief = buildPrototypeDecisionBrief({
    frameCount: 1,
    resolution: '720p',
  });

  assert.equal(brief.signals.complexity, 'simple');
  assert.equal(brief.signals.deliveryQuality, 'proof');
  assert.equal(brief.signals.reviewMode, 'quick-check');
  assert.match(brief.summary, /Prototype walkthrough/);
});
