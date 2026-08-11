import assert from 'node:assert/strict';
import test from 'node:test';
import { trackingRequestSchema } from './validation.js';

const redesignTrackingEvents = [
  'flow_detection_started',
  'flow_detected',
  'flow_detection_failed',
  'export_settings_viewed',
  'upgrade_viewed',
  'checkout_cancelled',
  'purchase_restore_started',
  'purchase_restored',
  'purchase_restore_failed',
  'share_link_requested',
  'share_link_created',
  'share_link_copied',
  'share_link_failed',
  'review_invite_link_copied',
  'review_invite_experiment_exposed',
  'review_invite_panel_shown',
  'review_invite_native_share_clicked',
  'review_invite_native_share_completed',
  'review_invite_native_share_failed',
  'review_invite_email_clicked',
  'share_page_viewed',
  'review_feedback_positive',
  'review_feedback_not_yet',
  'path_selection_prompted',
  'prototype_path_auto_selected',
  'review_room_opened',
  'review_comment_created',
  'review_status_updated',
  'export_ready',
  'payload_preflight_started',
  'payload_preflight_failed',
  'upload_started',
  'upload_completed',
  'upsell_viewed',
  'selected_paid_feature',
  'share_clicked',
  'download_started',
  'export_another_clicked',
  'client_review_link_clicked',
  'copy_export_details_clicked',
  'payment_completed',
] as const;

test('tracking schema accepts redesign analytics events', () => {
  for (const eventType of redesignTrackingEvents) {
    const result = trackingRequestSchema.parse({
      eventType,
      pluginVersion: '1.3.4',
      metadata: { source: 'plugin_ui' },
    });

    assert.equal(result.eventType, eventType);
  }
});

test('tracking schema still rejects arbitrary event names', () => {
  assert.throws(() => trackingRequestSchema.parse({
    eventType: 'arbitrary_unapproved_event',
    pluginVersion: '1.3.4',
  }));
});
