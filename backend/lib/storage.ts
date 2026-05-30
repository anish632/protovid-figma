/**
 * ProtoVid Subscription Storage - Postgres Edition
 * Persistent storage using Neon Postgres (shared instance with RecurringTasks + ResolveAI)
 * Table: protovid_subscriptions
 */

import { neon } from '@neondatabase/serverless';

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
}

export async function getSubscription(email: string): Promise<Subscription> {
  const sql = getDB();
  const normalized = email.toLowerCase().trim();
  
  const result = await sql`
    SELECT 
      email,
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
  
  const row = result[0];
  return {
    email: row.email,
    tier: row.tier as 'free' | 'pro',
    status: row.status as any,
    stripeCustomerId: row.stripeCustomerId || undefined,
    stripeSubscriptionId: row.stripeSubscriptionId || undefined,
    currentPeriodEnd: row.currentPeriodEnd ? new Date(row.currentPeriodEnd).toISOString() : undefined,
    exportsThisMonth: row.exportsThisMonth,
    lastResetMonth: row.lastResetMonth,
    firstExportDate: row.firstExportDate || undefined,
  };
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
  
  const row = result[0];
  return {
    email: row.email,
    tier: row.tier as 'free' | 'pro',
    status: row.status as any,
    stripeCustomerId: row.stripeCustomerId || undefined,
    stripeSubscriptionId: row.stripeSubscriptionId || undefined,
    currentPeriodEnd: row.currentPeriodEnd ? new Date(row.currentPeriodEnd).toISOString() : undefined,
    exportsThisMonth: row.exportsThisMonth,
    lastResetMonth: row.lastResetMonth,
  };
}

export async function findSubscriptionBySubscriptionId(subscriptionId: string): Promise<Subscription | null> {
  const sql = getDB();
  const result = await sql`
    SELECT 
      email,
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
  
  const row = result[0];
  return {
    email: row.email,
    tier: row.tier as 'free' | 'pro',
    status: row.status as any,
    stripeCustomerId: row.stripeCustomerId || undefined,
    stripeSubscriptionId: row.stripeSubscriptionId || undefined,
    currentPeriodEnd: row.currentPeriodEnd ? new Date(row.currentPeriodEnd).toISOString() : undefined,
    exportsThisMonth: row.exportsThisMonth,
    lastResetMonth: row.lastResetMonth,
  };
}

export async function incrementExportCount(email: string): Promise<Subscription> {
  const sql = getDB();
  const sub = await getSubscription(email);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const today = new Date().toISOString().slice(0, 10);
  
  // Reset exports if new month
  if (sub.lastResetMonth !== currentMonth) {
    sub.exportsThisMonth = 0;
    sub.lastResetMonth = currentMonth;
  }
  
  // Set first export date if not already set
  if (!sub.firstExportDate) {
    sub.firstExportDate = today;
  }
  
  sub.exportsThisMonth += 1;
  await setSubscription(email, sub);
  
  return sub;
}
