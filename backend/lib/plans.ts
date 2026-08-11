function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt((value || '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const FREE_TIER_EXPORT_LIMIT = parsePositiveInteger(
  process.env.PROTOVID_FREE_EXPORT_LIMIT,
  3
);

export const PRO_PRICE_MONTHLY_DISPLAY = '$5/mo';
export const PRO_PRICE_MONTHLY_CENTS = 500;
// Legacy constant names remain because existing Checkout sessions and plugin
// builds use `large_flow_pass` internally. The offer customers see is the
// job-based Project Pass.
export const LARGE_FLOW_PASS_DISPLAY = '$4 once';
export const LARGE_FLOW_PASS_CENTS = 400;
export const LARGE_FLOW_PASS_ACCESS_DAYS = 7;
export const FREE_RESOLUTION = '720p';
export const PRO_RESOLUTIONS = ['1080p', '4K'] as const;

export const PRO_TIER_EXPORT_LIMIT = 999;

export function isPremiumSubscription(input: {
  tier: 'free' | 'pro';
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  currentPeriodEnd?: string;
  stripeSubscriptionId?: string;
}): boolean {
  // Must be Pro tier and active/trialing status
  if (input.tier !== 'pro' || !['active', 'trialing'].includes(input.status)) {
    return false;
  }

  // If it's a manual grant (no Stripe subscription), check expiration
  if (!input.stripeSubscriptionId && input.currentPeriodEnd) {
    const endDate = new Date(input.currentPeriodEnd);
    const now = new Date();
    return endDate > now; // Only valid if not expired
  }

  // For Stripe subscriptions, trust the status
  return true;
}

export function getFreeExportsRemaining(exportsThisMonth: number): number {
  return Math.max(0, FREE_TIER_EXPORT_LIMIT - exportsThisMonth);
}
