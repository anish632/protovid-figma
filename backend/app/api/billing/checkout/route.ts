import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession } from '@/lib/stripe';
import { checkoutRequestSchema, sanitizeError } from '@/lib/validation';
import { recordEvent } from '@/lib/events';
import { getLargeFlowPassForEnvironment, getPricingVariantWithPriceId } from '@/lib/pricingExperiment';
import { getBillingAccessType, hasActivePaidEntitlement } from '@/lib/billingAccess';
import { getSubscription } from '@/lib/storage';

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      email,
      plan,
      anonymousId,
      offerExperimentId,
      offerExperimentVariant,
      primaryOffer,
      pricingPageExperimentId,
      pricingPageExperimentVariant,
    } = checkoutRequestSchema.parse(body);
    const selectedPlan = plan === 'large_export'
      ? 'large_export'
      : plan === 'yearly'
        ? 'yearly'
        : 'monthly';
    const existingSubscription = await getSubscription(email);

    if (existingSubscription.stripeSubscriptionId && existingSubscription.status === 'past_due') {
      return NextResponse.json({ error: 'Your existing subscription needs payment. Open billing to resolve it before starting another subscription.',
        code: 'billing_recovery_required', url: `${process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://protovid.dasgroupllc.com'}/account` }, { status: 409 });
    }

    // A paid entitlement includes an active subscription that is already set
    // to end at period close and a fixed-term Project Pass. Starting a
    // second Checkout session here creates duplicate charges and makes the
    // customer's access state ambiguous.
    if (hasActivePaidEntitlement(existingSubscription)) {
      const billingAccessType = getBillingAccessType(existingSubscription);
      try {
        await recordEvent(email, 'checkout_blocked_active_entitlement', {
          source: 'checkout',
          plan: selectedPlan,
          billing_access_type: billingAccessType,
          current_period_end: existingSubscription.currentPeriodEnd || null,
        });
      } catch (eventError) {
        console.warn('Could not record blocked checkout event:', eventError);
      }

      return NextResponse.json(
        {
          error: billingAccessType === 'subscription'
            ? 'You already have an active ProtoVid subscription. Manage it in Stripe instead of starting another checkout.'
            : 'You already have active non-recurring ProtoVid access. It does not need another checkout yet.',
          code: 'active_entitlement',
          billingAccessType,
          currentPeriodEnd: existingSubscription.currentPeriodEnd || null,
        },
        { status: 409 }
      );
    }

    const largeFlowPass = selectedPlan === 'large_export'
      ? getLargeFlowPassForEnvironment()
      : null;
    const pricing = selectedPlan === 'large_export'
      ? largeFlowPass
      : getPricingVariantWithPriceId(email, selectedPlan);

    if (!pricing) {
      return NextResponse.json(
        { error: 'Project Pass is not available yet. Studio is available now.' },
        { status: 409 }
      );
    }

    try {
      await recordEvent(email, 'pricing_variant_assigned', {
      source: 'checkout',
      plan: selectedPlan,
      pricingVariant: pricing.id,
      priceLabel: pricing.label,
      amountCents: pricing.amountCents,
      accessDays: 'accessDays' in pricing ? pricing.accessDays : null,
      offer_experiment_id: offerExperimentId || null,
      offer_experiment_variant: offerExperimentVariant || null,
      primary_offer: primaryOffer || null,
      pricing_page_experiment_id: pricingPageExperimentId || null,
      pricing_page_experiment_variant: pricingPageExperimentVariant || null,
      ...(anonymousId ? { anonymousId } : {}),
    });

    } catch (eventError) {
      console.warn('Could not record pricing assignment:', eventError);
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'http://localhost:3000';
    const checkoutSession = await createCheckoutSession({
      priceId: pricing.priceId,
      expectedPrice: { amountCents: pricing.amountCents, interval: selectedPlan === 'large_export' ? null : selectedPlan === 'yearly' ? 'year' : 'month' },
      customerEmail: email,
      successUrl: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/pricing?canceled=true`,
      mode: selectedPlan === 'large_export' ? 'payment' : 'subscription',
      metadata: {
        pricing_variant: pricing.id,
        price_label: pricing.label,
        amount_cents: String(pricing.amountCents),
        offer_type: selectedPlan === 'large_export' ? 'large_flow_pass' : 'subscription',
        access_days: 'accessDays' in pricing ? String(pricing.accessDays) : '',
        offer_experiment_id: offerExperimentId || '',
        offer_experiment_variant: offerExperimentVariant || '',
        primary_offer: primaryOffer || '',
        pricing_page_experiment_id: pricingPageExperimentId || '',
        pricing_page_experiment_variant: pricingPageExperimentVariant || '',
        trial_enabled: 'false',
        ...(anonymousId ? { anonymousId } : {}),
      },
    });

    try {
      await recordEvent(email, 'checkout_created', {
        source: 'stripe_checkout_api',
        plan: selectedPlan,
        pricing_variant: pricing.id,
        price_label: pricing.label,
        amount_cents: pricing.amountCents,
        offer_type: selectedPlan === 'large_export' ? 'large_flow_pass' : 'subscription',
        access_days: 'accessDays' in pricing ? pricing.accessDays : null,
        offer_experiment_id: offerExperimentId || null,
        offer_experiment_variant: offerExperimentVariant || null,
        primary_offer: primaryOffer || null,
        pricing_page_experiment_id: pricingPageExperimentId || null,
        pricing_page_experiment_variant: pricingPageExperimentVariant || null,
        stripe_checkout_session_id: checkoutSession.id,
        ...(anonymousId ? { anonymousId } : {}),
      });
    } catch (eventError) {
      // The Checkout session is already valid. Do not make a customer retry it
      // (and risk a duplicate session) because analytics storage is degraded.
      console.warn('Could not record checkout created event:', eventError);
    }

    return NextResponse.json({
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
      pricingVariant: pricing.id,
      priceLabel: pricing.label,
      amountCents: pricing.amountCents,
      offerType: selectedPlan === 'large_export' ? 'large_flow_pass' : 'subscription',
      accessDays: 'accessDays' in pricing ? pricing.accessDays : null,
    });
  } catch (error) {
    console.error('Checkout error:', error);
    const status = error instanceof Error && error.name === 'ZodError' ? 400 : 500;
    return NextResponse.json({ error: sanitizeError(error) }, { status });
  }
}
