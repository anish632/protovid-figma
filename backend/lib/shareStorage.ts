import { randomBytes } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { buildPrototypeDecisionBrief, type PrototypeDecisionBrief } from './prototypeIntelligence';
import { ensureReviewTables } from './reviewStorage';

export const MAX_SHARE_BYTES = 4_000_000;
export const FREE_SHARE_TTL_DAYS = 7;
export const PAID_SHARE_TTL_DAYS = 30;
export type ShareExperimentVariant = 'control' | 'invite_panel';

export interface ShareRecord {
  id: string;
  email: string | null;
  anonymousId: string | null;
  filename: string;
  resolution: string;
  frameCount: number;
  expiresAt: string;
  createdAt: string;
  viewCount: number;
  experimentVariant: ShareExperimentVariant | null;
  startFrameName: string | null;
  endFrameName: string | null;
  estimatedDurationSeconds: number | null;
  decisionBrief: PrototypeDecisionBrief;
}

let tableReady: Promise<void> | null = null;

function getDB() {
  if (!process.env.NEON_DATABASE_URL) {
    throw new Error('Database not configured');
  }
  return neon(process.env.NEON_DATABASE_URL);
}

async function ensureShareTable(): Promise<void> {
  if (!tableReady) {
    const sql = getDB();
    tableReady = sql`
      CREATE TABLE IF NOT EXISTS protovid_shares (
        id VARCHAR(32) PRIMARY KEY,
        email VARCHAR(255),
        anonymous_id VARCHAR(128),
        filename VARCHAR(255) NOT NULL,
        resolution VARCHAR(32) NOT NULL DEFAULT '720p',
        frame_count INTEGER NOT NULL DEFAULT 0,
        mime_type VARCHAR(100) NOT NULL DEFAULT 'video/mp4',
        video_data BYTEA NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        experiment_variant VARCHAR(32),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        view_count INTEGER NOT NULL DEFAULT 0
      )
    `.then(() => sql`
      ALTER TABLE protovid_shares
      ADD COLUMN IF NOT EXISTS experiment_variant VARCHAR(32)
    `).then(() => sql`
      ALTER TABLE protovid_shares
      ADD COLUMN IF NOT EXISTS start_frame_name VARCHAR(255)
    `).then(() => sql`
      ALTER TABLE protovid_shares
      ADD COLUMN IF NOT EXISTS end_frame_name VARCHAR(255)
    `).then(() => sql`
      ALTER TABLE protovid_shares
      ADD COLUMN IF NOT EXISTS estimated_duration_seconds NUMERIC(10, 1)
    `).then(() => sql`
      ALTER TABLE protovid_shares
      ADD COLUMN IF NOT EXISTS decision_brief JSONB
    `).then(() => sql`
      CREATE INDEX IF NOT EXISTS idx_protovid_shares_expires_at
      ON protovid_shares(expires_at)
    `).then(() => undefined);
  }
  await tableReady;
}

export function normalizeShareExperimentVariant(value: unknown): ShareExperimentVariant | null {
  return value === 'control' || value === 'invite_panel' ? value : null;
}

function createShareId(): string {
  return randomBytes(18).toString('base64url');
}

function normalizeFilename(filename: string | null | undefined): string {
  const cleaned = (filename || 'protovid-export.mp4')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
  return cleaned.toLowerCase().endsWith('.mp4') ? cleaned : `${cleaned || 'protovid-export'}.mp4`;
}

function normalizeOptionalText(value: string | null | undefined, limit = 255): string | null {
  const cleaned = (value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
  return cleaned || null;
}

function normalizeDurationSeconds(value: number | null | undefined): number | null {
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.round((value || 0) * 10) / 10);
}

function normalizeDecisionBrief(value: unknown, fallback: PrototypeDecisionBrief): PrototypeDecisionBrief {
  if (!value) return fallback;
  if (typeof value === 'string') {
    try {
      return normalizeDecisionBrief(JSON.parse(value), fallback);
    } catch {
      return fallback;
    }
  }
  if (
    typeof value === 'object'
    && 'summary' in value
    && 'walkthroughScript' in value
    && 'signals' in value
  ) {
    return value as PrototypeDecisionBrief;
  }
  return fallback;
}

