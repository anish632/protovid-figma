import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { retrieveCheckoutSession } from '@/lib/stripe';
import { setSubscription } from '@/lib/storage';
import { checkoutSessionConfirmationSchema, sanitizeError } from '@/lib/validation';

function getDB() {
  if (!process.env.NEON_DATABASE_URL) {
    throw new Error('Database not configured');
  }
  return neon(process.env.NEON_DATABASE_URL);
}

async function recordEvent(email: string, eventType: string, metadata: Record<string, unknown> = {}) {
  const sql = getDB();
  await sql`
    INSERT INTO protovid_events (
      email,
      event_type,
      plugin_version,
      metadata,
      created_at
    ) VALUES (
      ${email.toLowerCase().trim()},
      ${eventType},
      ${'stripe_success'},
      ${Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null},
      CURRENT_TIMESTAMP
    )
  `;
}

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

    const email = session.customer_details?.email || session.customer_email || session.metadata?.email;
    if (!email) {
      return NextResponse.json(
        { confirmed: false, error: 'Checkout session has no email' },
        { status: 400 }
      );
    }

    await setSubscription(email, {
      tier: 'pro',
      status: 'active',
      stripeCustomerId: typeof session.customer === 'string' ? session.customer : undefined,
      stripeSubscriptionId: typeof session.subscription === 'string' ? session.subscription : undefined,
    });

    await recordEvent(email, 'subscription_started', {
      source: 'stripe_success_redirect',
      stripe_session_id: session.id,
      stripe_subscription_id: typeof session.subscription === 'string' ? session.subscription : null,
      pricing_variant: session.metadata?.pricing_variant || null,
      price_label: session.metadata?.price_label || null,
      amount_cents: session.metadata?.amount_cents || null,
    });
    await recordEvent(email, 'payment_confirmed', {
      source: 'stripe_success_redirect',
      stripe_session_id: session.id,
      stripe_subscription_id: typeof session.subscription === 'string' ? session.subscription : null,
      pricing_variant: session.metadata?.pricing_variant || null,
      price_label: session.metadata?.price_label || null,
      amount_cents: session.metadata?.amount_cents || null,
    });

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
