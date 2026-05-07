function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt((value || '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const FREE_TIER_EXPORT_LIMIT = parsePositiveInteger(
  process.env.PROTOVID_FREE_EXPORT_LIMIT,
  1
);

export const PRO_TIER_EXPORT_LIMIT = 999;

export function isPremiumSubscription(input: {
  tier: 'free' | 'pro';
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
}): boolean {
  return input.tier === 'pro' && ['active', 'trialing'].includes(input.status);
}

export function getFreeExportsRemaining(exportsThisMonth: number): number {
  return Math.max(0, FREE_TIER_EXPORT_LIMIT - exportsThisMonth);
}
