import { NextRequest, NextResponse } from 'next/server';
import { getSubscription, setSubscription } from '@/lib/storage';
import { getStripe } from '@/lib/stripe';
import { recordEvent } from '@/lib/events';

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}

export async function POST(request: NextRequest) {
  try {
    const { email, adminKey } = await request.json();

    // Validate required parameters
    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    // Validate admin key for security (prevent unauthorized cancellations)
    const expectedAdminKey = process.env.PROTOVID_ADMIN_KEY?.trim();
    if (!expectedAdminKey || adminKey !== expectedAdminKey) {
      return NextResponse.json({ error: 'Unauthorized - admin key required' }, { status: 403 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const subscription = await getSubscription(normalizedEmail);

    // Check if user has an active trial subscription
    if (subscription.tier !== 'pro' || subscription.status !== 'trialing') {
      return NextResponse.json({ 
        error: 'No active trial subscription found for this email',
        currentStatus: { tier: subscription.tier, status: subscription.status }
      }, { status: 400 });
    }

    // If user has a Stripe subscription, cancel it in Stripe first
    if (subscription.stripeSubscriptionId) {
      try {
        const stripe = getStripe();
        await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
      } catch (stripeError) {
        console.error('Error cancelling Stripe subscription:', stripeError);
        // Continue with database cancellation even if Stripe fails
      }
    }

    // Update subscription status in database
    await setSubscription(normalizedEmail, {
      tier: 'free',
      status: 'canceled',
      stripeSubscriptionId: undefined,
      currentPeriodEnd: undefined,
    });

    // Record the cancellation event
    await recordEvent(normalizedEmail, 'trial_cancelled_manually', {
      source: 'support_request',
      previous_tier: 'pro',
      previous_status: 'trialing',
    });

    return NextResponse.json({
      success: true,
      message: `Trial subscription for ${normalizedEmail} has been successfully cancelled`,
      email: normalizedEmail,
      previousStatus: { tier: 'pro', status: 'trialing' },
      newStatus: { tier: 'free', status: 'canceled' },
    });
  } catch (error) {
    console.error('Manual trial cancellation error:', error);
    return NextResponse.json({ 
      error: 'Failed to cancel trial subscription',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}