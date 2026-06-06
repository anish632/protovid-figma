import { PRO_PRICE_MONTHLY_CENTS, PRO_PRICE_MONTHLY_DISPLAY } from './plans';

export type BillingPlan = 'monthly' | 'yearly';
export type PricingVariantId = 'monthly_5';

export interface PricingVariant {
  id: PricingVariantId;
  plan: 'monthly';
  label: string;
  amountCents: number;
  currency: 'usd';
  priceEnvVars: readonly ['PROTOVID_MONTHLY_5_PRICE_ID', 'PROTOVID_PRICE_ID'];
}

export const MONTHLY_PRICE_5: PricingVariant = {
  id: 'monthly_5',
  plan: 'monthly',
  label: PRO_PRICE_MONTHLY_DISPLAY,
  amountCents: PRO_PRICE_MONTHLY_CENTS,
  currency: 'usd',
  priceEnvVars: ['PROTOVID_MONTHLY_5_PRICE_ID', 'PROTOVID_PRICE_ID'],
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

export function getMonthlyPricingVariant(email: string): PricingVariant {
  normalizeEmail(email);
  return MONTHLY_PRICE_5;
}

export function getPricingVariant(email: string, plan: BillingPlan = 'monthly'): PricingVariant {
  normalizeEmail(email);
  void plan;
  return getMonthlyPricingVariant(email);
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
    throw new Error(`${variant.id} billing not configured. Set PROTOVID_MONTHLY_5_PRICE_ID to the Stripe $5/mo price ID.`);
  }

  return {
    ...variant,
    priceId,
  };
}
