import {
  LARGE_FLOW_PASS_ACCESS_DAYS,
  LARGE_FLOW_PASS_CENTS,
  LARGE_FLOW_PASS_DISPLAY,
  PRO_PRICE_MONTHLY_CENTS,
  PRO_PRICE_MONTHLY_DISPLAY,
  PRO_PRICE_YEARLY_CENTS,
  PRO_PRICE_YEARLY_DISPLAY,
} from './plans';

export type BillingPlan = 'monthly' | 'yearly' | 'large_export';
export type PricingVariantId = 'studio_monthly' | 'studio_yearly';
export type OneTimeOfferId = 'large_flow_pass';
export type OfferExperimentVariant = 'pro_first' | 'project_pass_first';
export type PrimaryOffer = 'monthly' | 'large_export';
export type GoodBetterBestPricingVariant = 'control' | 'good_better_best';

export const OFFER_EXPERIMENT_ID = 'project_pass_primary_v1';
export const GOOD_BETTER_BEST_PRICING_EXPERIMENT_ID = 'good_better_best_pricing_v1';

export interface PricingVariant {
  id: PricingVariantId;
  plan: 'monthly' | 'yearly';
  label: string;
  amountCents: number;
  currency: 'usd';
  priceEnvVars: readonly string[];
}

export const STUDIO_MONTHLY: PricingVariant = {
  id: 'studio_monthly',
  plan: 'monthly',
  label: PRO_PRICE_MONTHLY_DISPLAY,
  amountCents: PRO_PRICE_MONTHLY_CENTS,
  currency: 'usd',
  priceEnvVars: ['PROTOVID_STUDIO_MONTHLY_PRICE_ID', 'PROTOVID_MONTHLY_5_PRICE_ID', 'PROTOVID_PRICE_ID'],
};

export const STUDIO_YEARLY: PricingVariant = {
  id: 'studio_yearly',
  plan: 'yearly',
  label: PRO_PRICE_YEARLY_DISPLAY,
  amountCents: PRO_PRICE_YEARLY_CENTS,
  currency: 'usd',
  priceEnvVars: ['PROTOVID_STUDIO_YEARLY_PRICE_ID'],
};

export interface OneTimeOffer {
  id: OneTimeOfferId;
  plan: 'large_export';
  label: string;
  amountCents: number;
  currency: 'usd';
  accessDays: number;
  priceEnvVars: readonly ['PROTOVID_PROJECT_PASS_PRICE_ID', 'PROTOVID_LARGE_EXPORT_PRICE_ID', 'PROTOVID_EXPORT_PACK_PRICE_ID'];
}

export const LARGE_FLOW_PASS: OneTimeOffer = {
  id: 'large_flow_pass',
  plan: 'large_export',
  label: LARGE_FLOW_PASS_DISPLAY,
  amountCents: LARGE_FLOW_PASS_CENTS,
  currency: 'usd',
  accessDays: LARGE_FLOW_PASS_ACCESS_DAYS,
  priceEnvVars: ['PROTOVID_PROJECT_PASS_PRICE_ID', 'PROTOVID_LARGE_EXPORT_PRICE_ID', 'PROTOVID_EXPORT_PACK_PRICE_ID'],
};

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export function stableEmailHash(email: string): number {
  const normalized = normalizeEmail(email);
  let hash = 2166136261;

  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function getOfferExperimentAssignment(
  actorKey: string,
  projectPassAvailable = true,
): {
  id: typeof OFFER_EXPERIMENT_ID;
  variant: OfferExperimentVariant;
  primaryOffer: PrimaryOffer;
} {
  void actorKey;
  const variant: OfferExperimentVariant = projectPassAvailable
    ? 'project_pass_first'
    : 'pro_first';

  return {
    id: OFFER_EXPERIMENT_ID,
    variant,
    primaryOffer: variant === 'project_pass_first' ? 'large_export' : 'monthly',
  };
}

export function getGoodBetterBestPricingAssignment(
  actorKey: string,
): {
  id: typeof GOOD_BETTER_BEST_PRICING_EXPERIMENT_ID;
  variant: GoodBetterBestPricingVariant;
} {
  const variant: GoodBetterBestPricingVariant = stableEmailHash(actorKey) % 2 === 1
    ? 'good_better_best'
    : 'control';

  return {
    id: GOOD_BETTER_BEST_PRICING_EXPERIMENT_ID,
    variant,
  };
}

export function getMonthlyPricingVariant(email: string): PricingVariant {
  normalizeEmail(email);
  return STUDIO_MONTHLY;
}

export function getPricingVariant(email: string, plan: BillingPlan = 'monthly'): PricingVariant {
  normalizeEmail(email);
  return plan === 'yearly' ? STUDIO_YEARLY : STUDIO_MONTHLY;
}

export function getPricingVariantForEnvironment(
  email: string,
  plan: BillingPlan = 'monthly',
  env: NodeJS.ProcessEnv = process.env
): PricingVariant {
  void env;
  return getPricingVariant(email, plan);
}

export function getPricingVariantWithPriceId(
  email: string,
  plan: BillingPlan = 'monthly',
  env: NodeJS.ProcessEnv = process.env
): PricingVariant & { priceId: string } {
  const variant = getPricingVariantForEnvironment(email, plan, env);
  const priceId = variant.priceEnvVars
    .map(envVar => env[envVar]?.trim())
    .find(Boolean);

  if (!priceId) {
    const expectedEnv = variant.plan === 'yearly'
      ? 'PROTOVID_STUDIO_YEARLY_PRICE_ID'
      : 'PROTOVID_STUDIO_MONTHLY_PRICE_ID';
    throw new Error(`${variant.id} billing not configured. Set ${expectedEnv} to the matching Stripe price ID.`);
  }

  return {
    ...variant,
    priceId,
  };
}

export function getLargeFlowPassForEnvironment(env: NodeJS.ProcessEnv = process.env) {
  const priceId = LARGE_FLOW_PASS.priceEnvVars
    .map(envVar => env[envVar]?.trim())
    .find(Boolean);

  return priceId
    ? { ...LARGE_FLOW_PASS, priceId }
    : null;
}
