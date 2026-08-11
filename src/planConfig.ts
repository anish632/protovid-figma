// Pricing tiers
export const FREE_PLAN = {
  name: 'Free',
  price: '$0',
  exports: 3,
  resolution: '720p',
  watermark: true,
  features: ['3 exports per month', '720p resolution', 'Watermarked videos']
} as const;

export const PRO_PLAN = {
  name: 'Pro',
  price: '$5/mo',
  priceDisplay: '$5/mo',
  priceCents: 500,
  exports: 'unlimited',
  resolution: 'HD & 4K',
  watermark: false,
  features: ['Unlimited exports', 'HD & 4K resolution', 'No watermark', 'Review briefs and client-ready videos']
} as const;

export const LARGE_FLOW_PASS = {
  // Keep the legacy export name for compatibility with saved checkout state.
  // The customer-facing offer is intentionally job-based, not frame-based.
  name: 'Project Pass',
  price: '$4 once',
  priceDisplay: '$4 once',
  priceCents: 400,
  accessDays: 7,
  frameThreshold: 1,
  features: ['7 days of unlimited exports', 'HD & 4K resolution', 'No watermark', 'No subscription']
} as const;

export const TEAM_PLAN = {
  name: 'Team',
  price: '$49/mo',
  priceDisplay: '$49/mo', 
  priceCents: 4900,
  exports: 'unlimited',
  resolution: 'HD & 4K',
  watermark: false,
  features: ['Everything in Pro', 'Custom branding', 'Bulk export', 'Team review analytics', 'Priority support']
} as const;

// Legacy exports for backward compatibility
export const PRO_PRICE_MONTHLY_DISPLAY = PRO_PLAN.priceDisplay;
export const PRO_PRICE_MONTHLY_CENTS = PRO_PLAN.priceCents;
export const LARGE_FLOW_PASS_DISPLAY = LARGE_FLOW_PASS.priceDisplay;
export const LARGE_FLOW_PASS_CENTS = LARGE_FLOW_PASS.priceCents;
export const LARGE_FLOW_PASS_ACCESS_DAYS = LARGE_FLOW_PASS.accessDays;
export const LARGE_FLOW_FRAME_THRESHOLD = LARGE_FLOW_PASS.frameThreshold;
export const FREE_RESOLUTION = '720p';
export const PRO_RESOLUTIONS = ['1080p', '4K'] as const;

export const PRO_UPGRADE_COPY = {
  upsellHeadline: 'Make this client-ready',
  upsellBody: 'Remove the watermark, unlock HD/4K, and ship the version you would put in front of a client.',
  upsellCta: `Unlock Pro`,
  upsellSubtext: `Just ${PRO_PLAN.priceDisplay}. Manage billing securely in Stripe.`,
  limitHeadline: 'You’ve hit the free limit',
  limitBody: 'Keep exporting now with Pro, or wait for your next free cycle if you only need the watermarked proof.',
  limitCta: `Unlock Pro`,
  limitSubtext: `Just ${PRO_PLAN.priceDisplay}. No watermark, no extra setup.`,
  emailHelper: 'Enter your email to attach Pro to this account and continue immediately.',
  stripeHelper: 'Secure checkout powered by Stripe. Pay by card with or without Link.',
  trialHelper: 'No trial. You can cancel anytime from Stripe.',
  socialProof: 'Built for designers turning prototype walkthroughs into product decisions',
  largeFlowHeadline: 'Finish this project without a subscription',
  largeFlowBody: 'Use HD/4K, remove the watermark, and iterate freely for one project deadline.',
  largeFlowPassCta: 'Buy Project Pass',
  largeFlowPassSubtext: `${LARGE_FLOW_PASS.priceDisplay}. Unlimited exports for ${LARGE_FLOW_PASS.accessDays} days.`,
  valueProps: {
    unlimitedExports: 'Unlimited prototype exports',
    hdQuality: 'HD & 4K resolution options',
    noWatermark: 'Clean, professional videos',
    clientReady: 'Perfect for stakeholder decisions',
    customBranding: 'Add your logo (Team plan)',
    bulkExport: 'Export all flows at once (Team plan)'
  }
} as const;
