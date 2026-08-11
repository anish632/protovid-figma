import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { retrieveCheckoutSession } from '@/lib/stripe';
import { setSubscription } from '@/lib/storage';
import { checkoutSessionConfirmationSchema, sanitizeError } from '@/lib/validation';
import { getCheckoutEmail, getCheckoutSubscriptionUpdate } from '@/lib/checkoutConfirmation';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = checkoutSessionConfirmationSchema.parse(body);
    const session = await retrieveCheckoutSession(sessionId);

    if (session.status !== 'complete' || session.payment_status !== 'paid') {
      return NextResponse.json(
        { confirmed: false, error: 'Checkout is not complete yet' },
        { status: 409 }
      );
    }

    const email = getCheckoutEmail(session);
    if (!email) {
      return NextResponse.json(
        { confirmed: false, error: 'Checkout session has no email' },
        { status: 400 }
      );
    }

    await setSubscription(email, getCheckoutSubscriptionUpdate(session));

    return NextResponse.json({ confirmed: true });
  } catch (error) {
    console.error('Checkout confirmation error:', error);
    const status = error instanceof Error && error.name === 'ZodError' ? 400 : 500;
    return NextResponse.json(
      { confirmed: false, error: sanitizeError(error) },
      { status }
    );
  }
}
