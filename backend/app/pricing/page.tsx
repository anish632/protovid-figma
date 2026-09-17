'use client';

import Head from 'next/head';
import { useEffect, useState } from 'react';
import {
  LARGE_FLOW_PASS,
  STUDIO_MONTHLY,
} from '@/lib/pricingExperiment';

const ANONYMOUS_ID_STORAGE_KEY = 'protovid_pricing_actor_id';
const PLG_PRICING_EXPERIMENT_ID = 'b2b_plg_pricing_v1';
const PLG_PRICING_VARIANT = 'studio_self_serve';

type CheckoutPlan = 'monthly' | 'yearly' | 'large_export';

function getOrCreatePricingActorId() {
  let existing: string | null = null;
  try { existing = window.localStorage.getItem(ANONYMOUS_ID_STORAGE_KEY); } catch { /* Checkout works without storage. */ }
  if (existing) return existing;

  const generated = `pricing_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  try { window.localStorage.setItem(ANONYMOUS_ID_STORAGE_KEY, generated); } catch { /* Use the session identity. */ }
  return generated;
}

const styles = {
  page: {
    minHeight: '100vh',
    padding: '36px 20px 72px',
    background: '#0b0f0d',
    color: '#e8eee9',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
  },
  shell: { maxWidth: 1040, margin: '0 auto' },
  card: {
    padding: 24,
    borderRadius: 8,
    background: '#121815',
    border: '1px solid #28332d',
  },
  button: {
    width: '100%',
    padding: '13px 16px',
    borderRadius: 6,
    border: 'none',
    fontWeight: 800,
    fontSize: 15,
  },
} as const;

export default function PricingPage() {
  const [loadingPlan, setLoadingPlan] = useState<CheckoutPlan | null>(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [anonymousId, setAnonymousId] = useState('');
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const studioOffer = STUDIO_MONTHLY;

  useEffect(() => {
    const actorId = getOrCreatePricingActorId();
    setAnonymousId(actorId);

    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'pricing_variant_assigned',
        metadata: {
          source: 'pricing_page',
          anonymousId: actorId,
          event_id: `${PLG_PRICING_EXPERIMENT_ID}:${PLG_PRICING_VARIANT}:${actorId}`,
          pricing_page_experiment_id: PLG_PRICING_EXPERIMENT_ID,
          pricing_page_experiment_variant: PLG_PRICING_VARIANT,
          pricingVariant: STUDIO_MONTHLY.id,
          priceLabel: STUDIO_MONTHLY.label,
          amountCents: STUDIO_MONTHLY.amountCents,
          project_pass_price_label: LARGE_FLOW_PASS.label,
          project_pass_amount_cents: LARGE_FLOW_PASS.amountCents,
        },
      }),
    }).catch(() => undefined);
  }, []);

  async function checkout(plan: CheckoutPlan) {
    if (loadingPlan) return;
    if (!validEmail) {
      setError('Enter the email used in ProtoVid.');
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
          pricingPageExperimentId: PLG_PRICING_EXPERIMENT_ID,
          pricingPageExperimentVariant: PLG_PRICING_VARIANT,
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

      void fetch('/api/track', {
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
            pricing_page_experiment_id: PLG_PRICING_EXPERIMENT_ID,
            pricing_page_experiment_variant: PLG_PRICING_VARIANT,
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
        <title>ProtoVid Pricing - Self-Serve Video Export</title>
        <meta
          name="description"
          content="Start free, buy one Project Pass, or use ProtoVid Studio for recurring Figma prototype approvals. Self-serve checkout with unlimited reviewers."
        />
      </Head>
      <main style={styles.page}>
        <div style={styles.shell}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
            <a href="/" style={{ color: '#fff', textDecoration: 'none', fontSize: 19, fontWeight: 900 }}>ProtoVid</a>
            <a href="/account" style={{ color: '#a9b8ae', textDecoration: 'none', fontSize: 14 }}>Manage billing</a>
          </header>

          <section style={{ padding: '72px 0 34px', maxWidth: 780 }}>
            <p style={{ margin: 0, color: '#55d18c', fontSize: 13, fontWeight: 800, textTransform: 'uppercase' }}>Self-serve pricing</p>
            <h1 style={{ margin: '12px 0 0', color: '#fff', fontSize: 52, lineHeight: 1.04, letterSpacing: 0 }}>
              Finish your next client delivery.
            </h1>
            <p style={{ margin: '18px 0 0', color: '#b8c4bc', fontSize: 18, lineHeight: 1.65 }}>
              Finish your client delivery with seven days of unlimited exports. Choose Studio when you need exports every month.
            </p>
          </section>

          <p><a href="/guides/first-export" style={{ color: "#9cf0bb" }}>Try a free proof before choosing a plan →</a></p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 14 }}>
            <section style={styles.card}>
              <div style={{ color: '#a9b8ae', fontSize: 13, fontWeight: 800 }}>FREE</div>
              <div style={{ marginTop: 8, color: '#fff', fontSize: 34, fontWeight: 900 }}>$0</div>
              <p style={{ minHeight: 50, color: '#b8c4bc', lineHeight: 1.55 }}>Prove the workflow on a real Figma prototype.</p>
              {['1 export each month', '720p with watermark', '7-day approval room', 'Unlimited reviewers'].map(item => (
                <p key={item} style={{ margin: '9px 0', color: '#d5ddd7', fontSize: 14 }}>✓ {item}</p>
              ))}
            </section>

            <section style={{ ...styles.card, borderColor: '#d46a5f' }}>
              <div style={{ color: '#f09a91', fontSize: 13, fontWeight: 800 }}>PROJECT PASS</div>
              <div style={{ marginTop: 8, color: '#fff', fontSize: 34, fontWeight: 900 }}>{LARGE_FLOW_PASS.label}</div>
              <p style={{ minHeight: 50, color: '#b8c4bc', lineHeight: 1.55 }}>Finish one client delivery or approval deadline.</p>
              {['7 days of unlimited exports', '1080p and 4K', 'No watermark', '30-day approval rooms'].map(item => (
                <p key={item} style={{ margin: '9px 0', color: '#d5ddd7', fontSize: 14 }}>✓ {item}</p>
              ))}
            </section>

            <section style={{ ...styles.card, borderColor: '#55d18c', background: '#101c16' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <div style={{ color: '#75e5a5', fontSize: 13, fontWeight: 800 }}>STUDIO</div>
                <span style={{ padding: '4px 7px', borderRadius: 5, background: '#193d29', color: '#9cf0bb', fontSize: 11, fontWeight: 800 }}>FOR RECURRING WORK</span>
              </div>
              <div style={{ marginTop: 8, color: '#fff', fontSize: 34, fontWeight: 900 }}>{studioOffer.label}</div>
              <p style={{ minHeight: 50, color: '#c6d4ca', lineHeight: 1.55 }}>For a creator delivering new walkthroughs and revisions every month.</p>
              {['Unlimited video exports', '1080p and 4K, no watermark', '30-day approval rooms', 'Unlimited external reviewers', 'View, comment, and status analytics'].map(item => (
                <p key={item} style={{ margin: '9px 0', color: '#e0e9e2', fontSize: 14 }}>✓ {item}</p>
              ))}
            </section>
          </div>

          <section style={{ marginTop: 22, padding: 24, borderRadius: 8, background: '#e8eee9', color: '#111713', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 28, alignItems: 'start' }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 900, color: '#28784b' }}>CHOOSE YOUR DELIVERY WINDOW</p>
              <h2 style={{ margin: '8px 0 0', fontSize: 27, letterSpacing: 0 }}>Attach paid access to your ProtoVid email.</h2>
              <p style={{ margin: '10px 0 0', color: '#526057', lineHeight: 1.6 }}>Use the same email in checkout and ProtoVid to recover your purchase. After payment, return to the plugin and choose Check payment status if access is still updating.</p>
            </div>
            <div>
              <input
                type="email"
                autoComplete="email"
                aria-describedby="checkout-email-help"
                aria-label="ProtoVid account email"
                placeholder="you@company.com"
                value={email}
                onChange={event => setEmail(event.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', padding: '12px 13px', borderRadius: 6, border: '1px solid #aab6ad', fontSize: 15, marginBottom: 10 }}
              />
              <p id="checkout-email-help" style={{ fontSize: 13 }}>Your email connects this purchase to your plugin access.</p>
              <button type="button" onClick={() => checkout('large_export')}
                disabled={loadingPlan !== null}
                style={{ ...styles.button, background: '#167b45', color: '#fff', opacity: loadingPlan !== null ? 0.65 : 1 }}>
                {loadingPlan === 'large_export' ? 'Opening Stripe...' : `Buy Project Pass - ${LARGE_FLOW_PASS.label}`}
              </button>
              <button type="button" onClick={() => checkout('monthly')}
                disabled={loadingPlan !== null}
                style={{ ...styles.button, marginTop: 9, background: 'transparent', color: '#245438', border: '1px solid #6d947c', opacity: loadingPlan !== null ? 0.65 : 1 }}>
                {loadingPlan === 'monthly' ? 'Opening Stripe...' : `Start Studio - ${studioOffer.label}`}
              </button>
              <p style={{ margin: '9px 0 0', color: '#667269', fontSize: 12 }}>Secure Stripe checkout. Project Pass is a one-time payment for seven days and does not renew. Studio bills monthly until canceled; manage it from the billing portal.</p>
              {error && <p role="alert" style={{ margin: '9px 0 0', color: '#a32920', fontSize: 13 }}>{error}</p>}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
