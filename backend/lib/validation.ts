/**
 * Input validation utilities for ProtoVid API
 */

import { z } from 'zod';

// Email validation schema
export const emailSchema = z.string().trim()
  .min(1, 'Email is required')
  .email('Invalid email format')
  .max(254, 'Email too long') // RFC 5321 limit
  .transform(email => email.toLowerCase().trim());

// Legacy field validation.
// The request field is still named "licenseKey" for compatibility, but the
// production value is the user's email address.
export const licenseKeySchema = z.string()
  .min(1, 'Email is required')
  .max(255, 'Email is too long')
  .regex(/^[a-zA-Z0-9@._-]+$/, 'Invalid email format');

// API key validation
export const apiKeySchema = z.string()
  .min(32, 'API key must be at least 32 characters')
  .max(128, 'API key too long')
  .regex(/^[a-zA-Z0-9]+$/, 'API key must contain only alphanumeric characters');

// Event type validation
export const eventTypeSchema = z.enum([
  'plugin_load',
  'plugin_opened',
  'session_opened',
  'first_open',
  'onboarding_started',
  'onboarding_completed',
  'first_action_completed',
  'first_value_reached',
  'demo_state_shown',
  'setup_example_selected',
  'setup_example_created',
  'setup_guide_opened',
  'email_captured',
  'export_setup_viewed',
  'export_settings_changed',
  'export_settings_viewed',
  'format_interest',
  'download_clicked',
  'download_started',
  'share_clicked',
  'export_another_clicked',
  'client_review_link_clicked',
  'copy_export_details_clicked',
  'resolution_selected',
  'checkout_email_prompt_shown',
  'checkout_email_submitted',
  'checkout_email_validation_failed',
  'checkout_email_abandoned',
  'post_success_email_prompt_shown',
  'post_success_email_save_clicked',
  'post_success_email_dismissed',
  'payment_poll_started',
  'payment_poll_timeout',
  'payment_status_checked',
  'export',
  'export_clicked',
  'export_started',
  'export_ready',
  'export_completed',
  'export_succeeded',
  'export_success',
  'export_blocked',
  'export_failed',
  'export_safe_retry_started',
  'export_safe_retry_succeeded',
  'export_safe_retry_failed',
  'payload_preflight_started',
  'payload_preflight_completed',
  'payload_preflight_failed',
  'upload_started',
  'upload_completed',
  'transcode_started',
  'transcode_completed',
  'flow_detection_started',
  'flow_detected',
  'flow_detection_failed',
  'flow_detection_stuck',
  'prototype_detected',
  'prototype_frames_detected',
  'prototype_path_selected',
  'prototype_path_auto_selected',
  'upsell_card_viewed',
  'upsell_viewed',
  'selected_paid_feature',
  'upgrade_viewed',
  'paywall_viewed',
  'pricing_variant_assigned',
  'review_prompt_shown',
  'review_prompt_clicked',
  'review_feedback_positive',
  'review_feedback_not_yet',
  'path_selection_prompted',
  'social_share_clicked',
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
  'review_room_opened',
  'review_comment_created',
  'review_status_updated',
  'viral_growth_action',
  'checkout_start',
  'checkout_started',
  'checkout_created',
  'checkout_opened',
  'checkout_completed',
  'checkout_cancelled',
  'checkout_error',
  'checkout_recovered',
  'checkout_blocked_active_entitlement',
  'upgrade_clicked',
  'export_success_upsell_opportunity',
  'power_user_detected',
  'moderate_user_detected',
  'power_user_post_export',
  'moderate_user_post_export',
  'subscription_cancelled',
  'subscription_cancellation_scheduled',
  'subscription_started',
  'billing_management_token_issued',
  'billing_management_link_requested',
  'purchase_restore_started',
  'purchase_restored',
  'purchase_restore_failed',
  'trial_started',
  'trial_converted',
  'trial_ending_soon',
  'license_validate',
  'license_validation',
  'payment_confirmed',
  'payment_completed'
]);

