import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession } from '@/lib/stripe';
import { checkoutRequestSchema, sanitizeError } from '@/lib/validation';
import { recordEvent } from '@/lib/events';
import { getPricingVariantWithPriceId } from '@/lib/pricingExperiment';

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, plan } = checkoutRequestSchema.parse(body);
    const selectedPlan = plan || 'monthly';
    const pricing = getPricingVariantWithPriceId(email, selectedPlan);

    await recordEvent(email, 'pricing_variant_assigned', {
      source: 'checkout',
      plan: selectedPlan,
      pricingVariant: pricing.id,
      priceLabel: pricing.label,
      amountCents: pricing.amountCents,
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'http://localhost:3000';
    const checkoutUrl = await createCheckoutSession({
      priceId: pricing.priceId,
      customerEmail: email,
      successUrl: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/pricing?canceled=true`,
      metadata: {
        pricing_variant: pricing.id,
        price_label: pricing.label,
        amount_cents: String(pricing.amountCents),
      },
    });

    return NextResponse.json({
      url: checkoutUrl,
      pricingVariant: pricing.id,
      priceLabel: pricing.label,
      amountCents: pricing.amountCents,
    });
  } catch (error) {
    console.error('Checkout error:', error);
    const status = error instanceof Error && error.name === 'ZodError' ? 400 : 500;
    return NextResponse.json({ error: sanitizeError(error) }, { status });
  }
}
