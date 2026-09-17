import { NextRequest, NextResponse } from 'next/server';
import { buildEntitlementResponse } from '@/lib/entitlement';
import { FREE_TIER_EXPORT_LIMIT, isPremiumSubscription } from '@/lib/plans';
import { consumeFreeExport, getSubscription } from '@/lib/storage';
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

    const subscription = await consumeFreeExport(exportUserId, FREE_TIER_EXPORT_LIMIT);
    if (!subscription) {
      // The account may have become paid between the initial entitlement read
      // and quota consumption. Re-read before returning a paywall response.
      const latest = await getSubscription(exportUserId);
      if (isPremiumSubscription(latest)) {
        const entitlement = buildEntitlementResponse(exportUserId, latest);
        return NextResponse.json(
          {
            success: true,
            ...entitlement,
            billingAccessKind: getBillingAccessType(latest),
            currentPeriodEnd: latest.currentPeriodEnd || null,
            exportsThisMonth: entitlement.freeExportsUsed,
            limit: entitlement.freeExportsLimit,
          },
          { headers: pluginCorsHeaders }
        );
      }

      const effectiveExports = latest.lastResetMonth === currentMonth
        ? latest.exportsThisMonth
        : 0;
      const entitlement = buildEntitlementResponse(exportUserId, {
        ...latest,
        exportsThisMonth: effectiveExports,
        lastResetMonth: currentMonth,
      });
      return NextResponse.json(
        {
          success: false,
          ...entitlement,
          billingAccessKind: getBillingAccessType(latest),
          currentPeriodEnd: latest.currentPeriodEnd || null,
          exportsThisMonth: effectiveExports,
          limit: FREE_TIER_EXPORT_LIMIT,
          error: 'Free export limit reached',
        },
        { status: 403, headers: pluginCorsHeaders }
      );
    }

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
