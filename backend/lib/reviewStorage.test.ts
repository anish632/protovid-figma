import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeCommentInput, normalizeReviewStatus } from './reviewStorage.js';

test('review status only accepts supported workflow states', () => {
  assert.equal(normalizeReviewStatus('approved'), 'approved');
  assert.equal(normalizeReviewStatus('changes_requested'), 'changes_requested');
  assert.equal(normalizeReviewStatus('rejected'), null);
});

test('review comments are trimmed, bounded, and timestamped', () => {
  assert.deepEqual(normalizeCommentInput({
    reviewerName: '  Alex  ',
    body: '  Please increase the button contrast.  ',
    timestampSeconds: 12.34,
  }), {
    reviewerName: 'Alex',
    body: 'Please increase the button contrast.',
    timestampSeconds: 12.3,
  });
});

test('review comments reject empty or unsafe timestamps', () => {
  assert.equal(normalizeCommentInput({ reviewerName: 'Alex', body: 'Looks good', timestampSeconds: -1 }), null);
  assert.equal(normalizeCommentInput({ reviewerName: 'Alex', body: '', timestampSeconds: 1 }), null);
});
