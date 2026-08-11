import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { sanitizeError, trackingRequestSchema } from '@/lib/validation';

let dedupeTableReady: Promise<void> | null = null;

async function ensureEventDedupeTable(sql: ReturnType<typeof getDB>) {
  if (!dedupeTableReady) {
    dedupeTableReady = sql`
      CREATE TABLE IF NOT EXISTS protovid_event_dedupes (
        event_id VARCHAR(255) PRIMARY KEY,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `.then(() => undefined);
  }
  await dedupeTableReady;
}

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

    const eventId = typeof metadata?.event_id === 'string' ? metadata.event_id.slice(0, 255) : null;
    if (eventId) {
      await ensureEventDedupeTable(sql);
      const inserted = await sql`
        INSERT INTO protovid_event_dedupes (event_id)
        VALUES (${eventId})
        ON CONFLICT (event_id) DO NOTHING
        RETURNING event_id
      `;
      if (inserted.length === 0) {
        return NextResponse.json({ success: true, deduplicated: true }, {
          headers: { 'Access-Control-Allow-Origin': '*' },
        });
      }
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
    const status = error instanceof Error && error.name === 'ZodError' ? 400 : 500;
    return NextResponse.json({ error: sanitizeError(error) }, { status });
  }
}
