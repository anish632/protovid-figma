import Link from 'next/link';

export default function AccountPage() {
  const portalLoginUrl = process.env.STRIPE_CUSTOMER_PORTAL_LOGIN_URL?.trim();

  return (
    <main style={{
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
      minHeight: '100vh',
      padding: '72px 24px',
      background: '#0b0f0d',
      color: '#e8eee9',
    }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <p style={{ margin: 0, color: '#55d18c', fontSize: 13, fontWeight: 800, textTransform: 'uppercase' }}>Self-serve account</p>
        <h1 style={{ fontSize: 48, lineHeight: 1.05, letterSpacing: 0, margin: '12px 0 0', color: '#fff' }}>
          Resolve payments and manage your subscription.
        </h1>
        <p style={{ marginTop: 18, fontSize: 18, lineHeight: 1.7, color: '#b8c4bc' }}>
          Enter the email used at checkout. Stripe will send a secure login link. Open an unpaid invoice to complete bank verification or payment, update your payment method, or manage your subscription.
        </p>
        <p style={{ marginTop: 16, lineHeight: 1.7, color: '#b8c4bc' }}>
          If your subscription is canceled, paying an old invoice does not restart it. Review your billing here, then return to ProtoVid to start a new subscription when you’re ready.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 28 }}>
          {portalLoginUrl ? (
            <a href={portalLoginUrl} style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '13px 18px',
              borderRadius: 6,
              background: '#167b45',
              color: '#fff',
              fontWeight: 800,
              textDecoration: 'none',
            }}>
              Open secure billing portal
            </a>
          ) : (
            <Link href="/pricing" style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '13px 18px',
              borderRadius: 6,
              background: '#167b45',
              color: '#fff',
              fontWeight: 800,
              textDecoration: 'none',
            }}>
              View pricing
            </Link>
          )}
          <Link href="/" style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '13px 18px',
            borderRadius: 6,
            border: '1px solid #38453d',
            color: '#e8eee9',
            fontWeight: 700,
            textDecoration: 'none',
            background: '#121815',
          }}>
            Back to ProtoVid
          </Link>
        </div>
      </div>
    </main>
  );
}