// Plugin version validation
export const pluginVersionSchema = z.string()
  .regex(/^\d+\.\d+\.\d+$/, 'Invalid version format')
  .max(20, 'Version string too long');

// File size validation (10MB limit)
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function validateFileSize(size: number): boolean {
  return size > 0 && size <= MAX_FILE_SIZE;
}

// Content type validation for video uploads
export const ALLOWED_CONTENT_TYPES = [
  'video/avi',
  'video/x-msvideo',
  'application/octet-stream' // Some browsers send this for AVI
];

export function validateContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  return ALLOWED_CONTENT_TYPES.includes(contentType.toLowerCase());
}

// Sanitize error messages for client responses
export function sanitizeError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues.map(e => e.message).join(', ');
  }
  
  if (error instanceof Error) {
    // Don't expose internal error details in production
    if (process.env.NODE_ENV === 'production') {
      return 'An error occurred while processing your request';
    }
    return error.message;
  }
  
  return 'An unexpected error occurred';
}

// Validate and sanitize metadata objects
export const metadataSchema = z.record(
  z.string(),
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null()
  ])
).optional();

// Request validation schemas
export const trackingRequestSchema = z.object({
  email: z.union([emailSchema, z.null()]).optional(),
  eventType: eventTypeSchema,
  pluginVersion: pluginVersionSchema.optional(),
  metadata: metadataSchema
});

export const licenseValidationRequestSchema = z.object({
  licenseKey: licenseKeySchema
});

export const checkoutRequestSchema = z.object({
  email: emailSchema,
  plan: z.enum(['monthly', 'yearly', 'large_export']).optional(),
  anonymousId: z.string().min(1).max(128).optional(),
  offerExperimentId: z.string().min(1).max(64).optional(),
  offerExperimentVariant: z.enum(['pro_first', 'project_pass_first']).optional(),
  primaryOffer: z.enum(['monthly', 'large_export']).optional(),
  pricingPageExperimentId: z.string().min(1).max(64).optional(),
  pricingPageExperimentVariant: z.enum(['control', 'good_better_best', 'studio_self_serve']).optional(),
});

export const pricingVariantRequestSchema = z.object({
  email: emailSchema.optional(),
  plan: z.enum(['monthly', 'yearly', 'large_export']).optional(),
  anonymousId: z.string().min(1).max(128).optional(),
});

export const checkoutSessionConfirmationSchema = z.object({
  sessionId: z.string()
    .min(1, 'Checkout session is required')
    .max(255, 'Checkout session is too long')
    .regex(/^cs_(test|live)_[A-Za-z0-9_]+$/, 'Invalid checkout session')
});

// Account-management actions intentionally do not accept an email address.
// A bearer token can only be minted after Stripe confirms a completed payment.
export const billingManagementRequestSchema = z.object({
  managementToken: z.string()
    .trim()
    .min(32, 'Billing management token is required')
    .max(4096, 'Billing management token is too long'),
});

export const exportUserIdSchema = z.string()
  .min(3, 'User id is required')
  .max(254, 'User id is too long')
  .regex(/^[a-zA-Z0-9@._:-]+$/, 'Invalid user id format')
  .transform(userId => userId.toLowerCase().trim());

export const exportCheckRequestSchema = z.object({
  email: emailSchema.optional(),
  userId: exportUserIdSchema.optional()
}).refine(data => data.email || data.userId, {
  message: 'Email or user id is required',
});

// Rate limiting configuration
export const RATE_LIMITS = {
  // Per IP address limits
  general: { windowMs: 15 * 60 * 1000, max: 100 }, // 100 requests per 15 minutes
  auth: { windowMs: 15 * 60 * 1000, max: 10 }, // 10 auth attempts per 15 minutes
  upload: { windowMs: 60 * 60 * 1000, max: 5 }, // 5 uploads per hour
  stats: { windowMs: 5 * 60 * 1000, max: 20 }, // 20 stats requests per 5 minutes
} as const;
