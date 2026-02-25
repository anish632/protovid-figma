import { NextRequest, NextResponse } from 'next/server';
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

    // Development mode - accept test keys (keep for backward compatibility)
    if (licenseKey.startsWith('DEV_') || licenseKey.startsWith('PREMIUM_')) {
      return NextResponse.json({
        valid: true,
        status: 'active',
        tier: 'pro',
        customerName: 'Development User',
        expiresAt: '2099-12-31',
        exportsRemaining: 999,
      });
    }

    // Production: Treat license key as email and check Stripe subscription
    // This allows seamless migration - users enter their email as their "license key"
    const email = licenseKey.toLowerCase().trim();
    
    // Basic email validation
    if (!email.includes('@')) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Please use your email address as your license key'
      });
    }

    const subscription = getSubscription(email);

    // Check if user has active pro subscription
    const isActive = subscription.tier === 'pro' && 
                     ['active', 'trialing'].includes(subscription.status);

    if (isActive) {
      return NextResponse.json({
        valid: true,
        status: subscription.status,
        tier: subscription.tier,
        customerName: email,
        expiresAt: subscription.currentPeriodEnd,
        exportsRemaining: subscription.tier === 'pro' ? 999 : Math.max(0, 3 - subscription.exportsThisMonth),
      });
    }

    // Free tier or inactive subscription
    const exportsRemaining = Math.max(0, 3 - subscription.exportsThisMonth);
    
    return NextResponse.json({
      valid: exportsRemaining > 0,
      status: subscription.status,
      tier: subscription.tier,
      customerName: email,
      exportsRemaining,
      message: subscription.tier === 'free' 
        ? `Free tier: ${exportsRemaining} exports remaining this month`
        : 'Subscription inactive',
    });
  } catch (error) {
    console.error('License validation error:', error);
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}
