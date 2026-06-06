'use client';

import { useState } from 'react';
import { MONTHLY_PRICE_5 } from '@/lib/pricingExperiment';
import Head from 'next/head';

export default function PricingPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const monthlyPriceLabel = MONTHLY_PRICE_5.label;
  const validEmail = email.trim().includes('@');

  async function checkout() {
    if (!email.trim()) { setError('Enter your email to continue.'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), plan: 'monthly' }),
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
    <>
      <Head>
        <title>ProtoVid Pricing - $5/mo for Client-Ready Figma Prototype Videos</title>
        <meta name="description" content="ProtoVid Pro: $5/month for unlimited HD/4K prototype video exports from Figma. No watermark, client-ready MP4 output. Start with 3 free exports." />
        <meta name="keywords" content="figma plugin, prototype videos, client demos, figma export, mp4 export, design tools" />
        <meta property="og:title" content="ProtoVid Pricing - Client-Ready Prototype Videos" />
        <meta property="og:description" content="Unlimited HD/4K prototype video exports from Figma for $5/month. No watermark, client-ready MP4 output." />
        <meta property="og:type" content="website" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "ProtoVid Pro",
            "description": "Professional Figma plugin for client-ready prototype video exports",
            "applicationCategory": "DesignApplication",
            "operatingSystem": "Web",
            "offers": {
              "@type": "Offer",
              "name": "Pro Subscription",
              "price": "5",
              "priceCurrency": "USD",
              "billingIncrement": "Month",
              "description": "Unlimited HD/4K exports, no watermark, client-ready output"
            },
            "featureList": [
              "Unlimited prototype video exports",
              "HD and 4K resolution options", 
              "No watermark for client delivery",
              "MP4 output format",
              "Automatic flow detection"
            ]
          })
        }} />
      </Head>
      <main style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif', maxWidth: 720, margin: '96px auto', padding: '0 24px', lineHeight: 1.5 }}>
        <h1 style={{ fontSize: 36, marginBottom: 12 }}>ProtoVid Pricing</h1>
      <p style={{ color: '#555', fontSize: 18, marginBottom: 32 }}>
        Start free in the Figma plugin, then upgrade when you need Pro exports.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 40 }}>
        <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 24 }}>
          <h2 style={{ marginTop: 0 }}>Free</h2>
          <p style={{ fontSize: 28, fontWeight: 700, margin: '8px 0' }}>$0</p>
          <p style={{ color: '#666' }}>3 watermarked 720p exports each month.</p>
        </section>
        <section style={{ border: '2px solid #7c6ef0', borderRadius: 8, padding: 24 }}>
          <h2 style={{ marginTop: 0 }}>Pro</h2>
          <p style={{ fontSize: 28, fontWeight: 700, margin: '8px 0' }}>{monthlyPriceLabel}</p>
          <p style={{ color: '#666', marginBottom: 0 }}>Unlimited exports, HD/4K resolution, no watermark.</p>
        </section>
      </div>

      <div style={{ background: '#f9f9f9', borderRadius: 12, padding: 28, maxWidth: 400 }}>
        <p style={{ margin: '0 0 12px', fontWeight: 600 }}>Upgrade to Pro — {monthlyPriceLabel}</p>
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, marginBottom: 12, boxSizing: 'border-box' }}
        />
        <button onClick={checkout} disabled={loading || !validEmail} style={{ width: '100%', padding: '11px 20px', borderRadius: 8, background: '#7c6ef0', color: 'white', border: 'none', fontWeight: 600, cursor: validEmail ? 'pointer' : 'not-allowed', opacity: loading || !validEmail ? 0.6 : 1, fontSize: 15 }}>
          {loading ? 'Starting…' : validEmail ? `Upgrade to Pro — ${monthlyPriceLabel}` : 'Enter email to continue'}
        </button>
        <p style={{ margin: '10px 0 0', fontSize: 12, color: '#888' }}>Secure checkout powered by Stripe. You can pay by card with or without Link.</p>
        {error && <p style={{ margin: '8px 0 0', fontSize: 13, color: '#c00' }}>{error}</p>}
      </div>
      </main>
    </>
  );
}
