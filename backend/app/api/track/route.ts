import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { sanitizeError, trackingRequestSchema } from '@/lib/validation';

function getDB() {
  if (!process.env.NEON_DATABASE_URL) {
    throw new Error('Database not configured');
  }
  return neon(process.env.NEON_DATABASE_URL);
}

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
    const sql = getDB();
    const body = await request.json();
    const { email, eventType, pluginVersion, metadata } = trackingRequestSchema.parse(body);

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
    const status = error instanceof Error && error.name === 'ZodError' ? 400 : 500;
    return NextResponse.json({ error: sanitizeError(error) }, { status });
  }
}
