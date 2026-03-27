import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_DATABASE_URL!);

// Simple API key protection
const STATS_API_KEY = process.env.STATS_API_KEY || 'protovid_stats_key_2026';

export async function GET(request: NextRequest) {
  try {
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
        COUNT(*) as count
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

    // Recent events
    const recentEvents = await sql`
      SELECT 
        email,
        event_type,
        plugin_version,
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
      })),
      dailyEvents: dailyEvents.map((e: any) => ({
        date: e.date,
        count: parseInt(e.count),
      })),
      activeUsers30d: parseInt(activeUsers.count),
      totalSubscriptions: parseInt(totalSubs.count),
      proSubscriptions: parseInt(proSubs.count),
      recentEvents: recentEvents.map((e: any) => ({
        email: e.email,
        eventType: e.event_type,
        pluginVersion: e.plugin_version,
        timestamp: e.created_at,
      })),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
