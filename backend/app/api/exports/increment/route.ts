import { NextRequest, NextResponse } from 'next/server';
import { buildEntitlementResponse } from '@/lib/entitlement';
import { FREE_TIER_EXPORT_LIMIT, isPremiumSubscription } from '@/lib/plans';
import { getSubscription, incrementExportCount } from '@/lib/storage';
import { exportCheckRequestSchema, sanitizeError } from '@/lib/validation';
import { pluginCorsHeaders } from '@/lib/cors';
import { getBillingAccessType } from '@/lib/billingAccess';

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200, headers: pluginCorsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, userId } = exportCheckRequestSchema.parse(body);
    const exportUserId = email || userId!;
    const existing = await getSubscription(exportUserId);
    const isPremium = isPremiumSubscription(existing);
    const currentMonth = new Date().toISOString().slice(0, 7);
    const exportsThisMonth = existing.lastResetMonth === currentMonth ? existing.exportsThisMonth : 0;

    if (isPremium) {
      const entitlement = buildEntitlementResponse(exportUserId, existing);
      return NextResponse.json(
        {
          success: true,
          ...entitlement,
          billingAccessKind: getBillingAccessType(existing),
          currentPeriodEnd: existing.currentPeriodEnd || null,
          exportsThisMonth: entitlement.freeExportsUsed,
          limit: entitlement.freeExportsLimit,
        },
        { headers: pluginCorsHeaders }
      );
    }

    if (!isPremium && exportsThisMonth >= FREE_TIER_EXPORT_LIMIT) {
      const entitlement = buildEntitlementResponse(exportUserId, {
        ...existing,
        exportsThisMonth,
        lastResetMonth: currentMonth,
      });
      return NextResponse.json(
        {
          success: false,
          ...entitlement,
          billingAccessKind: getBillingAccessType(existing),
          currentPeriodEnd: existing.currentPeriodEnd || null,
          exportsThisMonth,
          limit: FREE_TIER_EXPORT_LIMIT,
          error: 'Free export limit reached',
        },
        { status: 403, headers: pluginCorsHeaders }
      );
    }

    const subscription = await incrementExportCount(exportUserId);
    const entitlement = buildEntitlementResponse(exportUserId, subscription);

    return NextResponse.json(
      {
        success: true,
        ...entitlement,
        billingAccessKind: getBillingAccessType(subscription),
        currentPeriodEnd: subscription.currentPeriodEnd || null,
        exportsThisMonth: entitlement.freeExportsUsed,
        limit: entitlement.freeExportsLimit,
      },
      { headers: pluginCorsHeaders }
    );
  } catch (error) {
    console.error('Export increment error:', error);
    const status = error instanceof Error && error.name === 'ZodError' ? 400 : 500;
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status, headers: pluginCorsHeaders }
    );
  }
}
