import { NextRequest, NextResponse } from 'next/server';
import { FREE_TIER_EXPORT_LIMIT, PRO_TIER_EXPORT_LIMIT, isPremiumSubscription } from '@/lib/plans';
import { getSubscription, incrementExportCount } from '@/lib/storage';
import { exportCheckRequestSchema, sanitizeError } from '@/lib/validation';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = exportCheckRequestSchema.parse(body);
    const existing = await getSubscription(email);
    const isPremium = isPremiumSubscription(existing);
    const currentMonth = new Date().toISOString().slice(0, 7);
    const exportsThisMonth = existing.lastResetMonth === currentMonth ? existing.exportsThisMonth : 0;

    if (!isPremium && exportsThisMonth >= FREE_TIER_EXPORT_LIMIT) {
      return NextResponse.json(
        {
          success: false,
          exportsThisMonth,
          limit: FREE_TIER_EXPORT_LIMIT,
          error: 'Free export limit reached',
        },
        { status: 403, headers: corsHeaders }
      );
    }

    const subscription = await incrementExportCount(email);

    return NextResponse.json(
      {
        success: true,
        exportsThisMonth: subscription.exportsThisMonth,
        limit: isPremiumSubscription(subscription) ? PRO_TIER_EXPORT_LIMIT : FREE_TIER_EXPORT_LIMIT,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('Export increment error:', error);
    const status = error instanceof Error && error.name === 'ZodError' ? 400 : 500;
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status, headers: corsHeaders }
    );
  }
}
