import { NextRequest, NextResponse } from 'next/server';
import {
  BillingManagementTokenError,
  verifyBillingManagementToken,
} from '@/lib/billingManagementToken';
import { createPortalSession } from '@/lib/stripe';
import { getSubscription } from '@/lib/storage';

export const runtime = 'nodejs';

function errorPage(message: string, status = 400): NextResponse {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><title>ProtoVid account</title></head><body><main style="font-family:system-ui,sans-serif;max-width:560px;margin:72px auto;padding:0 24px"><h1>We could not open account management</h1><p>${message}</p><p><a href="mailto:support@protovid.app">Contact ProtoVid support</a></p></main></body></html>`,
    {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Referrer-Policy': 'no-referrer',
      },
    }
  );
}

export async function GET(request: NextRequest) {
  try {
    const managementToken = request.nextUrl.searchParams.get('token');
    if (!managementToken) {
      return errorPage('This secure link is missing its authorization token. Request a new one from ProtoVid.');
    }

    const claims = verifyBillingManagementToken(managementToken, { scope: 'portal' });
    const subscription = await getSubscription(claims.email);

    if (
      !subscription.stripeCustomerId ||
      subscription.stripeCustomerId !== claims.customerId ||
      !subscription.stripeSubscriptionId
    ) {
      return errorPage('This account no longer has a recurring subscription to manage.', 409);
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'http://localhost:3000';
    const portalUrl = await createPortalSession(subscription.stripeCustomerId, `${baseUrl}/account`);
    const response = NextResponse.redirect(portalUrl);
    response.headers.set('Referrer-Policy', 'no-referrer');
    return response;
  } catch (error) {
    if (error instanceof BillingManagementTokenError) {
      return errorPage('This secure link is invalid or has expired. Request a new link from ProtoVid.');
    }

    console.error('Billing management link redemption error:', error);
    return errorPage('Please try again or contact ProtoVid support.', 502);
  }
}
