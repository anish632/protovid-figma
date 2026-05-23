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
        COUNT(DISTINCT email) as users,
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

    // Active users (unique emails, last 30 days)
    const [activeUsers] = await sql`
      SELECT COUNT(DISTINCT email) as count
      FROM protovid_events
      WHERE created_at >= ${last30d}
      AND email IS NOT NULL
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
      SELECT
        COUNT(*) FILTER (WHERE event_type = 'first_open') as first_open_events,
        COUNT(*) FILTER (WHERE event_type = 'onboarding_started') as onboarding_started_events,
        COUNT(DISTINCT email) FILTER (WHERE event_type = 'onboarding_completed') as onboarding_completed_users,
        COUNT(DISTINCT email) FILTER (WHERE event_type = 'email_captured') as email_captured_users,
        COUNT(*) FILTER (WHERE event_type = 'first_action_completed') as first_action_completed_events,
        COUNT(*) FILTER (WHERE event_type = 'demo_state_shown') as demo_state_shown_events,
        COUNT(DISTINCT email) FILTER (WHERE event_type = 'first_value_reached') as first_value_reached_users,
        COUNT(DISTINCT email) FILTER (WHERE event_type = 'export') as export_attempt_users,
        COUNT(DISTINCT email) FILTER (WHERE event_type = 'export_completed') as export_completed_users,
        COUNT(DISTINCT email) FILTER (WHERE event_type = 'review_prompt_shown') as review_prompt_shown_users,
        COUNT(DISTINCT email) FILTER (WHERE event_type = 'review_prompt_clicked') as review_prompt_clicked_users,
        COUNT(DISTINCT email) FILTER (WHERE event_type = 'checkout_start') as checkout_start_users,
        COUNT(DISTINCT email) FILTER (WHERE event_type = 'checkout_opened') as checkout_opened_users,
        COUNT(DISTINCT email) FILTER (WHERE event_type = 'payment_confirmed') as payment_confirmed_users
      FROM protovid_events
      WHERE created_at >= ${last30d}
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
        onboardingStartedEvents: parseInt(funnelSummary.onboarding_started_events || '0'),
        onboardingCompletedUsers: parseInt(funnelSummary.onboarding_completed_users || '0'),
        emailCapturedUsers: parseInt(funnelSummary.email_captured_users || '0'),
        firstActionCompletedEvents: parseInt(funnelSummary.first_action_completed_events || '0'),
        demoStateShownEvents: parseInt(funnelSummary.demo_state_shown_events || '0'),
        firstValueReachedUsers: parseInt(funnelSummary.first_value_reached_users || '0'),
        exportAttemptUsers: parseInt(funnelSummary.export_attempt_users || '0'),
        exportCompletedUsers: parseInt(funnelSummary.export_completed_users || '0'),
        reviewPromptShownUsers: parseInt(funnelSummary.review_prompt_shown_users || '0'),
        reviewPromptClickedUsers: parseInt(funnelSummary.review_prompt_clicked_users || '0'),
        checkoutStartUsers: parseInt(funnelSummary.checkout_start_users || '0'),
        checkoutOpenedUsers: parseInt(funnelSummary.checkout_opened_users || '0'),
        paymentConfirmedUsers: parseInt(funnelSummary.payment_confirmed_users || '0'),
      },
      freeTier30d: {
        freeLimit: FREE_TIER_EXPORT_LIMIT,
        trackedFreeUsersThisMonth: parseInt(freeTierPressure.tracked_free_users_this_month || '0'),
        trackedFreeExportsThisMonth: parseInt(freeTierPressure.tracked_free_exports_this_month || '0'),
        freeUsersAtLimit: parseInt(freeTierPressure.free_users_at_limit || '0'),
      },
      recentEvents: recentEvents.map((e: any) => ({
        email: e.email,
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
