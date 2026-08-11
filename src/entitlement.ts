export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'none';
export type BillingAccessKind = 'subscription' | 'one_time_access' | 'none';

export interface EntitlementResponse {
  userId: string;
  billingPeriodKey: string;
  subscriptionStatus: SubscriptionStatus;
  isPaid: boolean;
  freeExportsLimit: number;
  freeExportsUsed: number;
  freeExportsRemaining: number;
  watermarkRequired: boolean;
  canExport: boolean;
  upgradeRequired: boolean;
  billingAccessKind?: BillingAccessKind;
  currentPeriodEnd?: string | null;
}

export const ENTITLEMENT_VERIFICATION_ERROR = "Couldn't verify export allowance. Please try again.";

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function normalizeEntitlementResponse(input: unknown): EntitlementResponse | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Partial<EntitlementResponse>;

  if (
    typeof value.userId !== 'string' ||
    typeof value.billingPeriodKey !== 'string' ||
    typeof value.subscriptionStatus !== 'string' ||
    typeof value.isPaid !== 'boolean' ||
    !isFiniteNumber(value.freeExportsLimit) ||
    !isFiniteNumber(value.freeExportsUsed) ||
    !isFiniteNumber(value.freeExportsRemaining) ||
    typeof value.watermarkRequired !== 'boolean' ||
    typeof value.canExport !== 'boolean' ||
    typeof value.upgradeRequired !== 'boolean'
  ) {
    return null;
  }

  return {
    userId: value.userId,
    billingPeriodKey: value.billingPeriodKey,
    subscriptionStatus: value.subscriptionStatus as SubscriptionStatus,
    isPaid: value.isPaid,
    freeExportsLimit: value.freeExportsLimit,
    freeExportsUsed: value.freeExportsUsed,
    freeExportsRemaining: value.freeExportsRemaining,
    watermarkRequired: value.watermarkRequired,
    canExport: value.canExport,
    upgradeRequired: value.upgradeRequired,
    billingAccessKind: value.billingAccessKind === 'subscription' || value.billingAccessKind === 'one_time_access'
      ? value.billingAccessKind
      : value.isPaid ? 'subscription' : 'none',
    currentPeriodEnd: typeof value.currentPeriodEnd === 'string' ? value.currentPeriodEnd : null,
  };
}

export function formatQuotaText(entitlement: EntitlementResponse): string {
  if (entitlement.isPaid) {
    return 'Unlimited exports included';
  }

  if (entitlement.freeExportsRemaining <= 0) {
    return 'No free exports remaining this month';
  }

  const exportWord = pluralize(entitlement.freeExportsRemaining, 'export');
  return `${entitlement.freeExportsRemaining} free ${exportWord} remaining this month`;
}

export function formatFreeLimitHeadline(entitlement: EntitlementResponse): string {
  if (entitlement.freeExportsLimit <= 1) {
    return `You've used your ${entitlement.freeExportsLimit} free export this month`;
  }

  return `You've used all ${entitlement.freeExportsLimit} free exports this month`;
}
