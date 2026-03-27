/*
 * POST /api/exports/increment
 * Increment a user's server-side export count for the current month
 */

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_DATABASE_URL!);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    // Upsert: insert or increment
    await sql`
      INSERT INTO protovid_export_counts (email, month, count, updated_at)
      VALUES (${normalizedEmail}, ${currentMonth}, 1, CURRENT_TIMESTAMP)
      ON CONFLICT (email, month)
      DO UPDATE SET
        count = protovid_export_counts.count + 1,
        updated_at = CURRENT_TIMESTAMP
    `;

    // Return updated count
    const result = await sql`
      SELECT count FROM protovid_export_counts
      WHERE email = ${normalizedEmail} AND month = ${currentMonth}
    `;

    const newCount = result.length > 0 ? parseInt(result[0].count) : 1;

    return NextResponse.json(
      { success: true, exportsThisMonth: newCount },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('Export increment error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to increment' },
      { status: 500, headers: corsHeaders }
    );
  }
}
