import { NextRequest, NextResponse } from 'next/server';
import { getBillingAccessType } from '@/lib/billingAccess';
import {
  BillingManagementTokenError,
  verifyBillingManagementToken,
} from '@/lib/billingManagementToken';
import { recordEvent } from '@/lib/events';
import { getStripe } from '@/lib/stripe';
import { getSubscription, setSubscription } from '@/lib/storage';
import { billingManagementRequestSchema, sanitizeError } from '@/lib/validation';

export const runtime = 'nodejs';

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}

function getStripeCustomerId(customer: unknown): string | null {
  if (typeof customer === 'string') return customer;
  if (customer && typeof customer === 'object' && 'id' in customer && typeof customer.id === 'string') {
    return customer.id;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { managementToken } = billingManagementRequestSchema.parse(body);
    const claims = verifyBillingManagementToken(managementToken, { scope: 'cancel' });
    const subscription = await getSubscription(claims.email);

    if (!subscription.stripeCustomerId || subscription.stripeCustomerId !== claims.customerId) {
      return NextResponse.json({ error: 'Not authorized to manage this account' }, { status: 403 });
    }

    if (!subscription.stripeSubscriptionId) {
      const billingAccessType = getBillingAccessType(subscription);
      return NextResponse.json(
        {
          error: billingAccessType === 'one_time_access'
            ? 'This is a one-time Project Pass. It expires automatically and cannot be cancelled.'
            : 'No recurring subscription is available to cancel.',
          code: billingAccessType === 'one_time_access' ? 'one_time_access' : 'no_subscription',
        },
        { status: 409 }
      );
    }

    const stripe = getStripe();
    const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
    const stripeCustomerId = getStripeCustomerId(stripeSubscription.customer);
    if (!stripeCustomerId || stripeCustomerId !== claims.customerId) {
      return NextResponse.json({ error: 'Not authorized to manage this account' }, { status: 403 });
    }

    if (stripeSubscription.status === 'canceled') {
      return NextResponse.json(
        { error: 'This subscription is already cancelled.' },
        { status: 409 }
      );
    }

    // Stripe is authoritative. Do not downgrade local access until Stripe has
    // accepted the change; keeping the customer Pro through period end matches
    // the charge they already paid for and lets the webhook reconcile expiry.
    const updatedStripeSubscription = await stripe.subscriptions.update(
      stripeSubscription.id,
      { cancel_at_period_end: true }
    );
    const periodEnd = (updatedStripeSubscription as any).current_period_end;
    const remainsEntitled = ['active', 'trialing'].includes(updatedStripeSubscription.status);

    await setSubscription(claims.email, {
      tier: remainsEntitled ? 'pro' : 'free',
      status: updatedStripeSubscription.status as 'active' | 'trialing' | 'past_due' | 'canceled',
      stripeCustomerId,
      stripeSubscriptionId: updatedStripeSubscription.id,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : subscription.currentPeriodEnd,
    });

    try {
      await recordEvent(claims.email, 'subscription_cancellation_scheduled', {
        source: 'user_initiated',
        stripe_subscription_id: updatedStripeSubscription.id,
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        cancel_at_period_end: updatedStripeSubscription.cancel_at_period_end,
      });
    } catch (eventError) {
      // The Stripe change has succeeded. Never tell the customer it failed
      // just because telemetry could not be written.
      console.warn('Could not record scheduled cancellation event:', eventError);
    }

    return NextResponse.json({
      success: true,
      cancellationScheduled: true,
      accessEndsAt: periodEnd ? new Date(periodEnd * 1000).toISOString() : subscription.currentPeriodEnd || null,
      message: 'Your subscription will remain active until the end of the current billing period. No further renewal will occur.',
    });
  } catch (error) {
    if (error instanceof BillingManagementTokenError) {
      return NextResponse.json({ error: 'Not authorized to manage this account' }, { status: 403 });
    }

    console.error('Subscription cancellation error:', error);
    const status = error instanceof Error && error.name === 'ZodError' ? 400 : 502;
    return NextResponse.json(
      { error: status === 400 ? sanitizeError(error) : 'Unable to update your Stripe subscription. Your access has not been changed.' },
      { status }
    );
  }
}
