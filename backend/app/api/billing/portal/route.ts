import { NextRequest, NextResponse } from 'next/server';
import { getBillingAccessType } from '@/lib/billingAccess';
import {
  BillingManagementTokenError,
  verifyBillingManagementToken,
} from '@/lib/billingManagementToken';
import { createPortalSession } from '@/lib/stripe';
import { getSubscription } from '@/lib/storage';
import { billingManagementRequestSchema, sanitizeError } from '@/lib/validation';

export const runtime = 'nodejs';

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { managementToken } = billingManagementRequestSchema.parse(body);
    const claims = verifyBillingManagementToken(managementToken, { scope: 'portal' });
    const subscription = await getSubscription(claims.email);

    // Bind the bearer capability to the same Stripe customer it was minted
    // for. A token from another account cannot be repurposed by swapping an
    // email in the request body because there is no email in this API.
    if (!subscription.stripeCustomerId || subscription.stripeCustomerId !== claims.customerId) {
      return NextResponse.json({ error: 'Not authorized to manage this account' }, { status: 403 });
    }

    if (!subscription.stripeSubscriptionId) {
      const billingAccessType = getBillingAccessType(subscription);
      return NextResponse.json(
        {
          error: billingAccessType === 'one_time_access'
            ? 'This is a one-time Project Pass. It expires automatically and has no subscription to cancel.'
            : 'No recurring subscription is available to manage.',
          code: billingAccessType === 'one_time_access' ? 'one_time_access' : 'no_subscription',
        },
        { status: 409 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'http://localhost:3000';
    const portalUrl = await createPortalSession(subscription.stripeCustomerId, `${baseUrl}/account`);

    return NextResponse.json({ url: portalUrl });
  } catch (error) {
    if (error instanceof BillingManagementTokenError) {
      return NextResponse.json({ error: 'Not authorized to manage this account' }, { status: 403 });
    }

    console.error('Portal error:', error);
    const status = error instanceof Error && error.name === 'ZodError' ? 400 : 500;
    return NextResponse.json({ error: sanitizeError(error) }, { status });
  }
}
