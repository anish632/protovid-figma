import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession } from '@/lib/stripe';
import { checkoutRequestSchema, sanitizeError } from '@/lib/validation';

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, plan } = checkoutRequestSchema.parse(body);

    // Support monthly ($8/mo) and yearly ($29/yr) plans
    const monthlyPriceId = process.env.PROTOVID_PRICE_ID?.trim();
    const yearlyPriceId = process.env.PROTOVID_YEARLY_PRICE_ID?.trim();

    const priceId = plan === 'yearly' ? yearlyPriceId : monthlyPriceId;
    if (!priceId) {
      return NextResponse.json({ error: `${plan || 'monthly'} billing not configured` }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'http://localhost:3000';
    const checkoutUrl = await createCheckoutSession({
      priceId,
      customerEmail: email,
      successUrl: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/pricing?canceled=true`,
    });

    return NextResponse.json({ url: checkoutUrl });
  } catch (error) {
    console.error('Checkout error:', error);
    const status = error instanceof Error && error.name === 'ZodError' ? 400 : 500;
    return NextResponse.json({ error: sanitizeError(error) }, { status });
  }
}
