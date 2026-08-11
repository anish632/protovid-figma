'use client';

import Head from 'next/head';
import { useState } from 'react';
import { LARGE_FLOW_PASS, MONTHLY_PRICE_5 } from '@/lib/pricingExperiment';

export default function PricingPage() {
  const [loadingPlan, setLoadingPlan] = useState<'monthly' | 'large_export' | null>(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const validEmail = email.trim().includes('@');
  const monthlyPriceLabel = MONTHLY_PRICE_5.label;
  const projectPassLabel = LARGE_FLOW_PASS.label;

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
        body: JSON.stringify({ email: email.trim(), plan }),
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
        <title>ProtoVid Pricing - Prototype Review Rooms</title>
        <meta
          name="description"
          content="Start free with 3 watermarked exports. Upgrade to ProtoVid Pro for unlimited HD/4K prototype review rooms from Figma with no watermark."
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
          <h1 style={{ fontSize: 'clamp(40px, 6vw, 68px)', lineHeight: 1.02, letterSpacing: '-0.04em', margin: 0, color: '#fff' }}>
            Prototype review rooms for decisions, not another screen recorder.
          </h1>
          <p style={{ marginTop: 18, fontSize: 18, lineHeight: 1.7, maxWidth: 720, color: '#cbd5e1' }}>
            ProtoVid exports the real prototype flow as MP4, adds an on-platform review brief, and gives stakeholders one room for comments, approval, and delivery signal.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginTop: 34 }}>
            <section style={{ padding: 24, borderRadius: 18, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ color: '#94a3b8', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Free</div>
              <div style={{ fontSize: 34, fontWeight: 800, marginTop: 8, color: '#fff' }}>$0</div>
              <p style={{ marginTop: 12, lineHeight: 1.6, color: '#cbd5e1' }}>3 exports per month, 720p, watermarked review rooms.</p>
              <p style={{ marginTop: 12, fontSize: 14, color: '#94a3b8' }}>Best for proof, demos, and validating the decision workflow.</p>
            </section>

            <section style={{ padding: 24, borderRadius: 18, background: 'rgba(124,110,240,0.12)', border: '1px solid rgba(124,110,240,0.45)', boxShadow: '0 24px 70px rgba(124,110,240,0.18)' }}>
              <div style={{ color: '#d8d6ff', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Project Pass</div>
              <div style={{ fontSize: 34, fontWeight: 800, marginTop: 8, color: '#fff' }}>{projectPassLabel}</div>
              <p style={{ marginTop: 12, lineHeight: 1.6, color: '#eef2ff' }}>7 days of unlimited HD/4K exports, review rooms, and decision briefs.</p>
              <p style={{ marginTop: 12, fontSize: 14, color: '#d8d6ff' }}>Best for one stakeholder deadline. No subscription.</p>
            </section>

            <section style={{ padding: 24, borderRadius: 18, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ color: '#d8d6ff', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pro</div>
              <div style={{ fontSize: 34, fontWeight: 800, marginTop: 8, color: '#fff' }}>{monthlyPriceLabel}</div>
              <p style={{ marginTop: 12, lineHeight: 1.6, color: '#eef2ff' }}>Unlimited exports, HD/4K, no watermark, owner analytics.</p>
              <p style={{ marginTop: 12, fontSize: 14, color: '#d8d6ff' }}>Best for client decisions and repeated iteration.</p>
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
                  'Unlimited prototype exports during active access',
                  'HD 1080p and 4K output',
                  'No watermark for handoff',
                  'Review rooms with generated decision briefs',
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
              <p style={{ margin: 0, fontWeight: 700, fontSize: 18 }}>Choose your self-serve access</p>
              <p style={{ margin: '8px 0 16px', color: '#4b5563', lineHeight: 1.6 }}>
                Enter the same email you use in Figma. Stripe will attach access to that account and the plugin will unlock automatically.
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
                {loadingPlan === 'large_export' ? 'Starting checkout…' : validEmail ? `Project Pass — ${projectPassLabel}` : 'Enter email to continue'}
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
                {loadingPlan === 'monthly' ? 'Starting checkout…' : validEmail ? `Ongoing Pro — ${monthlyPriceLabel}` : 'Enter email to continue'}
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
