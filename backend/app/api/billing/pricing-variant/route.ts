import { NextRequest, NextResponse } from 'next/server';
import { recordEvent } from '@/lib/events';
import { getPricingVariantForEnvironment } from '@/lib/pricingExperiment';
import { pluginCorsHeaders } from '@/lib/cors';
import { checkoutRequestSchema, sanitizeError } from '@/lib/validation';

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200, headers: pluginCorsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = checkoutRequestSchema.parse(body);
    const selectedPlan = 'monthly';
    const pricing = getPricingVariantForEnvironment(email, selectedPlan);

    await recordEvent(email, 'pricing_variant_assigned', {
      source: 'paywall',
      plan: selectedPlan,
      pricingVariant: pricing.id,
      priceLabel: pricing.label,
      amountCents: pricing.amountCents,
    });

    return NextResponse.json(
      {
        plan: selectedPlan,
        pricingVariant: pricing.id,
        priceLabel: pricing.label,
        amountCents: pricing.amountCents,
      },
      { headers: pluginCorsHeaders }
    );
  } catch (error) {
    console.error('Pricing variant error:', error);
    const status = error instanceof Error && error.name === 'ZodError' ? 400 : 500;
    return NextResponse.json({ error: sanitizeError(error) }, { status, headers: pluginCorsHeaders });
  }
}
