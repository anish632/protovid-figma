import test from 'node:test';
import assert from 'node:assert/strict';
import { referralMetadata } from './referralAttribution';

test('referral retains origin without assigning a visitor to the share creator', () => {
  const share = { id: 'share-test', experimentVariant: 'invite_panel', email: 'creator@example.com', anonymousId: 'creator-id' };
  const metadata = referralMetadata('review_room', share);
  assert.equal(metadata.share_id, share.id);
  assert.equal(metadata.experiment_variant, 'invite_panel');
  assert.equal('anonymousId' in metadata, false);
  assert.equal('email' in metadata, false);
});

test('direct acquisition click requires no share or visitor identity', () => {
  assert.deepEqual(referralMetadata('guide_client_delivery', null), {
    source: 'guide_client_delivery', action: 'figma_install_clicked', attribution_version: 'anonymous_outbound_v2',
  });
});
