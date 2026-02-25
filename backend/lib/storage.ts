/**
 * WARNING: In-memory storage — all data is lost on every Vercel cold start or redeploy.
 * Before going to production, replace with a persistent store (Vercel KV, Supabase, etc.).
 */

// In-memory store: email -> subscription data
const subscriptions = new Map<string, {
  email: string;
  tier: 'free' | 'pro';
  status: 'active' | 'canceled' | 'past_due';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: string;
  exportsThisMonth: number;
  lastResetMonth: string;
}>();

export function getSubscription(email: string) {
  const normalized = email.toLowerCase().trim();
  return subscriptions.get(normalized) || {
    email: normalized,
    tier: 'free' as const,
    status: 'active' as const,
    exportsThisMonth: 0,
    lastResetMonth: new Date().toISOString().slice(0, 7), // YYYY-MM
  };
}

export function setSubscription(email: string, data: Partial<ReturnType<typeof getSubscription>>) {
  const normalized = email.toLowerCase().trim();
  const existing = getSubscription(normalized);
  subscriptions.set(normalized, { ...existing, ...data });
}

export function findSubscriptionByCustomerId(customerId: string) {
  for (const [email, sub] of subscriptions.entries()) {
    if (sub.stripeCustomerId === customerId) {
      return { email, ...sub };
    }
  }
  return null;
}

export function findSubscriptionBySubscriptionId(subscriptionId: string) {
  for (const [email, sub] of subscriptions.entries()) {
    if (sub.stripeSubscriptionId === subscriptionId) {
      return { email, ...sub };
    }
  }
  return null;
}

export function incrementExportCount(email: string) {
  const sub = getSubscription(email);
  const currentMonth = new Date().toISOString().slice(0, 7);
  
  if (sub.lastResetMonth !== currentMonth) {
    sub.exportsThisMonth = 0;
    sub.lastResetMonth = currentMonth;
  }
  
  sub.exportsThisMonth += 1;
  setSubscription(email, sub);
  return sub;
}
