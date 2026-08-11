const test = require('node:test');
const assert = require('node:assert/strict');
const { getPayloadPreflight, formatPayloadSize, BACKEND_MAX_UPLOAD_BYTES } = require('../dist/exportPreflight.js');

test('payload preflight accepts a comfortably sized upload', () => {
  const result = getPayloadPreflight(1024 * 1024);
  assert.equal(result.status, 'ready');
  assert.equal(result.remainingBytes, BACKEND_MAX_UPLOAD_BYTES - 1024 * 1024);
});

test('payload preflight warns near the platform limit', () => {
  assert.equal(getPayloadPreflight(3_600_000).status, 'near_limit');
});

test('payload preflight rejects an oversized upload before network work', () => {
  const result = getPayloadPreflight(4_000_001);
  assert.equal(result.status, 'too_large');
  assert.equal(result.remainingBytes, -1);
});

test('payload sizes use concise actionable units', () => {
  assert.equal(formatPayloadSize(1024), '1 KB');
  assert.equal(formatPayloadSize(2 * 1024 * 1024), '2.0 MB');
});
