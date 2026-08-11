import Link from 'next/link';

export default function AccountPage() {
  return (
    <main style={{
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
      minHeight: '100vh',
      padding: '72px 24px',
      background: 'linear-gradient(180deg, #08111f 0%, #111827 100%)',
      color: '#e5e7eb',
      textAlign: 'center',
    }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <h1 style={{ fontSize: 'clamp(40px, 6vw, 68px)', lineHeight: 1.02, letterSpacing: '-0.04em', margin: 0, color: '#fff' }}>
          Manage your ProtoVid account.
        </h1>
        <p style={{ marginTop: 18, fontSize: 18, lineHeight: 1.7, color: '#cbd5e1' }}>
          Billing changes are handled in Stripe. Return to Figma after changes so the plugin can refresh your entitlement.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 28 }}>
          <Link href="/pricing" style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '14px 22px',
            borderRadius: 12,
            background: '#7c6ef0',
            color: '#fff',
            fontWeight: 700,
            textDecoration: 'none',
          }}>
            View pricing
          </Link>
          <Link href="/" style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '14px 22px',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#fff',
            fontWeight: 600,
            textDecoration: 'none',
            background: 'rgba(255,255,255,0.04)',
          }}>
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
