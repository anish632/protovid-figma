import { NextRequest, NextResponse } from 'next/server';
import { FREE_TIER_EXPORT_LIMIT, PRO_TIER_EXPORT_LIMIT, getFreeExportsRemaining, isPremiumSubscription } from '@/lib/plans';
import { getSubscription } from '@/lib/storage';

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}

export async function POST(request: NextRequest) {
  try {
    const { licenseKey } = await request.json();

    if (!licenseKey) {
      return NextResponse.json({ valid: false }, { status: 400 });
    }

    // Development mode: accept test keys only in non-production.
    if (process.env.NODE_ENV !== 'production' && (licenseKey.startsWith('DEV_') || licenseKey.startsWith('PREMIUM_'))) {
      return NextResponse.json({
        valid: true,
        status: 'active',
        tier: 'pro',
        customerName: 'Development User',
        expiresAt: '2099-12-31',
        exportsRemaining: 999,
      });
    }

    // Production: treat the legacy "licenseKey" field as the user's email and
    // check Stripe-backed subscription status.
    const email = licenseKey.toLowerCase().trim();
    
    // Basic email validation
    if (!email.includes('@')) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Please use your email address'
      });
    }

    const subscription = await getSubscription(email);

    // Check if user has active pro subscription
    const isActive = isPremiumSubscription(subscription);

    if (isActive) {
      return NextResponse.json({
        valid: true,
        isPremium: true,
        canExport: true,
        status: subscription.status,
        tier: subscription.tier,
        customerName: email,
        expiresAt: subscription.currentPeriodEnd,
        exportsRemaining: PRO_TIER_EXPORT_LIMIT,
      });
    }

    // Free tier or inactive subscription
    const exportsRemaining = getFreeExportsRemaining(subscription.exportsThisMonth);
    
    return NextResponse.json({
      valid: false,
      isPremium: false,
      canExport: exportsRemaining > 0,
      status: subscription.status,
      tier: subscription.tier,
      customerName: email,
      exportsRemaining,
      freeLimit: FREE_TIER_EXPORT_LIMIT,
      message: subscription.tier === 'free' 
        ? `Free tier: ${exportsRemaining} exports remaining this month`
        : 'Subscription inactive',
    });
  } catch (error) {
    console.error('License validation error:', error);
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}
