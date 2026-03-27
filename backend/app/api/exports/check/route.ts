/*
 * POST /api/exports/check
 * Check if a user can export (server-side export tracking)
 *
 * DB Migration (run once):
 *   CREATE TABLE IF NOT EXISTS protovid_export_counts (
 *     email VARCHAR(255) NOT NULL,
 *     month VARCHAR(7) NOT NULL,
 *     count INTEGER NOT NULL DEFAULT 0,
 *     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 *     PRIMARY KEY (email, month)
 *   );
 *   CREATE INDEX IF NOT EXISTS idx_export_counts_email ON protovid_export_counts(email);
 */

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { exportCheckRequestSchema, sanitizeError } from '@/lib/validation';
import { withRateLimit, generalRateLimit } from '@/lib/rateLimit';

function getDB() {
  if (!process.env.NEON_DATABASE_URL) {
    throw new Error('Database not configured');
  }
  return neon(process.env.NEON_DATABASE_URL);
}

const FREE_LIMIT = 1;

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}

async function handlePOST(request: NextRequest) {
  try {
    const sql = getDB();
    const body = await request.json();
    const { email } = exportCheckRequestSchema.parse(body);
    const normalizedEmail = email;
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    // Check if user has active premium subscription
    const subResult = await sql`
      SELECT tier, status FROM protovid_subscriptions
      WHERE email = ${normalizedEmail}
      AND tier = 'pro'
      AND status IN ('active', 'trialing')
      LIMIT 1
    `;

    const isPremium = subResult.length > 0;

    if (isPremium) {
      return NextResponse.json(
        { canExport: true, exportsThisMonth: 0, limit: 999, isPremium: true }
      );
    }

    // Check free tier export count
    const countResult = await sql`
      SELECT count FROM protovid_export_counts
      WHERE email = ${normalizedEmail} AND month = ${currentMonth}
      LIMIT 1
    `;

    const exportsThisMonth = countResult.length > 0 ? parseInt(countResult[0].count) : 0;

    return NextResponse.json({
      canExport: exportsThisMonth < FREE_LIMIT,
      exportsThisMonth,
      limit: FREE_LIMIT,
      isPremium: false,
    });
  } catch (error) {
    console.error('Export check error:', error);
    return NextResponse.json({
      canExport: true, 
      exportsThisMonth: 0, 
      limit: FREE_LIMIT, 
      isPremium: false, 
      error: sanitizeError(error)
    });
  }
}

export const POST = withRateLimit(generalRateLimit, handlePOST);
