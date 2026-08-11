import { NextRequest, NextResponse } from 'next/server';
import { recordEvent } from '@/lib/events';
import {
  getLargeFlowPassForEnvironment,
  getOfferExperimentAssignment,
  getPricingVariantForEnvironment,
} from '@/lib/pricingExperiment';
import { pluginCorsHeaders } from '@/lib/cors';
import { pricingVariantRequestSchema, sanitizeError } from '@/lib/validation';

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200, headers: pluginCorsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, anonymousId } = pricingVariantRequestSchema.parse(body);
    const selectedPlan = 'monthly';
    const pricing = getPricingVariantForEnvironment(email || 'anonymous@protovid.local', selectedPlan);
    const largeFlowPass = getLargeFlowPassForEnvironment();
    const offerExperiment = getOfferExperimentAssignment(
      anonymousId || email || 'anonymous',
      Boolean(largeFlowPass),
    );

    await recordEvent(email || null, 'pricing_variant_assigned', {
      source: 'paywall',
      plan: selectedPlan,
      pricingVariant: pricing.id,
      priceLabel: pricing.label,
      amountCents: pricing.amountCents,
      offer_experiment_id: offerExperiment.id,
      offer_experiment_variant: offerExperiment.variant,
      primary_offer: offerExperiment.primaryOffer,
      ...(anonymousId ? { anonymousId } : {}),
    });

    return NextResponse.json(
      {
        plan: selectedPlan,
        pricingVariant: pricing.id,
        priceLabel: pricing.label,
        amountCents: pricing.amountCents,
        offerExperiment,
        largeFlowPass: largeFlowPass
          ? {
              available: true,
              priceLabel: largeFlowPass.label,
              amountCents: largeFlowPass.amountCents,
              accessDays: largeFlowPass.accessDays,
            }
          : {
              available: false,
              priceLabel: '',
              amountCents: 0,
              accessDays: 0,
            },
      },
      { headers: pluginCorsHeaders }
    );
  } catch (error) {
    console.error('Pricing variant error:', error);
    const status = error instanceof Error && error.name === 'ZodError' ? 400 : 500;
    return NextResponse.json({ error: sanitizeError(error) }, { status, headers: pluginCorsHeaders });
  }
}
