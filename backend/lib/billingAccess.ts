import { isPremiumSubscription } from './plans';
import type { Subscription } from './storage';

/**
 * The stored entitlement alone does not say whether it renews. A Stripe
 * subscription ID is the durable distinction: recurring subscriptions have
 * one; a Project Pass (and a manual, fixed-term grant) deliberately does
 * not. Keep that distinction in one place so a pass never exposes a
 * cancellation path.
 */
export type BillingAccessType = 'subscription' | 'one_time_access' | 'none';

export function getBillingAccessType(subscription: Subscription): BillingAccessType {
  if (!isPremiumSubscription(subscription)) {
    return 'none';
  }

  return subscription.stripeSubscriptionId
    ? 'subscription'
    : 'one_time_access';
}

/**
 * Paid access, including an already-scheduled cancellation, must not create
 * another Checkout session. The customer can keep using the current access
 * until it expires and then subscribe again if they choose.
 */
export function hasActivePaidEntitlement(subscription: Subscription): boolean {
  return getBillingAccessType(subscription) !== 'none';
}
