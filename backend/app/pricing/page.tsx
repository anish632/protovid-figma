'use client';

import { useState } from 'react';
import { useEffect } from 'react';

export default function PricingPage() {
  const [plan, setPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [monthlyPriceLabel, setMonthlyPriceLabel] = useState('$8/mo');

  useEffect(() => {
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes('@')) return;

    let canceled = false;

    async function loadPricingVariant() {
      try {
        const res = await fetch('/api/billing/pricing-variant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: normalized, plan: 'monthly' }),
        });
        const data = await res.json() as { priceLabel?: string };
        if (!canceled && res.ok && data.priceLabel) {
          setMonthlyPriceLabel(data.priceLabel);
        }
      } catch {
        // Keep default price label.
      }
    }

    loadPricingVariant();

    return () => {
      canceled = true;
    };
  }, [email]);

  async function checkout() {
    if (!email.trim()) { setError('Enter your email to continue.'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), plan }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) { setError(data.error ?? 'Checkout failed.'); return; }
      window.location.assign(data.url);
    } catch {
      setError('Could not start checkout.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif', maxWidth: 720, margin: '96px auto', padding: '0 24px', lineHeight: 1.5 }}>
      <h1 style={{ fontSize: 36, marginBottom: 12 }}>ProtoVid Pricing</h1>
      <p style={{ color: '#555', fontSize: 18, marginBottom: 32 }}>
        Start free in the Figma plugin, then upgrade when you need Pro exports.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 40 }}>
        <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 24 }}>
          <h2 style={{ marginTop: 0 }}>Free</h2>
          <p style={{ fontSize: 28, fontWeight: 700, margin: '8px 0' }}>$0</p>
          <p style={{ color: '#666' }}>1 watermarked 720p export each month.</p>
        </section>
        <section style={{ border: '2px solid #7c6ef0', borderRadius: 8, padding: 24 }}>
          <h2 style={{ marginTop: 0 }}>Pro</h2>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {(['monthly', 'yearly'] as const).map(p => (
              <button key={p} onClick={() => setPlan(p)} style={{ padding: '4px 12px', borderRadius: 6, border: plan === p ? '2px solid #7c6ef0' : '1px solid #ddd', background: plan === p ? '#f3f0ff' : 'white', cursor: 'pointer', fontWeight: plan === p ? 600 : 400 }}>
                {p === 'monthly' ? monthlyPriceLabel : '$29/yr'}
              </button>
            ))}
          </div>
          <p style={{ color: '#666', marginBottom: 0 }}>Unlimited exports, HD/4K resolution, no watermark.</p>
        </section>
      </div>

      <div style={{ background: '#f9f9f9', borderRadius: 12, padding: 28, maxWidth: 400 }}>
        <p style={{ margin: '0 0 12px', fontWeight: 600 }}>Upgrade to Pro — {plan === 'yearly' ? '$29/yr' : monthlyPriceLabel}</p>
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, marginBottom: 12, boxSizing: 'border-box' }}
        />
        <button onClick={checkout} disabled={loading} style={{ width: '100%', padding: '11px 20px', borderRadius: 8, background: '#7c6ef0', color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1, fontSize: 15 }}>
          {loading ? 'Starting…' : 'Continue to checkout'}
        </button>
        <p style={{ margin: '10px 0 0', fontSize: 12, color: '#888' }}>Card, USDC, and USDT accepted via Stripe</p>
        {error && <p style={{ margin: '8px 0 0', fontSize: 13, color: '#c00' }}>{error}</p>}
      </div>
    </main>
  );
}
