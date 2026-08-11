import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getUsageSummary, shouldMonitorUser } from '@/lib/usageMonitoring';

function getDB() {
  if (!process.env.NEON_DATABASE_URL) {
    throw new Error('Database not configured');
  }
  return neon(process.env.NEON_DATABASE_URL);
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}

export async function GET(request: NextRequest) {
  try {
    // Simple admin key protection
    const adminKey = request.headers.get('x-admin-key');
    const expectedKey = process.env.PROTOVID_ADMIN_KEY?.trim() || process.env.STATS_API_KEY?.trim();
    
    if (!expectedKey || adminKey !== expectedKey) {
      return NextResponse.json({ 
        error: 'Unauthorized - admin key required' 
      }, { status: 403 });
    }

    // Get monitored users status
    const monitoredUsers = ['iva@clarion.agency'];
    const usage = await Promise.all(
      monitoredUsers.map(async (email) => ({
        email,
        ...(await getUsageSummary(email))
      }))
    );
    const sql = getDB();
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [exportReliability] = await sql`
      SELECT
        COUNT(DISTINCT COALESCE(NULLIF(LOWER(email), 'anonymous'), NULLIF(metadata::jsonb->>'anonymousId', ''))) FILTER (
          WHERE created_at >= ${last30d}
        )::int AS actors_30d,
        COUNT(*) FILTER (
          WHERE created_at >= ${last30d}
            AND event_type IN ('export', 'export_started')
        )::int AS export_attempt_events_30d,
        COUNT(DISTINCT COALESCE(NULLIF(LOWER(email), 'anonymous'), NULLIF(metadata::jsonb->>'anonymousId', ''))) FILTER (
          WHERE created_at >= ${last30d}
            AND event_type IN ('export', 'export_started')
        )::int AS export_attempt_actors_30d,
        COUNT(*) FILTER (
          WHERE created_at >= ${last30d}
            AND event_type IN ('export_success', 'export_completed', 'video_export_completed')
        )::int AS export_success_events_30d,
        COUNT(DISTINCT COALESCE(NULLIF(LOWER(email), 'anonymous'), NULLIF(metadata::jsonb->>'anonymousId', ''))) FILTER (
          WHERE created_at >= ${last30d}
            AND event_type IN ('export_success', 'export_completed', 'video_export_completed')
        )::int AS export_success_actors_30d,
        COUNT(*) FILTER (
          WHERE created_at >= ${last30d}
            AND event_type = 'export_failed'
        )::int AS export_failure_events_30d,
        COUNT(DISTINCT COALESCE(NULLIF(LOWER(email), 'anonymous'), NULLIF(metadata::jsonb->>'anonymousId', ''))) FILTER (
          WHERE created_at >= ${last30d}
            AND event_type = 'export_failed'
        )::int AS export_failure_actors_30d,
        COUNT(*) FILTER (
          WHERE created_at >= ${last7d}
            AND event_type = 'export_safe_retry_succeeded'
        )::int AS safe_retry_success_events_7d,
        COUNT(*) FILTER (
          WHERE created_at >= ${last7d}
            AND event_type = 'export_safe_retry_failed'
        )::int AS safe_retry_failure_events_7d
      FROM protovid_events
    `;

    // Safe retry strategy effectiveness
    const safeRetryStrategy = await sql`
      SELECT
        COALESCE(metadata::jsonb->>'retryStrategy', 'unknown') AS retry_strategy,
        COUNT(*) FILTER (WHERE event_type = 'export_safe_retry_succeeded')::int AS successes,
        COUNT(*) FILTER (WHERE event_type = 'export_safe_retry_failed')::int AS failures
      FROM protovid_events
      WHERE created_at >= ${last30d}
        AND event_type IN ('export_safe_retry_succeeded', 'export_safe_retry_failed')
      GROUP BY 1
      ORDER BY successes DESC
    `;

    const failureReasons = await sql`
      SELECT
        COALESCE(metadata::jsonb->>'reason', 'unknown') AS reason,
        COALESCE(metadata::jsonb->>'source', 'unknown') AS source,
        COALESCE(metadata::jsonb->>'backend_error_type', 'none') AS backend_error_type,
        COALESCE(metadata::jsonb->>'first_error_source', 'none') AS first_error_source,
        AVG((metadata::jsonb->>'input_size_mb')::numeric)::numeric(10,2) AS avg_input_size_mb,
        MAX((metadata::jsonb->>'input_size_mb')::numeric)::numeric(10,2) AS max_input_size_mb,
        AVG((metadata::jsonb->>'frameCount')::numeric)::numeric(10,2) AS avg_frame_count,
        MAX((metadata::jsonb->>'frameCount')::numeric)::numeric(10,2) AS max_frame_count,
        COUNT(*)::int AS events,
        COUNT(DISTINCT COALESCE(NULLIF(LOWER(email), 'anonymous'), NULLIF(metadata::jsonb->>'anonymousId', '')))::int AS actors
      FROM protovid_events
      WHERE created_at >= ${last30d}
        AND event_type = 'export_failed'
      GROUP BY 1, 2, 3, 4
      ORDER BY events DESC
    `;

    // Single-dimension rollup so the dominant failure category (e.g.
    // payload_too_large, timeout, ffmpeg_error, browser_encode) is visible at a
    // glance instead of being split across the high-cardinality grouping above.
    // Falls back to the coarse reason when no backend category was recorded.
    const failureCategories = await sql`
      SELECT
        COALESCE(
          NULLIF(metadata::jsonb->>'backend_error_type', ''),
          NULLIF(metadata::jsonb->>'reason', ''),
          'unknown'
        ) AS category,
        COUNT(*)::int AS events,
        COUNT(DISTINCT COALESCE(NULLIF(LOWER(email), 'anonymous'), NULLIF(metadata::jsonb->>'anonymousId', '')))::int AS actors,
        AVG((metadata::jsonb->>'input_size_mb')::numeric)::numeric(10,2) AS avg_input_size_mb,
        AVG((metadata::jsonb->>'frameCount')::numeric)::numeric(10,2) AS avg_frame_count
      FROM protovid_events
      WHERE created_at >= ${last30d}
        AND event_type = 'export_failed'
      GROUP BY 1
      ORDER BY events DESC
    `;

    const [transcodeMetrics] = await sql`
      SELECT
        COUNT(*)::int AS backend_exports_30d,
        ROUND(AVG((metadata::jsonb->>'processing_time_ms')::numeric))::int AS avg_processing_ms,
        ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY (metadata::jsonb->>'processing_time_ms')::numeric))::int AS p95_processing_ms,
        ROUND(AVG((metadata::jsonb->>'video_size_mb')::numeric), 2)::float AS avg_video_size_mb,
        ROUND(MAX((metadata::jsonb->>'video_size_mb')::numeric), 2)::float AS max_video_size_mb
      FROM protovid_events
      WHERE created_at >= ${last30d}
        AND event_type = 'video_export_completed'
        AND metadata::jsonb ? 'processing_time_ms'
    `;

    // Simple monitoring dashboard
    const dashboard = {
      timestamp: new Date().toISOString(),
      monitored_users: usage,
      export_reliability: {
        ...exportReliability,
        actor_success_rate_30d: exportReliability.export_attempt_actors_30d > 0
          ? Math.round((exportReliability.export_success_actors_30d / exportReliability.export_attempt_actors_30d) * 1000) / 10
          : null,
        failure_categories_30d: failureCategories,
        failure_reasons_30d: failureReasons,
        backend_transcode_30d: transcodeMetrics,
        safe_retry_strategy_30d: safeRetryStrategy,
      },
      vercel_monitoring: {
        note: 'Check Vercel dashboard for actual bandwidth/compute usage',
        dashboard_url: 'https://vercel.com/dashboard/usage',
        key_metrics: [
          'Function Invocations',
          'Bandwidth Usage', 
          'Function Duration',
          'Edge Requests'
        ]
      },
      cost_estimates: {
        note: 'Rough estimates - check actual Vercel billing',
        free_tier_limits: {
          bandwidth: '100 GB/month',
          function_hours: '100 hours/month'
        },
        overage_costs: {
          bandwidth: '$20 per 100GB',
          function_time: '$2 per hour'
        }
      },
      alert_thresholds: {
        daily_exports: '20 (warning), 50 (critical)',
        monthly_exports: '100 (warning), 500 (critical)',
        video_size: '50MB+ per video',
        processing_time: '25+ seconds'
      }
    };

    return NextResponse.json(dashboard);

  } catch (error) {
    console.error('Usage monitoring error:', error);
    return NextResponse.json({ 
      error: 'Failed to get usage data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Simple admin key protection
    const adminKey = request.headers.get('x-admin-key');
    const expectedKey = process.env.PROTOVID_ADMIN_KEY?.trim() || process.env.STATS_API_KEY?.trim();
    
    if (!expectedKey || adminKey !== expectedKey) {
      return NextResponse.json({ 
        error: 'Unauthorized - admin key required' 
      }, { status: 403 });
    }

    const { email } = await request.json();
    
    if (!email) {
      return NextResponse.json({ 
        error: 'Email required' 
      }, { status: 400 });
    }

    const isMonitored = shouldMonitorUser(email);
    const summary = await getUsageSummary(email);

    return NextResponse.json({
      email,
      is_monitored: isMonitored,
      usage_summary: summary,
      message: isMonitored 
        ? 'User is being monitored for high-volume usage'
        : 'User is not in monitoring list'
    });

  } catch (error) {
    console.error('Usage check error:', error);
    return NextResponse.json({ 
      error: 'Failed to check usage',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
