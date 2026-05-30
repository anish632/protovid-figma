export type BillingPlan = 'monthly' | 'yearly';
export type PricingVariantId = 'monthly_5' | 'monthly_8' | 'yearly_29';

export interface PricingVariant {
  id: PricingVariantId;
  plan: BillingPlan;
  label: string;
  amountCents: number;
  currency: 'usd';
  priceEnvVar: 'PROTOVID_MONTHLY_5_PRICE_ID' | 'PROTOVID_PRICE_ID' | 'PROTOVID_YEARLY_PRICE_ID';
}

export const MONTHLY_PRICE_5: PricingVariant = {
  id: 'monthly_5',
  plan: 'monthly',
  label: '$5/mo',
  amountCents: 500,
  currency: 'usd',
  priceEnvVar: 'PROTOVID_MONTHLY_5_PRICE_ID',
};

export const MONTHLY_PRICE_8: PricingVariant = {
  id: 'monthly_8',
  plan: 'monthly',
  label: '$8/mo',
  amountCents: 800,
  currency: 'usd',
  priceEnvVar: 'PROTOVID_PRICE_ID',
};

export const YEARLY_PRICE_29: PricingVariant = {
  id: 'yearly_29',
  plan: 'yearly',
  label: '$29/yr',
  amountCents: 2900,
  currency: 'usd',
  priceEnvVar: 'PROTOVID_YEARLY_PRICE_ID',
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
  return stableEmailHash(email) % 2 === 0 ? MONTHLY_PRICE_5 : MONTHLY_PRICE_8;
}

export function getPricingVariant(email: string, plan: BillingPlan = 'monthly'): PricingVariant {
  if (plan === 'yearly') return YEARLY_PRICE_29;
  return getMonthlyPricingVariant(email);
}

export function getPricingVariantForEnvironment(
  email: string,
  plan: BillingPlan = 'monthly',
  env: NodeJS.ProcessEnv = process.env
): PricingVariant {
  const assigned = getPricingVariant(email, plan);

  if (assigned.id === 'monthly_5' && !env.PROTOVID_MONTHLY_5_PRICE_ID?.trim()) {
    return MONTHLY_PRICE_8;
  }

  return assigned;
}

export function getPricingVariantWithPriceId(
  email: string,
  plan: BillingPlan = 'monthly',
  env: NodeJS.ProcessEnv = process.env
): PricingVariant & { priceId: string } {
  const variant = getPricingVariantForEnvironment(email, plan, env);
  const priceId = env[variant.priceEnvVar]?.trim();

  if (!priceId) {
    throw new Error(`${variant.id} billing not configured`);
  }

  return {
    ...variant,
    priceId,
  };
}
