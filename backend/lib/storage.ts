/**
 * ProtoVid Subscription Storage - Postgres Edition
 * Persistent storage using Neon Postgres (shared instance with RecurringTasks + ResolveAI)
 * Table: protovid_subscriptions
 */

import { neon } from '@neondatabase/serverless';
import type { BillingState } from './billingState';

function getDB() {
  if (!process.env.NEON_DATABASE_URL) {
    throw new Error('Database not configured');
  }
  return neon(process.env.NEON_DATABASE_URL);
}

export interface Subscription {
  email: string;
  tier: 'free' | 'pro';
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: string;
  exportsThisMonth: number;
  lastResetMonth: string;
  firstExportDate?: string;
  billingState?: BillingState | null;
}

function mapSubscription(row: any): Subscription {
  return {
    email: row.email,
    billingState: row.billingState || null,
    tier: row.tier as 'free' | 'pro',
    status: row.status as Subscription['status'],
    stripeCustomerId: row.stripeCustomerId || undefined,
    stripeSubscriptionId: row.stripeSubscriptionId || undefined,
    currentPeriodEnd: row.currentPeriodEnd ? new Date(row.currentPeriodEnd).toISOString() : undefined,
    exportsThisMonth: Number(row.exportsThisMonth || 0),
    lastResetMonth: row.lastResetMonth,
    firstExportDate: row.firstExportDate
      ? new Date(row.firstExportDate).toISOString().slice(0, 10)
      : undefined,
  };
}

export async function getSubscription(email: string): Promise<Subscription> {
  const sql = getDB();
  const normalized = email.toLowerCase().trim();
  
  const result = await sql`
    SELECT 
      email,
      billing_state as "billingState",
      tier,
      status,
      stripe_customer_id as "stripeCustomerId",
      stripe_subscription_id as "stripeSubscriptionId",
      current_period_end as "currentPeriodEnd",
      exports_this_month as "exportsThisMonth",
      last_reset_month as "lastResetMonth",
      first_export_date as "firstExportDate"
    FROM protovid_subscriptions
    WHERE email = ${normalized}
  `;
  
  if (result.length === 0) {
    // Return default free tier subscription
    return {
      email: normalized,
      tier: 'free',
      status: 'active',
      exportsThisMonth: 0,
      lastResetMonth: new Date().toISOString().slice(0, 7), // YYYY-MM
      firstExportDate: undefined,
    };
  }
  
  return mapSubscription(result[0]);
}

export async function setSubscription(email: string, data: Partial<Subscription>): Promise<void> {
  const sql = getDB();
  const normalized = email.toLowerCase().trim();
  const existing = await getSubscription(normalized);
  const merged = { ...existing, ...data };
  
  await sql`
    INSERT INTO protovid_subscriptions (
      email,
      tier,
      status,
      stripe_customer_id,
      stripe_subscription_id,
      current_period_end,
      exports_this_month,
      last_reset_month,
      first_export_date,
      updated_at
    ) VALUES (
      ${merged.email},
      ${merged.tier},
      ${merged.status},
      ${merged.stripeCustomerId || null},
      ${merged.stripeSubscriptionId || null},
      ${merged.currentPeriodEnd ? new Date(merged.currentPeriodEnd) : null},
      ${merged.exportsThisMonth},
      ${merged.lastResetMonth},
      ${merged.firstExportDate ? new Date(merged.firstExportDate) : null},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (email) DO UPDATE SET
      tier = EXCLUDED.tier,
      status = EXCLUDED.status,
      stripe_customer_id = EXCLUDED.stripe_customer_id,
      stripe_subscription_id = EXCLUDED.stripe_subscription_id,
      current_period_end = EXCLUDED.current_period_end,
      exports_this_month = EXCLUDED.exports_this_month,
      last_reset_month = EXCLUDED.last_reset_month,
      first_export_date = EXCLUDED.first_export_date,
      updated_at = CURRENT_TIMESTAMP
  `;
}

export async function findSubscriptionByCustomerId(customerId: string): Promise<Subscription | null> {
  const sql = getDB();
  const result = await sql`
    SELECT 
      email,
      billing_state as "billingState",
      tier,
      status,
      stripe_customer_id as "stripeCustomerId",
      stripe_subscription_id as "stripeSubscriptionId",
      current_period_end as "currentPeriodEnd",
      exports_this_month as "exportsThisMonth",
      last_reset_month as "lastResetMonth"
    FROM protovid_subscriptions
    WHERE stripe_customer_id = ${customerId}
  `;
  
  if (result.length === 0) return null;
  
  return mapSubscription(result[0]);
}

export async function findSubscriptionBySubscriptionId(subscriptionId: string): Promise<Subscription | null> {
  const sql = getDB();
  const result = await sql`
    SELECT 
      email,
      billing_state as "billingState",
      tier,
      status,
      stripe_customer_id as "stripeCustomerId",
      stripe_subscription_id as "stripeSubscriptionId",
      current_period_end as "currentPeriodEnd",
      exports_this_month as "exportsThisMonth",
      last_reset_month as "lastResetMonth"
    FROM protovid_subscriptions
    WHERE stripe_subscription_id = ${subscriptionId}
  `;
  
  if (result.length === 0) return null;
  
  return mapSubscription(result[0]);
}

export async function consumeFreeExport(
  email: string,
  limit: number,
): Promise<Subscription | null> {
  const sql = getDB();
  const normalized = email.toLowerCase().trim();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const today = new Date().toISOString().slice(0, 10);

  // Quota validation and consumption happen in one statement. Concurrent
  // requests cannot both pass the limit using a stale read.
  const rows = await sql`
    INSERT INTO protovid_subscriptions (
      email,
      tier,
      status,
      exports_this_month,
      last_reset_month,
      first_export_date,
      updated_at
    ) VALUES (
      ${normalized},
      ${'free'},
      ${'active'},
      ${1},
      ${currentMonth},
      ${today}::date,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (email) DO UPDATE SET
      exports_this_month = CASE
        WHEN protovid_subscriptions.last_reset_month <> ${currentMonth} THEN 1
        ELSE protovid_subscriptions.exports_this_month + 1
      END,
      last_reset_month = ${currentMonth},
      first_export_date = COALESCE(protovid_subscriptions.first_export_date, ${today}::date),
      updated_at = CURRENT_TIMESTAMP
    WHERE NOT (
        protovid_subscriptions.tier = 'pro'
        AND (protovid_subscriptions.status IN ('active', 'trialing') OR (
          protovid_subscriptions.status = 'past_due'
          AND billing_state->>'subscriptionId' = stripe_subscription_id
          AND billing_state->>'kind' IN ('payment_failed', 'authentication_required')
          AND (billing_state->>'graceEndsAt')::timestamptz > CURRENT_TIMESTAMP
        ))
      )
      AND (
        protovid_subscriptions.last_reset_month <> ${currentMonth}
        OR protovid_subscriptions.exports_this_month < ${limit}
      )
    RETURNING
      email,
      billing_state as "billingState",
      tier,
      status,
      stripe_customer_id as "stripeCustomerId",
      stripe_subscription_id as "stripeSubscriptionId",
      current_period_end as "currentPeriodEnd",
      exports_this_month as "exportsThisMonth",
      last_reset_month as "lastResetMonth",
      first_export_date as "firstExportDate"
  `;

  return rows.length ? mapSubscription(rows[0]) : null;
}
