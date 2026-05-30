import { neon } from '@neondatabase/serverless';

function getDB() {
  if (!process.env.NEON_DATABASE_URL) {
    throw new Error('Database not configured');
  }
  return neon(process.env.NEON_DATABASE_URL);
}

export async function recordEvent(
  email: string,
  eventType: string,
  metadata: Record<string, unknown> = {},
  pluginVersion = 'backend'
) {
  const sql = getDB();
  await sql`
    INSERT INTO protovid_events (
      email,
      event_type,
      plugin_version,
      metadata,
      created_at
    ) VALUES (
      ${email.toLowerCase().trim()},
      ${eventType},
      ${pluginVersion},
      ${Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null},
      CURRENT_TIMESTAMP
    )
  `;
}
