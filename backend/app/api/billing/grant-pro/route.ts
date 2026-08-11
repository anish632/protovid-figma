import { NextRequest, NextResponse } from 'next/server';
import { getSubscription, setSubscription } from '@/lib/storage';
import { recordEvent } from '@/lib/events';

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}

export async function POST(request: NextRequest) {
  try {
    const { email, months, adminKey, reason = 'manual_grant' } = await request.json();

    // Validate required parameters
    if (!email || !months || !adminKey) {
      return NextResponse.json({ 
        error: 'Email, months, and adminKey required' 
      }, { status: 400 });
    }

    // Validate admin key for security
    const expectedAdminKey = process.env.PROTOVID_ADMIN_KEY?.trim();
    if (!expectedAdminKey || adminKey !== expectedAdminKey) {
      return NextResponse.json({ 
        error: 'Unauthorized - admin key required' 
      }, { status: 403 });
    }

    // Validate months
    if (isNaN(months) || months < 1 || months > 12) {
      return NextResponse.json({ 
        error: 'Months must be a number between 1 and 12' 
      }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const subscription = await getSubscription(normalizedEmail);

    // Calculate end date (months from now)
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + months);

    const previousTier = subscription.tier;
    const previousStatus = subscription.status;

    // Update subscription to Pro with specific end date
    await setSubscription(normalizedEmail, {
      tier: 'pro',
      status: 'active',
      currentPeriodEnd: endDate.toISOString(),
      // Don't set Stripe IDs since this is a manual grant
      stripeSubscriptionId: undefined,
      stripeCustomerId: undefined,
    });

    // Record the grant event
    await recordEvent(normalizedEmail, 'free_pro_granted', {
      source: 'api_grant',
      months_granted: months,
      granted_by: 'support',
      end_date: endDate.toISOString().slice(0, 10),
      previous_tier: previousTier,
      previous_status: previousStatus,
      reason: reason
    });

    return NextResponse.json({
      success: true,
      message: `${months} months free Pro access granted for ${normalizedEmail}`,
      email: normalizedEmail,
      endDate: endDate.toISOString().slice(0, 10),
      previousStatus: { tier: previousTier, status: previousStatus },
      newStatus: { tier: 'pro', status: 'active' },
    });

  } catch (error) {
    console.error('Grant Pro access error:', error);
    return NextResponse.json({ 
      error: 'Failed to grant Pro access',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}