import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

export type ReviewStatus = 'open' | 'approved' | 'changes_requested';

export interface ReviewComment {
  id: string;
  shareId: string;
  reviewerName: string;
  body: string;
  timestampSeconds: number;
  createdAt: string;
}

export interface ReviewRoom {
  shareId: string;
  status: ReviewStatus;
  comments: ReviewComment[];
}

function getDB() {
  if (!process.env.NEON_DATABASE_URL) throw new Error('Database not configured');
  return neon(process.env.NEON_DATABASE_URL);
}

function hashOwnerToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function createOwnerToken(): string {
  return randomBytes(24).toString('base64url');
}

function createCommentId(): string {
  return randomBytes(12).toString('base64url');
}

let reviewTablesReady: Promise<void> | null = null;

export function normalizeReviewStatus(value: unknown): ReviewStatus | null {
  return value === 'open' || value === 'approved' || value === 'changes_requested' ? value : null;
}

export function normalizeCommentInput(input: {
  reviewerName?: unknown;
  body?: unknown;
  timestampSeconds?: unknown;
}): { reviewerName: string; body: string; timestampSeconds: number } | null {
  const reviewerName = typeof input.reviewerName === 'string' ? input.reviewerName.trim().slice(0, 80) : '';
  const body = typeof input.body === 'string' ? input.body.trim().slice(0, 2_000) : '';
  const timestampSeconds = typeof input.timestampSeconds === 'number' ? input.timestampSeconds : Number(input.timestampSeconds);

  if (!reviewerName || !body || !Number.isFinite(timestampSeconds) || timestampSeconds < 0 || timestampSeconds > 86_400) {
    return null;
  }

  return { reviewerName, body, timestampSeconds: Math.round(timestampSeconds * 10) / 10 };
}

function mapComment(row: any): ReviewComment {
  return {
    id: row.id,
    shareId: row.share_id,
    reviewerName: row.reviewer_name,
    body: row.body,
    timestampSeconds: Number(row.timestamp_seconds || 0),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function ensureReviewTables(): Promise<void> {
  if (!reviewTablesReady) {
    const sql = getDB();
    reviewTablesReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS protovid_review_rooms (
          share_id VARCHAR(32) PRIMARY KEY,
          owner_token_hash VARCHAR(64) NOT NULL,
          status VARCHAR(32) NOT NULL DEFAULT 'open',
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS protovid_review_comments (
          id VARCHAR(32) PRIMARY KEY,
          share_id VARCHAR(32) NOT NULL,
          reviewer_name VARCHAR(80) NOT NULL,
          body VARCHAR(2000) NOT NULL,
          timestamp_seconds NUMERIC(10, 1) NOT NULL DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_protovid_review_comments_share_id
        ON protovid_review_comments(share_id, created_at)
      `;
    })();
  }
  await reviewTablesReady;
}

export async function createReviewRoom(shareId: string): Promise<{ ownerToken: string }> {
  await ensureReviewTables();
  const sql = getDB();
  const ownerToken = createOwnerToken();
  await sql`
    INSERT INTO protovid_review_rooms (share_id, owner_token_hash)
    VALUES (${shareId}, ${hashOwnerToken(ownerToken)})
    ON CONFLICT (share_id) DO NOTHING
  `;
  return { ownerToken };
}

export async function getReviewRoom(shareId: string): Promise<ReviewRoom> {
  await ensureReviewTables();
  const sql = getDB();
  const roomRows = await sql`
    SELECT share_id, status
    FROM protovid_review_rooms
    WHERE share_id = ${shareId}
  `;

  if (!roomRows.length) {
    await createReviewRoom(shareId);
    return { shareId, status: 'open', comments: [] };
  }

  const commentRows = await sql`
    SELECT id, share_id, reviewer_name, body, timestamp_seconds, created_at
    FROM protovid_review_comments
    WHERE share_id = ${shareId}
    ORDER BY created_at ASC
  `;

  return {
    shareId,
    status: normalizeReviewStatus(roomRows[0].status) || 'open',
    comments: commentRows.map(mapComment),
  };
}

export async function addReviewComment(shareId: string, input: {
  reviewerName: string;
  body: string;
  timestampSeconds: number;
}): Promise<ReviewComment> {
  await ensureReviewTables();
  const sql = getDB();
  const id = createCommentId();
  const rows = await sql`
    INSERT INTO protovid_review_comments (id, share_id, reviewer_name, body, timestamp_seconds)
    VALUES (${id}, ${shareId}, ${input.reviewerName}, ${input.body}, ${input.timestampSeconds})
    RETURNING id, share_id, reviewer_name, body, timestamp_seconds, created_at
  `;
  return mapComment(rows[0]);
}

export async function updateReviewStatus(shareId: string, status: ReviewStatus, ownerToken: string): Promise<boolean> {
  await ensureReviewTables();
  const sql = getDB();
  const tokenHash = hashOwnerToken(ownerToken);
  const rows = await sql`
    SELECT owner_token_hash
    FROM protovid_review_rooms
    WHERE share_id = ${shareId}
  `;
  if (!rows.length) return false;

  const expected = Buffer.from(rows[0].owner_token_hash, 'hex');
  const actual = Buffer.from(tokenHash, 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false;

  await sql`
    UPDATE protovid_review_rooms
    SET status = ${status}, updated_at = CURRENT_TIMESTAMP
    WHERE share_id = ${shareId}
  `;
  return true;
}
