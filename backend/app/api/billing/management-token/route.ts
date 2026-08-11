import { NextRequest, NextResponse } from 'next/server';
import { getCheckoutEmail, getCheckoutSubscriptionUpdate } from '@/lib/checkoutConfirmation';
import { issueBillingManagementToken } from '@/lib/billingManagementToken';
import { recordEvent } from '@/lib/events';
import { retrieveCheckoutSession, retrieveSubscription } from '@/lib/stripe';
import { authRateLimit, withRateLimit } from '@/lib/rateLimit';
import { setSubscription } from '@/lib/storage';
import { checkoutSessionConfirmationSchema, sanitizeError } from '@/lib/validation';

export const runtime = 'nodejs';

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}

/**
 * Exchange a completed Stripe Checkout session for a short-lived, scoped
 * device capability. An email address alone is never enough to mint this
 * token, open a Stripe portal, or cancel an account.
 */
async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = checkoutSessionConfirmationSchema.parse(body);
    const session = await retrieveCheckoutSession(sessionId);

    if (session.status !== 'complete' || session.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'Checkout is not complete yet' },
        { status: 409 }
      );
    }

    if (session.metadata?.offer_type === 'large_flow_pass' || typeof session.subscription !== 'string') {
      return NextResponse.json(
        {
          error: 'Project Passes are one-time purchases and do not have a subscription to manage.',
          code: 'one_time_access',
        },
        { status: 409 }
      );
    }

    const email = getCheckoutEmail(session);
    if (!email) {
      return NextResponse.json({ error: 'Checkout session has no email' }, { status: 400 });
    }

    const stripeSubscription = await retrieveSubscription(session.subscription);
    if (!['active', 'trialing'].includes(stripeSubscription.status)) {
      return NextResponse.json(
        { error: 'This subscription is not active and cannot be managed here.' },
        { status: 409 }
      );
    }

    const customerId = typeof stripeSubscription.customer === 'string'
      ? stripeSubscription.customer
      : typeof session.customer === 'string'
        ? session.customer
        : null;
    if (!customerId) {
      return NextResponse.json({ error: 'Checkout session has no customer' }, { status: 409 });
    }

    const periodEnd = (stripeSubscription as any).current_period_end;
    await setSubscription(email, {
      ...getCheckoutSubscriptionUpdate(session),
      tier: 'pro',
      status: stripeSubscription.status as 'active' | 'trialing',
      stripeCustomerId: customerId,
      stripeSubscriptionId: stripeSubscription.id,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : undefined,
    });

    const { token, expiresAt } = issueBillingManagementToken({ email, customerId });

    try {
      await recordEvent(email, 'billing_management_token_issued', {
        source: 'completed_checkout_exchange',
        stripe_checkout_session_id: session.id,
      });
    } catch (eventError) {
      // The user now has a valid account-management capability. Telemetry
      // degradation should not force them to repeat a completed payment flow.
      console.warn('Could not record management token event:', eventError);
    }

    return NextResponse.json({
      managementToken: token,
      expiresAt,
      billingAccessType: 'subscription',
    });
  } catch (error) {
    console.error('Billing management token error:', error);
    const status = error instanceof Error && error.name === 'ZodError' ? 400 : 500;
    return NextResponse.json({ error: sanitizeError(error) }, { status });
  }
}

export const POST = withRateLimit(authRateLimit, handlePOST);
