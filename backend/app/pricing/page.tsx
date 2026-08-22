'use client';

import Head from 'next/head';
import { useEffect, useState } from 'react';
import {
  GOOD_BETTER_BEST_PRICING_EXPERIMENT_ID,
  LARGE_FLOW_PASS,
  MONTHLY_PRICE_5,
  getGoodBetterBestPricingAssignment,
  type GoodBetterBestPricingVariant,
} from '@/lib/pricingExperiment';

const ANONYMOUS_ID_STORAGE_KEY = 'protovid_pricing_actor_id';

function getOrCreatePricingActorId() {
  const existing = window.localStorage.getItem(ANONYMOUS_ID_STORAGE_KEY);
  if (existing) return existing;

  const generated = `pricing_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(ANONYMOUS_ID_STORAGE_KEY, generated);
  return generated;
}

function getPricingExperimentOverride(): GoodBetterBestPricingVariant | null {
  const value = new URLSearchParams(window.location.search).get('pricing_test');
  return value === 'good_better_best' || value === 'control' ? value : null;
}

export default function PricingPage() {
  const [loadingPlan, setLoadingPlan] = useState<'monthly' | 'large_export' | null>(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [anonymousId, setAnonymousId] = useState('');
  const [pricingPageExperimentVariant, setPricingPageExperimentVariant] =
    useState<GoodBetterBestPricingVariant>('control');
  const validEmail = email.trim().includes('@');
  const monthlyPriceLabel = MONTHLY_PRICE_5.label;
  const projectPassLabel = LARGE_FLOW_PASS.label;
  const isGoodBetterBest = pricingPageExperimentVariant === 'good_better_best';

  useEffect(() => {
    const actorId = getOrCreatePricingActorId();
    const override = getPricingExperimentOverride();
    const assignment = override
      ? {
          id: GOOD_BETTER_BEST_PRICING_EXPERIMENT_ID,
          variant: override,
        }
      : getGoodBetterBestPricingAssignment(actorId);

    setAnonymousId(actorId);
    setPricingPageExperimentVariant(assignment.variant);

    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'pricing_variant_assigned',
        metadata: {
          source: 'pricing_page',
          anonymousId: actorId,
          event_id: `${assignment.id}:${assignment.variant}:${actorId}`,
          pricing_page_experiment_id: assignment.id,
          pricing_page_experiment_variant: assignment.variant,
          pricingVariant: MONTHLY_PRICE_5.id,
          priceLabel: MONTHLY_PRICE_5.label,
          amountCents: MONTHLY_PRICE_5.amountCents,
          project_pass_price_label: LARGE_FLOW_PASS.label,
          project_pass_amount_cents: LARGE_FLOW_PASS.amountCents,
          override: override || null,
        },
      }),
    }).catch(() => undefined);
  }, []);

  async function checkout(plan: 'monthly' | 'large_export') {
    if (!validEmail) {
      setError('Enter your email to continue.');
      return;
    }

    setError('');
    setLoadingPlan(plan);

    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          plan,
          anonymousId: anonymousId || undefined,
          pricingPageExperimentId: GOOD_BETTER_BEST_PRICING_EXPERIMENT_ID,
          pricingPageExperimentVariant,
        }),
      });
      const data = await res.json() as {
        url?: string;
        error?: string;
        pricingVariant?: string;
        priceLabel?: string;
        amountCents?: number;
      };
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Checkout failed.');
        return;
      }
      await fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          eventType: 'checkout_opened',
          metadata: {
            source: 'pricing_page',
            plan,
            pricingVariant: data.pricingVariant || null,
            priceLabel: data.priceLabel || null,
            amountCents: data.amountCents || null,
            anonymousId: anonymousId || null,
            pricing_page_experiment_id: GOOD_BETTER_BEST_PRICING_EXPERIMENT_ID,
            pricing_page_experiment_variant: pricingPageExperimentVariant,
          },
        }),
      }).catch(() => undefined);
      window.location.assign(data.url);
    } catch {
      setError('Could not start checkout.');
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <>
      <Head>
        <title>ProtoVid Pricing - Product Demo Videos</title>
        <meta
          name="description"
          content="Start free with 3 watermarked 720p exports. Use Project Pass for one HD/4K launch deadline or Pro for recurring client-ready product demo videos from Figma."
        />
      </Head>
      <main style={{
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
        minHeight: '100vh',
        padding: '72px 24px',
        background: 'linear-gradient(180deg, #08111f 0%, #111827 100%)',
        color: '#e5e7eb',
      }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <p style={{ fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 12 }}>
            ProtoVid pricing
          </p>
          <h1 style={{ fontSize: 'clamp(40px, 6vw, 68px)', lineHeight: 1.02, letterSpacing: 0, margin: 0, color: '#fff' }}>
            {isGoodBetterBest
              ? 'Good, better, and best ways to turn Figma prototypes into demo videos.'
              : 'Product demo videos from Figma prototypes, not another screen recorder.'}
          </h1>
          <p style={{ marginTop: 18, fontSize: 18, lineHeight: 1.7, maxWidth: 720, color: '#cbd5e1' }}>
            {isGoodBetterBest
              ? 'Start with watermarked proof exports, buy one clean launch window, or keep recurring client-ready demos moving with Pro.'
              : 'ProtoVid exports the real prototype flow as MP4, WebM, or GIF. Paid access is priced around polished demo delivery: 1080p/4K, no watermark, and MP4 review rooms for comments, approval, and delivery signal.'}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginTop: 34 }}>
            <section style={{ padding: 24, borderRadius: 18, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ color: '#94a3b8', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {isGoodBetterBest ? 'Good' : 'Free'}
              </div>
              <div style={{ fontSize: 34, fontWeight: 800, marginTop: 8, color: '#fff' }}>$0</div>
              <p style={{ marginTop: 12, lineHeight: 1.6, color: '#cbd5e1' }}>3 exports per month, 720p, watermark included.</p>
              <p style={{ marginTop: 12, fontSize: 14, color: '#94a3b8' }}>
                {isGoodBetterBest ? 'Good for proof exports and validating the demo workflow.' : 'Best for proof exports and validating the demo workflow.'}
              </p>
            </section>

            <section style={{ padding: 24, borderRadius: 18, background: 'rgba(124,110,240,0.12)', border: '1px solid rgba(124,110,240,0.45)', boxShadow: '0 24px 70px rgba(124,110,240,0.18)' }}>
              <div style={{ color: '#d8d6ff', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {isGoodBetterBest ? 'Better' : 'Project Pass'}
              </div>
              <div style={{ fontSize: 34, fontWeight: 800, marginTop: 8, color: '#fff' }}>{projectPassLabel}</div>
              <p style={{ marginTop: 12, lineHeight: 1.6, color: '#eef2ff' }}>7 days of unlimited HD/4K demo exports with no watermark, plus MP4 review rooms and decision briefs.</p>
              <p style={{ marginTop: 12, fontSize: 14, color: '#d8d6ff' }}>
                {isGoodBetterBest ? 'Better for one launch, client, or stakeholder deadline. No subscription.' : 'Best for one launch, client, or stakeholder deadline. No subscription.'}
              </p>
            </section>

            <section style={{ padding: 24, borderRadius: 18, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ color: '#d8d6ff', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {isGoodBetterBest ? 'Best' : 'Pro'}
              </div>
              <div style={{ fontSize: 34, fontWeight: 800, marginTop: 8, color: '#fff' }}>{monthlyPriceLabel}</div>
              <p style={{ marginTop: 12, lineHeight: 1.6, color: '#eef2ff' }}>Recurring client-ready demo exports, HD/4K, no watermark, review rooms, and owner analytics.</p>
              <p style={{ marginTop: 12, fontSize: 14, color: '#d8d6ff' }}>
                {isGoodBetterBest ? 'Best for product launches, client updates, and repeated iteration.' : 'Best for product launches, client updates, and repeated iteration.'}
              </p>
            </section>
          </div>

          <div style={{
            marginTop: 28,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
            gap: 20,
            alignItems: 'start',
          }}>
            <div style={{
              padding: 24,
              borderRadius: 18,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <h2 style={{ margin: 0, fontSize: 22, color: '#fff' }}>What paid access unlocks</h2>
              <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
                {[
                  'Unlimited MP4, WebM, and GIF exports during active access',
                  'HD 1080p and 4K output',
                  'No watermark for handoff',
                  'MP4 demo review rooms with generated decision briefs',
                  'Owner analytics for views, comments, and approval state',
                  'Automatic payment detection back in Figma',
                  'Cancel anytime from Stripe',
                ].map(item => (
                  <div key={item} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: '#e2e8f0' }}>
                    <span style={{ color: '#7c6ef0' }}>•</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: 24, borderRadius: 18, background: '#fff', color: '#111827' }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 18 }}>
                {isGoodBetterBest ? 'Pick Better or Best' : 'Choose your self-serve access'}
              </p>
              <p style={{ margin: '8px 0 16px', color: '#4b5563', lineHeight: 1.6 }}>
                {isGoodBetterBest
                  ? 'Better is a one-time Project Pass for one deadline. Best is Pro for recurring polished demos. Use the same email you use in Figma.'
                  : 'Enter the same email you use in Figma. Stripe will attach access to that account and the plugin will unlock automatically.'}
              </p>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: '1px solid #d1d5db',
                  fontSize: 14,
                  marginBottom: 12,
                  boxSizing: 'border-box',
                }}
              />
              <button
                onClick={() => checkout('large_export')}
                disabled={loadingPlan !== null || !validEmail}
                style={{
                  width: '100%',
                  padding: '14px 18px',
                  borderRadius: 10,
                  background: '#7c6ef0',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 800,
                  cursor: validEmail ? 'pointer' : 'not-allowed',
                  opacity: loadingPlan !== null || !validEmail ? 0.7 : 1,
                  fontSize: 15,
                }}
              >
                {loadingPlan === 'large_export' ? 'Starting checkout…' : validEmail ? `${isGoodBetterBest ? 'Better' : 'Project Pass'} — ${projectPassLabel}` : 'Enter email to continue'}
              </button>
              <button
                onClick={() => checkout('monthly')}
                disabled={loadingPlan !== null || !validEmail}
                style={{
                  width: '100%',
                  padding: '13px 18px',
                  borderRadius: 10,
                  background: '#fff',
                  color: '#312e81',
                  border: '1px solid #c7d2fe',
                  fontWeight: 800,
                  cursor: validEmail ? 'pointer' : 'not-allowed',
                  opacity: loadingPlan !== null || !validEmail ? 0.7 : 1,
                  fontSize: 15,
                  marginTop: 10,
                }}
              >
                {loadingPlan === 'monthly' ? 'Starting checkout…' : validEmail ? `${isGoodBetterBest ? 'Best' : 'Ongoing Pro'} — ${monthlyPriceLabel}` : 'Enter email to continue'}
              </button>
              <p style={{ margin: '10px 0 0', fontSize: 12, color: '#6b7280' }}>
                Secure checkout powered by Stripe. The plugin detects your payment automatically after checkout.
              </p>
              {error && <p style={{ margin: '10px 0 0', fontSize: 13, color: '#b91c1c' }}>{error}</p>}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
