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

    // Events by type (last 30 days)
    const eventsByType = await sql`
      SELECT 
        event_type,
        COUNT(*) as count,
        COUNT(DISTINCT COALESCE(email, NULLIF(metadata::jsonb->>'anonymousId', ''))) as users,
        COUNT(*) FILTER (WHERE email IS NULL) as anonymous_count
      FROM protovid_events
      WHERE created_at >= ${last30d}
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

    // Active users (unique known emails or anonymous plugin ids, last 30 days)
    const [activeUsers] = await sql`
      SELECT COUNT(DISTINCT COALESCE(email, NULLIF(metadata::jsonb->>'anonymousId', ''))) as count
      FROM protovid_events
      WHERE created_at >= ${last30d}
      AND COALESCE(email, NULLIF(metadata::jsonb->>'anonymousId', '')) IS NOT NULL
    `;

    // Total subscriptions
    const [totalSubs] = await sql`
      SELECT COUNT(*) as count FROM protovid_subscriptions
    `;

    // Pro subscriptions
    const [proSubs] = await sql`
      SELECT COUNT(*) as count 
      FROM protovid_subscriptions
      WHERE tier = 'pro' AND status IN ('active', 'trialing')
    `;

    // Funnel summary (last 30 days)
    const [funnelSummary] = await sql`
      WITH recent AS (
        SELECT
          event_type,
          COALESCE(email, NULLIF(metadata::jsonb->>'anonymousId', '')) as actor_id
        FROM protovid_events
        WHERE created_at >= ${last30d}
      )
      SELECT
        COUNT(*) FILTER (WHERE event_type = 'first_open') as first_open_events,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'first_open') as first_open_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'onboarding_started') as onboarding_started_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'onboarding_completed') as onboarding_completed_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'email_captured') as email_captured_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'first_action_completed') as first_action_completed_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'demo_state_shown') as demo_state_shown_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'prototype_detected') as prototype_detected_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'export_setup_viewed') as export_setup_viewed_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'export_settings_changed') as export_settings_changed_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'format_interest') as format_interest_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'first_value_reached') as first_value_reached_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'export') as export_attempt_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'export_completed') as export_completed_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'download_clicked') as download_clicked_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'review_prompt_shown') as review_prompt_shown_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'review_prompt_clicked') as review_prompt_clicked_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'paywall_viewed') as paywall_viewed_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'checkout_email_prompt_shown') as checkout_email_prompt_shown_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'pricing_variant_assigned') as pricing_variant_assigned_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'checkout_start') as checkout_start_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'checkout_opened') as checkout_opened_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'checkout_completed') as checkout_completed_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'payment_poll_started') as payment_poll_started_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'payment_poll_timeout') as payment_poll_timeout_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'payment_status_checked') as payment_status_checked_users,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_type = 'payment_confirmed') as payment_confirmed_users
      FROM recent
    `;

    // Pricing experiment summary (last 30 days)
    const pricingExperiment = await sql`
      SELECT
        COALESCE(metadata::jsonb->>'pricingVariant', metadata::jsonb->>'pricing_variant', 'unknown') as pricing_variant,
        COUNT(DISTINCT email) FILTER (WHERE event_type = 'pricing_variant_assigned') as assigned_users,
        COUNT(DISTINCT email) FILTER (WHERE event_type = 'paywall_viewed') as paywall_viewed_users,
        COUNT(DISTINCT email) FILTER (WHERE event_type = 'checkout_opened') as checkout_opened_users,
        COUNT(DISTINCT email) FILTER (WHERE event_type = 'checkout_completed') as checkout_completed_users,
        COUNT(DISTINCT email) FILTER (WHERE event_type = 'payment_confirmed') as payment_confirmed_users,
        COALESCE(MAX((metadata::jsonb->>'amountCents')::integer), MAX((metadata::jsonb->>'amount_cents')::integer), 0) as amount_cents,
        COALESCE(MAX(metadata::jsonb->>'priceLabel'), MAX(metadata::jsonb->>'price_label'), '') as price_label
      FROM protovid_events
      WHERE created_at >= ${last30d}
        AND event_type IN ('pricing_variant_assigned', 'paywall_viewed', 'checkout_opened', 'checkout_completed', 'payment_confirmed')
      GROUP BY pricing_variant
      ORDER BY pricing_variant ASC
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
      proSubscriptions: parseInt(proSubs.count),
      funnel30d: {
        firstOpenEvents: parseInt(funnelSummary.first_open_events || '0'),
        firstOpenUsers: parseInt(funnelSummary.first_open_users || '0'),
        onboardingStartedUsers: parseInt(funnelSummary.onboarding_started_users || '0'),
        onboardingCompletedUsers: parseInt(funnelSummary.onboarding_completed_users || '0'),
        emailCapturedUsers: parseInt(funnelSummary.email_captured_users || '0'),
        firstActionCompletedUsers: parseInt(funnelSummary.first_action_completed_users || '0'),
        demoStateShownUsers: parseInt(funnelSummary.demo_state_shown_users || '0'),
        prototypeDetectedUsers: parseInt(funnelSummary.prototype_detected_users || '0'),
        exportSetupViewedUsers: parseInt(funnelSummary.export_setup_viewed_users || '0'),
        exportSettingsChangedUsers: parseInt(funnelSummary.export_settings_changed_users || '0'),
        formatInterestUsers: parseInt(funnelSummary.format_interest_users || '0'),
        firstValueReachedUsers: parseInt(funnelSummary.first_value_reached_users || '0'),
        exportAttemptUsers: parseInt(funnelSummary.export_attempt_users || '0'),
        exportCompletedUsers: parseInt(funnelSummary.export_completed_users || '0'),
        downloadClickedUsers: parseInt(funnelSummary.download_clicked_users || '0'),
        reviewPromptShownUsers: parseInt(funnelSummary.review_prompt_shown_users || '0'),
        reviewPromptClickedUsers: parseInt(funnelSummary.review_prompt_clicked_users || '0'),
        paywallViewedUsers: parseInt(funnelSummary.paywall_viewed_users || '0'),
        checkoutEmailPromptShownUsers: parseInt(funnelSummary.checkout_email_prompt_shown_users || '0'),
        pricingVariantAssignedUsers: parseInt(funnelSummary.pricing_variant_assigned_users || '0'),
        checkoutStartUsers: parseInt(funnelSummary.checkout_start_users || '0'),
        checkoutOpenedUsers: parseInt(funnelSummary.checkout_opened_users || '0'),
        checkoutCompletedUsers: parseInt(funnelSummary.checkout_completed_users || '0'),
        paymentPollStartedUsers: parseInt(funnelSummary.payment_poll_started_users || '0'),
        paymentPollTimeoutUsers: parseInt(funnelSummary.payment_poll_timeout_users || '0'),
        paymentStatusCheckedUsers: parseInt(funnelSummary.payment_status_checked_users || '0'),
        paymentConfirmedUsers: parseInt(funnelSummary.payment_confirmed_users || '0'),
      },
      pricingExperiment30d: pricingExperiment.map((row: any) => ({
        pricingVariant: row.pricing_variant,
        priceLabel: row.price_label,
        amountCents: parseInt(row.amount_cents || '0'),
        assignedUsers: parseInt(row.assigned_users || '0'),
        paywallViewedUsers: parseInt(row.paywall_viewed_users || '0'),
        checkoutOpenedUsers: parseInt(row.checkout_opened_users || '0'),
        checkoutCompletedUsers: parseInt(row.checkout_completed_users || '0'),
        paymentConfirmedUsers: parseInt(row.payment_confirmed_users || '0'),
      })),
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
