import { NextRequest, NextResponse } from 'next/server';
import { getSubscription, setSubscription } from '@/lib/storage';
import { FREE_TIER_EXPORT_LIMIT, PRO_TIER_EXPORT_LIMIT, isPremiumSubscription } from '@/lib/plans';
import { exportCheckRequestSchema, sanitizeError } from '@/lib/validation';
import { withRateLimit, generalRateLimit } from '@/lib/rateLimit';

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = exportCheckRequestSchema.parse(body);
    const subscription = await getSubscription(email);
    const isPremium = isPremiumSubscription(subscription);

    if (isPremium) {
      return NextResponse.json(
        { canExport: true, exportsThisMonth: 0, limit: PRO_TIER_EXPORT_LIMIT, isPremium: true }
      );
    }
    const currentMonth = new Date().toISOString().slice(0, 7);
    const exportsThisMonth = subscription.lastResetMonth === currentMonth ? subscription.exportsThisMonth : 0;

    if (subscription.lastResetMonth !== currentMonth) {
      await setSubscription(email, {
        exportsThisMonth,
        lastResetMonth: currentMonth,
      });
    }

    return NextResponse.json({
      canExport: exportsThisMonth < FREE_TIER_EXPORT_LIMIT,
      exportsThisMonth,
      limit: FREE_TIER_EXPORT_LIMIT,
      isPremium: false,
    });
  } catch (error) {
    console.error('Export check error:', error);
    return NextResponse.json(
      {
        canExport: false,
        exportsThisMonth: FREE_TIER_EXPORT_LIMIT,
        limit: FREE_TIER_EXPORT_LIMIT,
        isPremium: false,
        error: sanitizeError(error)
      },
      { status: 500 }
    );
  }
}

export const POST = withRateLimit(generalRateLimit, handlePOST);
