import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_DATABASE_URL!);

export async function OPTIONS() {
  return NextResponse.json({}, { 
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    const { email, eventType, pluginVersion, metadata } = await request.json();

    if (!eventType) {
      return NextResponse.json({ error: 'Event type required' }, { status: 400 });
    }

    // Valid event types
    const validEventTypes = ['export', 'checkout_start', 'license_validate', 'plugin_load'];
    if (!validEventTypes.includes(eventType)) {
      return NextResponse.json({ error: 'Invalid event type' }, { status: 400 });
    }

    await sql`
      INSERT INTO protovid_events (
        email,
        event_type,
        plugin_version,
        metadata,
        created_at
      ) VALUES (
        ${email || null},
        ${eventType},
        ${pluginVersion || null},
        ${metadata ? JSON.stringify(metadata) : null},
        CURRENT_TIMESTAMP
      )
    `;

    return NextResponse.json({ success: true }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
      }
    });
  } catch (error) {
    console.error('Track error:', error);
    return NextResponse.json({ error: 'Failed to track event' }, { status: 500 });
  }
}
