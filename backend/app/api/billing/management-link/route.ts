import { NextRequest, NextResponse } from 'next/server';
import { getBillingManagementEmailConfig, getBillingSupportEmail, sendBillingManagementLink } from '@/lib/billingManagementEmail';
import { issueBillingManagementToken } from '@/lib/billingManagementToken';
import { recordEvent } from '@/lib/events';
import { authRateLimit, withRateLimit } from '@/lib/rateLimit';
import { getSubscription } from '@/lib/storage';
import { emailSchema, sanitizeError } from '@/lib/validation';

export const runtime = 'nodejs';

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = emailSchema.parse(body.email);
    const emailConfig = getBillingManagementEmailConfig();

    if (!emailConfig) {
      return NextResponse.json(
        {
          error: 'Secure account links are not configured yet. Please contact support to manage your subscription.',
          supportEmail: getBillingSupportEmail(),
        },
        { status: 503 }
      );
    }

    const subscription = await getSubscription(email);
    if (subscription.stripeCustomerId && subscription.stripeSubscriptionId) {
      // Email possession is the proof for customers who purchased before the
      // plugin began saving a completed Checkout session ID. The token itself
      // is never returned to this request, which keeps email-only requests
      // from becoming portal or cancellation authorization.
      const { token } = issueBillingManagementToken({
        email,
        customerId: subscription.stripeCustomerId,
        scopes: ['portal'],
        ttlSeconds: 15 * 60,
      });

      await sendBillingManagementLink({
        email,
        managementToken: token,
        config: emailConfig,
      });

      try {
        await recordEvent(email, 'billing_management_link_requested', {
          source: 'email_magic_link',
        });
      } catch (eventError) {
        console.warn('Could not record billing management link event:', eventError);
      }
    }

    // Keep the response identical for unknown emails and non-recurring access
    // to avoid turning this endpoint into an account-enumeration oracle.
    return NextResponse.json({
      requested: true,
      message: 'If a recurring ProtoVid subscription uses that email, we sent a secure management link.',
    });
  } catch (error) {
    console.error('Billing management link error:', error);
    const status = error instanceof Error && error.name === 'ZodError' ? 400 : 502;
    return NextResponse.json(
      { error: status === 400 ? sanitizeError(error) : 'Unable to send a secure management link. Please try again or contact support.' },
      { status }
    );
  }
}

export const POST = withRateLimit(authRateLimit, handlePOST);
