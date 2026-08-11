const test = require('node:test');
const assert = require('node:assert/strict');
const { buildExportEventId, withExportContext } = require('../dist/exportAnalytics.js');

test('export analytics uses one stable event identity for retries', () => {
  assert.equal(buildExportEventId('exp_123', 'export_started'), 'exp_123:export_started:once');
  assert.equal(buildExportEventId('exp_123', 'upload_started', 2), 'exp_123:upload_started:2');
  assert.equal(buildExportEventId(null, 'export_started'), null);
});

test('export analytics context preserves safe metadata without document contents', () => {
  assert.deepEqual(withExportContext('exp_123', 'export_completed', {
    resolution: '720p',
    frame_count: 3,
    watermark: true,
  }), {
    export_id: 'exp_123',
    event_id: 'exp_123:export_completed:once',
    resolution: '720p',
    frame_count: 3,
    watermark: true,
  });
});
