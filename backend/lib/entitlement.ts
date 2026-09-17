import {
  FREE_TIER_EXPERIMENT_ID,
  FREE_TIER_EXPORT_LIMIT,
  isPremiumSubscription,
} from './plans';
import { getBillingNotice, type BillingNotice } from './billingNotice';
import type { Subscription } from './storage';

export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'none';

export interface EntitlementResponse {
  userId: string;
  billingPeriodKey: string;
  subscriptionStatus: SubscriptionStatus;
  isPaid: boolean;
  freeTierExperimentId: string;
  freeExportsLimit: number;
  freeExportsUsed: number;
  freeExportsRemaining: number;
  watermarkRequired: boolean;
  canExport: boolean;
  upgradeRequired: boolean;
  billingNotice: BillingNotice | null;
}

export function getBillingPeriodKey(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

export function buildEntitlementResponse(
  userId: string,
  subscription: Subscription,
  date = new Date()
): EntitlementResponse {
  const billingPeriodKey = getBillingPeriodKey(date);
  const isPaid = isPremiumSubscription(subscription, date);
  const subscriptionStatus: SubscriptionStatus = subscription.stripeSubscriptionId || subscription.tier === 'pro'
    ? subscription.status
    : 'none';
  const freeExportsUsed = isPaid || subscription.lastResetMonth !== billingPeriodKey
    ? 0
    : subscription.exportsThisMonth;
  const freeExportsRemaining = isPaid
    ? 0
    : Math.max(0, FREE_TIER_EXPORT_LIMIT - freeExportsUsed);
  const canExport = isPaid || freeExportsRemaining > 0;
  const upgradeRequired = !isPaid && freeExportsRemaining <= 0;

  return {
    userId,
    billingNotice: getBillingNotice(subscription.status, subscription.billingState, date),
    billingPeriodKey,
    subscriptionStatus,
    isPaid,
    freeTierExperimentId: FREE_TIER_EXPERIMENT_ID,
    freeExportsLimit: FREE_TIER_EXPORT_LIMIT,
    freeExportsUsed,
    freeExportsRemaining,
    watermarkRequired: !isPaid && canExport,
    canExport,
    upgradeRequired,
  };
}