function mapShare(row: any): ShareRecord {
  const frameCount = Number(row.frame_count || 0);
  const estimatedDurationSeconds = normalizeDurationSeconds(Number(row.estimated_duration_seconds));
  const fallbackBrief = buildPrototypeDecisionBrief({
    filename: row.filename,
    frameCount,
    resolution: row.resolution,
    startFrameName: row.start_frame_name,
    endFrameName: row.end_frame_name,
    estimatedDurationSeconds,
  });

  return {
    id: row.id,
    email: row.email || null,
    anonymousId: row.anonymous_id || null,
    filename: row.filename,
    resolution: row.resolution,
    frameCount: Number(row.frame_count || 0),
    expiresAt: new Date(row.expires_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
    viewCount: Number(row.view_count || 0),
    experimentVariant: normalizeShareExperimentVariant(row.experiment_variant),
    startFrameName: row.start_frame_name || null,
    endFrameName: row.end_frame_name || null,
    estimatedDurationSeconds,
    decisionBrief: normalizeDecisionBrief(row.decision_brief, fallbackBrief),
  };
}

export async function createShare(input: {
  video: Uint8Array;
  email?: string | null;
  anonymousId?: string | null;
  filename?: string | null;
  resolution?: string | null;
  frameCount?: number | null;
  startFrameName?: string | null;
  endFrameName?: string | null;
  estimatedDurationSeconds?: number | null;
  paid?: boolean;
  experimentVariant?: ShareExperimentVariant | null;
}): Promise<ShareRecord> {
  if (input.video.byteLength === 0) throw new Error('Share video is empty');
  if (input.video.byteLength > MAX_SHARE_BYTES) throw new Error('Share video is too large');

  await ensureShareTable();
  const sql = getDB();
  const id = createShareId();
  const ttlDays = input.paid ? PAID_SHARE_TTL_DAYS : FREE_SHARE_TTL_DAYS;
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
  const email = input.email?.toLowerCase().trim() || null;
  const filename = normalizeFilename(input.filename);
  const frameCount = Math.max(0, Math.floor(input.frameCount || 0));
  const startFrameName = normalizeOptionalText(input.startFrameName);
  const endFrameName = normalizeOptionalText(input.endFrameName);
  const estimatedDurationSeconds = normalizeDurationSeconds(input.estimatedDurationSeconds);
  const decisionBrief = buildPrototypeDecisionBrief({
    filename,
    frameCount,
    resolution: input.resolution || '720p',
    startFrameName,
    endFrameName,
    estimatedDurationSeconds,
  });

  const rows = await sql`
    INSERT INTO protovid_shares (
      id, email, anonymous_id, filename, resolution, frame_count,
      start_frame_name, end_frame_name, estimated_duration_seconds, decision_brief,
      mime_type, video_data, expires_at, experiment_variant
    ) VALUES (
      ${id},
      ${email},
      ${input.anonymousId || null},
      ${filename},
      ${input.resolution || '720p'},
      ${frameCount},
      ${startFrameName},
      ${endFrameName},
      ${estimatedDurationSeconds},
      ${JSON.stringify(decisionBrief)},
      ${'video/mp4'},
      ${Buffer.from(input.video)},
      ${expiresAt},
      ${normalizeShareExperimentVariant(input.experimentVariant)}
    )
      RETURNING id, email, anonymous_id, filename, resolution, frame_count, start_frame_name, end_frame_name, estimated_duration_seconds, decision_brief, expires_at, created_at, view_count, experiment_variant
  `;

  return mapShare(rows[0]);
}

export async function getShare(id: string): Promise<ShareRecord | null> {
  await ensureShareTable();
  const sql = getDB();
  const rows = await sql`
    SELECT id, email, anonymous_id, filename, resolution, frame_count,
      expires_at, created_at, view_count, experiment_variant, start_frame_name,
      end_frame_name, estimated_duration_seconds, decision_brief
    FROM protovid_shares
    WHERE id = ${id}
      AND expires_at > CURRENT_TIMESTAMP
  `;
  return rows.length ? mapShare(rows[0]) : null;
}

export async function getShareVideo(id: string): Promise<{
  share: ShareRecord;
  video: Uint8Array;
} | null> {
  await ensureShareTable();
  const sql = getDB();
  const rows = await sql`
    SELECT id, email, anonymous_id, filename, resolution, frame_count, expires_at, created_at, view_count, experiment_variant, start_frame_name, end_frame_name, estimated_duration_seconds, decision_brief, video_data
    FROM protovid_shares
    WHERE id = ${id}
      AND expires_at > CURRENT_TIMESTAMP
  `;
  if (!rows.length) return null;

  const row = rows[0];
  return {
    share: mapShare(row),
    video: new Uint8Array(row.video_data),
  };
}

export async function incrementShareViews(id: string): Promise<void> {
  await ensureShareTable();
  const sql = getDB();
  await sql`
    UPDATE protovid_shares
    SET view_count = view_count + 1
    WHERE id = ${id}
      AND expires_at > CURRENT_TIMESTAMP
  `;
}

/**
 * Physically remove expired customer videos and their review data. Links are
 * hidden immediately at expiry; this cleanup keeps the stored bytes and
 * comments from lingering after the promised retention window.
 */
export async function cleanupExpiredShares(): Promise<number> {
  await ensureShareTable();
  await ensureReviewTables();
  const sql = getDB();
  const deleted = await sql`
    WITH expired AS (
      SELECT id
      FROM protovid_shares
      WHERE expires_at <= CURRENT_TIMESTAMP
    ), deleted_comments AS (
      DELETE FROM protovid_review_comments
      WHERE share_id IN (SELECT id FROM expired)
    ), deleted_rooms AS (
      DELETE FROM protovid_review_rooms
      WHERE share_id IN (SELECT id FROM expired)
    )
    DELETE FROM protovid_shares
    WHERE id IN (SELECT id FROM expired)
    RETURNING id
  `;
  return deleted.length;
}
