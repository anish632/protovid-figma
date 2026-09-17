import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { syncBillingRecovery } from '@/lib/billingRecovery';
import { deliverBillingNotification } from '@/lib/billingNotification';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const sql = neon(process.env.NEON_DATABASE_URL!);
  // Recover from a crashed worker only within Resend's idempotency window.
  await sql`UPDATE protovid_billing_notifications SET status = 'retry'
    WHERE status = 'sending' AND attempted_at < CURRENT_TIMESTAMP - INTERVAL '5 minutes'
    AND attempted_at > CURRENT_TIMESTAMP - INTERVAL '23 hours'`;
  const rows = await sql`SELECT email FROM protovid_subscriptions WHERE stripe_subscription_id IS NOT NULL
    AND (status = 'past_due' OR billing_state IS NOT NULL) ORDER BY updated_at ASC LIMIT 50`;
  const results: Record<string, number> = {};
  for (const row of rows) {
    try {
      // Check current Stripe state before choosing a message; stale reminders are never queued for delivery.
      const subscription = await syncBillingRecovery(row.email);
      const result = await deliverBillingNotification(subscription);
      results[result] = (results[result] || 0) + 1;
    } catch (error) {
      console.error('Billing recovery failed:', error);
      results.failed = (results.failed || 0) + 1;
    }
  }
  return NextResponse.json({ results }, { status: results.failed ? 500 : 200 });
}
