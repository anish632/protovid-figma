import { neon } from '@neondatabase/serverless';

function getDB() {
  if (!process.env.NEON_DATABASE_URL) {
    throw new Error('Database not configured');
  }
  return neon(process.env.NEON_DATABASE_URL);
}

let dedupeTableReady: Promise<void> | null = null;

async function ensureEventDedupeTable(sql: ReturnType<typeof getDB>): Promise<void> {
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

export async function recordEvent(
  email: string | null,
  eventType: string,
  metadata: Record<string, unknown> = {},
  pluginVersion = 'backend'
) {
  const sql = getDB();
  const eventId = typeof metadata.event_id === 'string' ? metadata.event_id.slice(0, 255) : null;
  if (eventId) {
    await ensureEventDedupeTable(sql);
    const inserted = await sql`
      INSERT INTO protovid_event_dedupes (event_id)
      VALUES (${eventId})
      ON CONFLICT (event_id) DO NOTHING
      RETURNING event_id
    `;
    if (inserted.length === 0) return;
  }
  await sql`
    INSERT INTO protovid_events (
      email,
      event_type,
      plugin_version,
      metadata,
      created_at
    ) VALUES (
      ${email ? email.toLowerCase().trim() : null},
      ${eventType},
      ${pluginVersion},
      ${Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null},
      CURRENT_TIMESTAMP
    )
  `;
}
