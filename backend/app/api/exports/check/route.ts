import { NextRequest, NextResponse } from 'next/server';
import { pluginCorsHeaders } from '@/lib/cors';
import { buildEntitlementResponse, getBillingPeriodKey } from '@/lib/entitlement';
import { getSubscription, setSubscription } from '@/lib/storage';
import { exportCheckRequestSchema, sanitizeError } from '@/lib/validation';
import { withRateLimit, generalRateLimit } from '@/lib/rateLimit';
import { getBillingAccessType } from '@/lib/billingAccess';

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200, headers: pluginCorsHeaders });
}

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, userId } = exportCheckRequestSchema.parse(body);
    const exportUserId = email || userId!;
    const subscription = await getSubscription(exportUserId);
    const currentMonth = getBillingPeriodKey();
    const exportsThisMonth = subscription.lastResetMonth === currentMonth ? subscription.exportsThisMonth : 0;

    if (subscription.lastResetMonth !== currentMonth) {
      await setSubscription(exportUserId, {
        exportsThisMonth,
        lastResetMonth: currentMonth,
      });
      subscription.exportsThisMonth = exportsThisMonth;
      subscription.lastResetMonth = currentMonth;
    }

    const entitlement = buildEntitlementResponse(exportUserId, subscription);

    return NextResponse.json(
      {
        ...entitlement,
        exportsThisMonth: entitlement.freeExportsUsed,
        limit: entitlement.freeExportsLimit,
        isPremium: entitlement.isPaid,
        billingAccessKind: getBillingAccessType(subscription),
        currentPeriodEnd: subscription.currentPeriodEnd || null,
        trialExpired: false,
        daysSinceFirstExport: subscription.firstExportDate
          ? Math.floor((new Date().getTime() - new Date(subscription.firstExportDate).getTime()) / (1000 * 60 * 60 * 24))
          : null,
      },
      { headers: pluginCorsHeaders }
    );
  } catch (error) {
    console.error('Export check error:', error);
    return NextResponse.json(
      {
        canExport: false,
        error: sanitizeError(error)
      },
      { status: 500, headers: pluginCorsHeaders }
    );
  }
}

export const POST = withRateLimit(generalRateLimit, handlePOST);
