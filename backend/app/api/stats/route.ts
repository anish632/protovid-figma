import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { FREE_TIER_EXPORT_LIMIT } from '@/lib/plans';

// Lazy initialize DB connection
function getDB() {
  if (!process.env.NEON_DATABASE_URL) {
    throw new Error('Database not configured');
  }
  return neon(process.env.NEON_DATABASE_URL);
}

// API key protection - must be set in production
const STATS_API_KEY = process.env.STATS_API_KEY;

export async function GET(request: NextRequest) {
  try {
    const sql = getDB();
    // Check API key
    const apiKey = request.headers.get('x-api-key') || request.nextUrl.searchParams.get('key');
    if (apiKey !== STATS_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get time ranges
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Total events
    const [totalEvents] = await sql`
      SELECT COUNT(*) as count FROM protovid_events
    `;

    // The plugin records a stable anonymous ID before it has an email. When
    // that email is later captured, use the most recent known pairing so a
    // plugin event and its Stripe/web event remain one funnel actor.
    //
    // Do not use email as the preferred actor key here: doing so splits one
    // person into an anonymous pre-checkout actor and an email post-checkout
    // actor.
    const eventsByType = await sql`
      WITH latest_anonymous_identity AS (
        SELECT DISTINCT ON (LOWER(email))
          LOWER(email) AS normalized_email,
          NULLIF(metadata::jsonb->>'anonymousId', '') AS anonymous_id
        FROM protovid_events
        WHERE email IS NOT NULL
          AND NULLIF(metadata::jsonb->>'anonymousId', '') IS NOT NULL
        ORDER BY LOWER(email), created_at DESC
      ),
      recent AS (
        SELECT
          event_type,
          email,
          COALESCE(
            NULLIF(metadata::jsonb->>'anonymousId', ''),
            identity.anonymous_id,
            NULLIF(LOWER(email), '')
          ) AS actor_id
        FROM protovid_events event
        LEFT JOIN latest_anonymous_identity identity
          ON LOWER(event.email) = identity.normalized_email
        WHERE event.created_at >= ${last30d}
      )
      SELECT
        event_type,
        COUNT(*) as count,
        COUNT(DISTINCT actor_id) as users,
        COUNT(*) FILTER (WHERE email IS NULL) as anonymous_count
      FROM recent
      GROUP BY event_type
      ORDER BY count DESC
    `;

    // Daily events (last 7 days)
    const dailyEvents = await sql`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM protovid_events
      WHERE created_at >= ${last7d}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;

    // Active users (canonical anonymous-first actors, last 30 days)
    const [activeUsers] = await sql`
      WITH latest_anonymous_identity AS (
        SELECT DISTINCT ON (LOWER(email))
          LOWER(email) AS normalized_email,
          NULLIF(metadata::jsonb->>'anonymousId', '') AS anonymous_id
        FROM protovid_events
        WHERE email IS NOT NULL
          AND NULLIF(metadata::jsonb->>'anonymousId', '') IS NOT NULL
        ORDER BY LOWER(email), created_at DESC
      ),
      recent AS (
        SELECT COALESCE(
          NULLIF(event.metadata::jsonb->>'anonymousId', ''),
          identity.anonymous_id,
          NULLIF(LOWER(event.email), '')
        ) AS actor_id
        FROM protovid_events event
        LEFT JOIN latest_anonymous_identity identity
          ON LOWER(event.email) = identity.normalized_email
        WHERE event.created_at >= ${last30d}
      )
      SELECT COUNT(DISTINCT actor_id) as count
      FROM recent
      WHERE actor_id IS NOT NULL
    `;

    // Total subscriptions
    const [totalSubs] = await sql`
      SELECT COUNT(*) as count FROM protovid_subscriptions
    `;

    // Separate paid access from trial access.
    const [activeProSubs] = await sql`
      SELECT COUNT(*) as count 
      FROM protovid_subscriptions
      WHERE tier = 'pro' AND status = 'active'
    `;

    const [trialingSubs] = await sql`
      SELECT COUNT(*) as count
      FROM protovid_subscriptions
      WHERE tier = 'pro' AND status = 'trialing'
    `;

    // Funnel summary (last 30 days). `paywall_viewed` is intentionally split:
    // a non-blocking upsell card is not evidence that someone exhausted their
    // free quota. Older unclassified events remain visible separately rather
    // than being silently relabeled as quota pressure.
    const [funnelSummary] = await sql`
      WITH latest_anonymous_identity AS (
        SELECT DISTINCT ON (LOWER(email))
          LOWER(email) AS normalized_email,
          NULLIF(metadata::jsonb->>'anonymousId', '') AS anonymous_id
        FROM protovid_events
        WHERE email IS NOT NULL
          AND NULLIF(metadata::jsonb->>'anonymousId', '') IS NOT NULL
        ORDER BY LOWER(email), created_at DESC
      ),
      recent AS (
        SELECT
          event.event_type,
          event.metadata::jsonb AS metadata,
          COALESCE(
            NULLIF(event.metadata::jsonb->>'anonymousId', ''),
            identity.anonymous_id,
            NULLIF(LOWER(event.email), '')
          ) AS actor_id,
          CASE
            WHEN event.event_type IN ('upsell_card_viewed', 'upsell_viewed') THEN 'upsell'
            WHEN event.event_type = 'paywall_viewed'
              AND (
                COALESCE(event.metadata::jsonb->>'reason', '') IN ('free_limit_hit', 'free_limit', 'trial_expired')
                OR COALESCE(event.metadata::jsonb->>'trigger', '') IN ('free_limit_ui_shown', 'free_limit_reached', 'trial_expired')
              ) THEN 'quota'
            WHEN event.event_type = 'paywall_viewed'
              AND (
                COALESCE(event.metadata::jsonb->>'reason', '') IN ('upsell', 'upsell_card')
                OR COALESCE(event.metadata::jsonb->>'source', '') IN ('upsell_card', 'post_export_upsell')
                OR COALESCE(event.metadata::jsonb->>'trigger', '') IN ('upsell_card_shown', 'post_export_upsell')
              ) THEN 'upsell'
            WHEN event.event_type = 'paywall_viewed' THEN 'legacy_ambiguous'
            ELSE NULL
          END AS monetization_surface
        FROM protovid_events event
        LEFT JOIN latest_anonymous_identity identity
          ON LOWER(event.email) = identity.normalized_email
        WHERE event.created_at >= ${last30d}
      )
      SELECT
        COUNT(*) FILTER (WHERE event_type = 'first_open') as first_open_events,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'session_opened') as session_opened_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'plugin_opened') as plugin_opened_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'first_open') as first_open_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'onboarding_started') as onboarding_started_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'onboarding_completed') as onboarding_completed_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'email_captured') as email_captured_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'first_action_completed') as first_action_completed_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'demo_state_shown') as demo_state_shown_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'prototype_detected') as prototype_detected_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'prototype_path_selected') as prototype_path_selected_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'prototype_path_auto_selected') as prototype_path_auto_selected_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'export_setup_viewed') as export_setup_viewed_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'export_settings_changed') as export_settings_changed_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'format_interest') as format_interest_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'first_value_reached') as first_value_reached_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'export_started') as export_started_users,
        COUNT(DISTINCT metadata->>'export_id') FILTER (WHERE event_type = 'export_started' AND NULLIF(metadata->>'export_id', '') IS NOT NULL) as export_started_attempts,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type IN ('export_started', 'export')) as export_attempt_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'export_completed') as export_completed_users,
        COUNT(DISTINCT metadata->>'export_id') FILTER (WHERE event_type = 'export_completed' AND NULLIF(metadata->>'export_id', '') IS NOT NULL) as export_completed_attempts,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type IN ('export_completed', 'export_success', 'export_succeeded')) as export_success_users,
        COUNT(DISTINCT metadata->>'export_id') FILTER (WHERE event_type = 'export_failed' AND NULLIF(metadata->>'export_id', '') IS NOT NULL) as export_failed_attempts,
        COUNT(DISTINCT metadata->>'export_id') FILTER (WHERE event_type = 'transcode_completed' AND NULLIF(metadata->>'export_id', '') IS NOT NULL) as transcode_completed_attempts,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'download_clicked') as download_clicked_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'review_prompt_shown') as review_prompt_shown_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'review_prompt_clicked') as review_prompt_clicked_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'review_feedback_positive') as review_feedback_positive_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'review_feedback_not_yet') as review_feedback_not_yet_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'share_link_requested') as share_link_requested_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'share_link_created') as share_link_created_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'share_link_copied') as share_link_copied_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'share_link_failed') as share_link_failed_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'share_page_viewed') as share_page_viewed_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'review_room_opened') as review_room_opened_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'review_comment_created') as review_comment_created_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'review_status_updated') as review_status_updated_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'review_invite_experiment_exposed' AND metadata->>'variant' = 'control') as invite_exposed_control_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'review_invite_experiment_exposed' AND metadata->>'variant' = 'invite_panel') as invite_exposed_treatment_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'review_invite_panel_shown') as invite_panel_shown_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'review_invite_link_copied') as invite_link_copied_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'review_invite_email_clicked') as invite_email_clicked_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'review_invite_native_share_completed') as invite_native_share_completed_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'review_room_opened' AND metadata->>'experiment_variant' = 'control') as invite_room_opened_control_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'review_room_opened' AND metadata->>'experiment_variant' = 'invite_panel') as invite_room_opened_treatment_users,
        COUNT(*) FILTER (WHERE event_type = 'review_room_opened' AND metadata->>'experiment_variant' = 'control') as invite_room_open_events_control,
        COUNT(*) FILTER (WHERE event_type = 'review_room_opened' AND metadata->>'experiment_variant' = 'invite_panel') as invite_room_open_events_treatment,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type IN ('review_comment_created', 'review_status_updated') AND metadata->>'experiment_variant' = 'control') as invite_review_action_control_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type IN ('review_comment_created', 'review_status_updated') AND metadata->>'experiment_variant' = 'invite_panel') as invite_review_action_treatment_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'viral_growth_action') as viral_growth_action_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type IN ('upsell_card_viewed', 'upsell_viewed')) as upsell_viewed_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'upsell_card_viewed') as upsell_card_viewed_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE monetization_surface = 'quota') as quota_paywall_viewed_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE monetization_surface = 'legacy_ambiguous') as legacy_ambiguous_paywall_viewed_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'paywall_viewed') as raw_paywall_viewed_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'upgrade_clicked') as upgrade_clicked_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'checkout_email_prompt_shown') as checkout_email_prompt_shown_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'pricing_variant_assigned') as pricing_variant_assigned_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'checkout_start') as checkout_start_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'checkout_created') as checkout_created_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'checkout_opened') as checkout_opened_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'checkout_blocked_active_entitlement') as checkout_blocked_active_entitlement_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'checkout_completed') as checkout_completed_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'payment_poll_started') as payment_poll_started_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'payment_poll_timeout') as payment_poll_timeout_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'payment_status_checked') as payment_status_checked_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'payment_confirmed') as payment_confirmed_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'large_flow_pass_purchased') as large_flow_pass_purchased_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'billing_management_link_requested') as billing_management_link_requested_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'billing_management_token_issued') as billing_management_token_issued_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'subscription_cancellation_scheduled') as subscription_cancellation_scheduled_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'trial_started') as trial_started_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'trial_converted') as trial_converted_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'trial_ending_soon') as trial_ending_soon_users
      FROM recent
    `;

    // Pricing experiment summary (last 30 days). The same actor and
    // monetization-surface rules keep variant comparisons from treating an
    // upsell impression as a quota-wall conversion opportunity.
    const pricingExperiment = await sql`
      WITH latest_anonymous_identity AS (
        SELECT DISTINCT ON (LOWER(email))
          LOWER(email) AS normalized_email,
          NULLIF(metadata::jsonb->>'anonymousId', '') AS anonymous_id
        FROM protovid_events
        WHERE email IS NOT NULL
          AND NULLIF(metadata::jsonb->>'anonymousId', '') IS NOT NULL
        ORDER BY LOWER(email), created_at DESC
      ),
      recent AS (
        SELECT
          event.event_type,
          event.metadata::jsonb AS metadata,
          COALESCE(
            NULLIF(event.metadata::jsonb->>'anonymousId', ''),
            identity.anonymous_id,
            NULLIF(LOWER(event.email), '')
          ) AS actor_id,
          COALESCE(event.metadata::jsonb->>'pricingVariant', event.metadata::jsonb->>'pricing_variant', 'unknown') AS pricing_variant,
          CASE
            WHEN event.event_type IN ('upsell_card_viewed', 'upsell_viewed') THEN 'upsell'
            WHEN event.event_type = 'paywall_viewed'
              AND (
                COALESCE(event.metadata::jsonb->>'reason', '') IN ('free_limit_hit', 'free_limit', 'trial_expired')
                OR COALESCE(event.metadata::jsonb->>'trigger', '') IN ('free_limit_ui_shown', 'free_limit_reached', 'trial_expired')
              ) THEN 'quota'
            WHEN event.event_type = 'paywall_viewed'
              AND (
                COALESCE(event.metadata::jsonb->>'reason', '') IN ('upsell', 'upsell_card')
                OR COALESCE(event.metadata::jsonb->>'source', '') IN ('upsell_card', 'post_export_upsell')
                OR COALESCE(event.metadata::jsonb->>'trigger', '') IN ('upsell_card_shown', 'post_export_upsell')
              ) THEN 'upsell'
            WHEN event.event_type = 'paywall_viewed' THEN 'legacy_ambiguous'
            ELSE NULL
          END AS monetization_surface
        FROM protovid_events event
        LEFT JOIN latest_anonymous_identity identity
          ON LOWER(event.email) = identity.normalized_email
        WHERE event.created_at >= ${last30d}
          AND event.event_type IN (
            'pricing_variant_assigned',
            'upsell_card_viewed',
            'upsell_viewed',
            'paywall_viewed',
            'upgrade_clicked',
            'checkout_start',
            'checkout_created',
            'checkout_opened',
            'checkout_completed',
            'payment_confirmed'
          )
      )
      SELECT
        pricing_variant,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'pricing_variant_assigned') as assigned_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type IN ('upsell_card_viewed', 'upsell_viewed')) as upsell_viewed_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'upsell_card_viewed') as upsell_card_viewed_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE monetization_surface = 'quota') as quota_paywall_viewed_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE monetization_surface = 'legacy_ambiguous') as legacy_ambiguous_paywall_viewed_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'paywall_viewed') as raw_paywall_viewed_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'upgrade_clicked') as upgrade_clicked_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'checkout_created') as checkout_created_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'checkout_opened') as checkout_opened_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'checkout_completed') as checkout_completed_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'payment_confirmed') as payment_confirmed_users,
        COALESCE(MAX((metadata->>'amountCents')::integer), MAX((metadata->>'amount_cents')::integer), 0) as amount_cents,
        COALESCE(MAX(metadata->>'priceLabel'), MAX(metadata->>'price_label'), '') as price_label
      FROM recent
      GROUP BY pricing_variant
      ORDER BY pricing_variant ASC
    `;

    // Six-week paid-offer experiment. Assignment is stable by anonymous ID,
    // while conversion remains attributable after an email and Stripe session
    // are introduced during checkout.
    const offerExperiment = await sql`
      WITH recent AS (
        SELECT
          event_type,
          metadata::jsonb AS metadata,
          COALESCE(
            NULLIF(metadata::jsonb->>'anonymousId', ''),
            NULLIF(LOWER(email), '')
          ) AS actor_id,
          COALESCE(metadata::jsonb->>'offer_experiment_variant', 'unknown') AS variant,
          COALESCE(metadata::jsonb->>'primary_offer', 'unknown') AS primary_offer
        FROM protovid_events
        WHERE created_at >= ${last30d}
          AND metadata::jsonb->>'offer_experiment_id' = 'project_pass_primary_v1'
      )
      SELECT
        variant,
        primary_offer,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'pricing_variant_assigned') AS assigned_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'upsell_card_viewed') AS exposed_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'upgrade_clicked') AS upgrade_clicked_users,
        COUNT(DISTINCT COALESCE(NULLIF(metadata->>'stripe_checkout_session_id', ''), actor_id))
          FILTER (WHERE event_type = 'checkout_created') AS checkout_created,
        COUNT(DISTINCT COALESCE(NULLIF(metadata->>'stripe_session_id', ''), actor_id))
          FILTER (WHERE event_type = 'payment_confirmed') AS payments_confirmed,
        COUNT(DISTINCT COALESCE(NULLIF(metadata->>'stripe_session_id', ''), actor_id))
          FILTER (WHERE event_type = 'large_flow_pass_purchased') AS project_pass_purchases
      FROM recent
      GROUP BY variant, primary_offer
      ORDER BY variant ASC
    `;

    // Free-tier pressure from persistent subscription rows
    const currentMonth = new Date().toISOString().slice(0, 7);
    const [freeTierPressure] = await sql`
      SELECT
        COUNT(*) FILTER (
          WHERE tier = 'free' AND last_reset_month = ${currentMonth}
        ) as tracked_free_users_this_month,
        COALESCE(SUM(exports_this_month) FILTER (
          WHERE tier = 'free' AND last_reset_month = ${currentMonth}
        ), 0) as tracked_free_exports_this_month,
        COUNT(*) FILTER (
          WHERE tier = 'free'
            AND last_reset_month = ${currentMonth}
            AND exports_this_month >= ${FREE_TIER_EXPORT_LIMIT}
        ) as free_users_at_limit
      FROM protovid_subscriptions
    `;

    // Recent events
    const recentEvents = await sql`
      SELECT 
        email,
        NULLIF(metadata::jsonb->>'anonymousId', '') as anonymous_id,
        event_type,
        plugin_version,
        metadata,
        created_at
      FROM protovid_events
      ORDER BY created_at DESC
      LIMIT 20
    `;

    return NextResponse.json({
      totalEvents: parseInt(totalEvents.count),
      eventsByType: eventsByType.map((e: any) => ({
        type: e.event_type,
        count: parseInt(e.count),
        users: parseInt(e.users),
        anonymousCount: parseInt(e.anonymous_count),
      })),
      dailyEvents: dailyEvents.map((e: any) => ({
        date: e.date,
        count: parseInt(e.count),
      })),
      activeUsers30d: parseInt(activeUsers.count),
      totalSubscriptions: parseInt(totalSubs.count),
      proSubscriptions: parseInt(activeProSubs.count),
      trialingSubscriptions: parseInt(trialingSubs.count),
      funnel30d: {
        firstOpenEvents: parseInt(funnelSummary.first_open_events || '0'),
        sessionOpenedUsers: parseInt(funnelSummary.session_opened_users || '0'),
        pluginOpenedUsers: parseInt(funnelSummary.plugin_opened_users || '0'),
        firstOpenUsers: parseInt(funnelSummary.first_open_users || '0'),
        onboardingStartedUsers: parseInt(funnelSummary.onboarding_started_users || '0'),
        onboardingCompletedUsers: parseInt(funnelSummary.onboarding_completed_users || '0'),
        emailCapturedUsers: parseInt(funnelSummary.email_captured_users || '0'),
        firstActionCompletedUsers: parseInt(funnelSummary.first_action_completed_users || '0'),
        demoStateShownUsers: parseInt(funnelSummary.demo_state_shown_users || '0'),
        prototypeDetectedUsers: parseInt(funnelSummary.prototype_detected_users || '0'),
        prototypePathSelectedUsers: parseInt(funnelSummary.prototype_path_selected_users || '0'),
        prototypePathAutoSelectedUsers: parseInt(funnelSummary.prototype_path_auto_selected_users || '0'),
        exportSetupViewedUsers: parseInt(funnelSummary.export_setup_viewed_users || '0'),
        exportSettingsChangedUsers: parseInt(funnelSummary.export_settings_changed_users || '0'),
        formatInterestUsers: parseInt(funnelSummary.format_interest_users || '0'),
        firstValueReachedUsers: parseInt(funnelSummary.first_value_reached_users || '0'),
        exportStartedUsers: parseInt(funnelSummary.export_started_users || '0'),
        exportStartedAttempts: parseInt(funnelSummary.export_started_attempts || '0'),
        exportAttemptUsers: parseInt(funnelSummary.export_attempt_users || '0'),
        exportCompletedUsers: parseInt(funnelSummary.export_completed_users || '0'),
        exportCompletedAttempts: parseInt(funnelSummary.export_completed_attempts || '0'),
        exportSuccessUsers: parseInt(funnelSummary.export_success_users || '0'),
        exportFailedAttempts: parseInt(funnelSummary.export_failed_attempts || '0'),
        transcodeCompletedAttempts: parseInt(funnelSummary.transcode_completed_attempts || '0'),
        downloadClickedUsers: parseInt(funnelSummary.download_clicked_users || '0'),
        reviewPromptShownUsers: parseInt(funnelSummary.review_prompt_shown_users || '0'),
        reviewPromptClickedUsers: parseInt(funnelSummary.review_prompt_clicked_users || '0'),
        reviewFeedbackPositiveUsers: parseInt(funnelSummary.review_feedback_positive_users || '0'),
        reviewFeedbackNotYetUsers: parseInt(funnelSummary.review_feedback_not_yet_users || '0'),
        shareLinkRequestedUsers: parseInt(funnelSummary.share_link_requested_users || '0'),
        shareLinkCreatedUsers: parseInt(funnelSummary.share_link_created_users || '0'),
        shareLinkCopiedUsers: parseInt(funnelSummary.share_link_copied_users || '0'),
        shareLinkFailedUsers: parseInt(funnelSummary.share_link_failed_users || '0'),
        sharePageViewedUsers: parseInt(funnelSummary.share_page_viewed_users || '0'),
        reviewRoomOpenedUsers: parseInt(funnelSummary.review_room_opened_users || '0'),
        reviewCommentCreatedUsers: parseInt(funnelSummary.review_comment_created_users || '0'),
        reviewStatusUpdatedUsers: parseInt(funnelSummary.review_status_updated_users || '0'),
        viralGrowthActionUsers: parseInt(funnelSummary.viral_growth_action_users || '0'),
        upsellViewedUsers: parseInt(funnelSummary.upsell_viewed_users || '0'),
        upsellCardViewedUsers: parseInt(funnelSummary.upsell_card_viewed_users || '0'),
        quotaPaywallViewedUsers: parseInt(funnelSummary.quota_paywall_viewed_users || '0'),
        legacyAmbiguousPaywallViewedUsers: parseInt(funnelSummary.legacy_ambiguous_paywall_viewed_users || '0'),
        rawPaywallViewedUsers: parseInt(funnelSummary.raw_paywall_viewed_users || '0'),
        // Kept as an alias for consumers of the former field. It now carries
        // the correctly classified quota wall, not all raw paywall events.
        paywallViewedUsers: parseInt(funnelSummary.quota_paywall_viewed_users || '0'),
        upgradeClickedUsers: parseInt(funnelSummary.upgrade_clicked_users || '0'),
        checkoutEmailPromptShownUsers: parseInt(funnelSummary.checkout_email_prompt_shown_users || '0'),
        pricingVariantAssignedUsers: parseInt(funnelSummary.pricing_variant_assigned_users || '0'),
        checkoutStartUsers: parseInt(funnelSummary.checkout_start_users || '0'),
        checkoutCreatedUsers: parseInt(funnelSummary.checkout_created_users || '0'),
        checkoutOpenedUsers: parseInt(funnelSummary.checkout_opened_users || '0'),
        checkoutBlockedActiveEntitlementUsers: parseInt(funnelSummary.checkout_blocked_active_entitlement_users || '0'),
        checkoutCompletedUsers: parseInt(funnelSummary.checkout_completed_users || '0'),
        paymentPollStartedUsers: parseInt(funnelSummary.payment_poll_started_users || '0'),
        paymentPollTimeoutUsers: parseInt(funnelSummary.payment_poll_timeout_users || '0'),
        paymentStatusCheckedUsers: parseInt(funnelSummary.payment_status_checked_users || '0'),
        paymentConfirmedUsers: parseInt(funnelSummary.payment_confirmed_users || '0'),
        largeFlowPassPurchasedUsers: parseInt(funnelSummary.large_flow_pass_purchased_users || '0'),
        billingManagementLinkRequestedUsers: parseInt(funnelSummary.billing_management_link_requested_users || '0'),
        billingManagementTokenIssuedUsers: parseInt(funnelSummary.billing_management_token_issued_users || '0'),
        subscriptionCancellationScheduledUsers: parseInt(funnelSummary.subscription_cancellation_scheduled_users || '0'),
        trialStartedUsers: parseInt(funnelSummary.trial_started_users || '0'),
        trialConvertedUsers: parseInt(funnelSummary.trial_converted_users || '0'),
        trialEndingSoonUsers: parseInt(funnelSummary.trial_ending_soon_users || '0'),
      },
      shareInviteExperiment30d: {
        exposedControlUsers: parseInt(funnelSummary.invite_exposed_control_users || '0'),
        exposedTreatmentUsers: parseInt(funnelSummary.invite_exposed_treatment_users || '0'),
        panelShownUsers: parseInt(funnelSummary.invite_panel_shown_users || '0'),
        linkCopiedUsers: parseInt(funnelSummary.invite_link_copied_users || '0'),
        emailInviteUsers: parseInt(funnelSummary.invite_email_clicked_users || '0'),
        nativeShareUsers: parseInt(funnelSummary.invite_native_share_completed_users || '0'),
        reviewRoomOpenedControlUsers: parseInt(funnelSummary.invite_room_opened_control_users || '0'),
        reviewRoomOpenedTreatmentUsers: parseInt(funnelSummary.invite_room_opened_treatment_users || '0'),
        reviewRoomOpenEventsControl: parseInt(funnelSummary.invite_room_open_events_control || '0'),
        reviewRoomOpenEventsTreatment: parseInt(funnelSummary.invite_room_open_events_treatment || '0'),
        reviewActionControlUsers: parseInt(funnelSummary.invite_review_action_control_users || '0'),
        reviewActionTreatmentUsers: parseInt(funnelSummary.invite_review_action_treatment_users || '0'),
        successMetric: 'invite_panel review-room-open rate >= control review-room-open rate',
      },
      pricingExperiment30d: pricingExperiment.map((row: any) => ({
        pricingVariant: row.pricing_variant,
        priceLabel: row.price_label,
        amountCents: parseInt(row.amount_cents || '0'),
        assignedUsers: parseInt(row.assigned_users || '0'),
        upsellViewedUsers: parseInt(row.upsell_viewed_users || '0'),
        upsellCardViewedUsers: parseInt(row.upsell_card_viewed_users || '0'),
        quotaPaywallViewedUsers: parseInt(row.quota_paywall_viewed_users || '0'),
        legacyAmbiguousPaywallViewedUsers: parseInt(row.legacy_ambiguous_paywall_viewed_users || '0'),
        rawPaywallViewedUsers: parseInt(row.raw_paywall_viewed_users || '0'),
        paywallViewedUsers: parseInt(row.quota_paywall_viewed_users || '0'),
        upgradeClickedUsers: parseInt(row.upgrade_clicked_users || '0'),
        checkoutCreatedUsers: parseInt(row.checkout_created_users || '0'),
        checkoutOpenedUsers: parseInt(row.checkout_opened_users || '0'),
        checkoutCompletedUsers: parseInt(row.checkout_completed_users || '0'),
        paymentConfirmedUsers: parseInt(row.payment_confirmed_users || '0'),
      })),
      offerExperiment30d: {
        experimentId: 'project_pass_primary_v1',
        successMetric: 'payment-confirmed rate and revenue per exposed user',
        variants: offerExperiment.map((row: any) => ({
          variant: row.variant,
          primaryOffer: row.primary_offer,
          assignedUsers: parseInt(row.assigned_users || '0'),
          exposedUsers: parseInt(row.exposed_users || '0'),
          upgradeClickedUsers: parseInt(row.upgrade_clicked_users || '0'),
          checkoutCreated: parseInt(row.checkout_created || '0'),
          paymentsConfirmed: parseInt(row.payments_confirmed || '0'),
          projectPassPurchases: parseInt(row.project_pass_purchases || '0'),
        })),
      },
      freeTier30d: {
        freeLimit: FREE_TIER_EXPORT_LIMIT,
        trackedFreeUsersThisMonth: parseInt(freeTierPressure.tracked_free_users_this_month || '0'),
        trackedFreeExportsThisMonth: parseInt(freeTierPressure.tracked_free_exports_this_month || '0'),
        freeUsersAtLimit: parseInt(freeTierPressure.free_users_at_limit || '0'),
      },
      recentEvents: recentEvents.map((e: any) => ({
        email: e.email,
        anonymousId: e.anonymous_id,
        eventType: e.event_type,
        pluginVersion: e.plugin_version,
        metadata: e.metadata,
        timestamp: e.created_at,
      })),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
