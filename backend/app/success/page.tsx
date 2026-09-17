import Link from 'next/link';
import { SuccessConfirmation } from './SuccessConfirmation';

export default async function SuccessPage({
  searchParams,
}: {
  searchParams?: Promise<{ session_id?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const sessionId = params?.session_id;

  return (
    <main style={{
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
      minHeight: '100vh',
      padding: '72px 24px',
      background: '#0b0f0d',
      color: '#e5e7eb',
      textAlign: 'center',
    }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{
          display: 'inline-flex',
          padding: '8px 14px',
          borderRadius: 999,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: '#cbd5e1',
          fontSize: 13,
          marginBottom: 24,
        }}>
          Payment status
        </div>
        <h1 style={{ fontSize: 'clamp(40px, 6vw, 68px)', lineHeight: 1.02, letterSpacing: 0, margin: 0, color: '#fff' }}>
          Your ProtoVid access is active.
        </h1>
        <div style={{ marginTop: 18 }}>
          <SuccessConfirmation sessionId={sessionId} />
        </div>
        <p style={{ marginTop: 10, fontSize: 18, lineHeight: 1.7, color: '#cbd5e1' }}>
          Return to Figma. The plugin will detect your payment automatically. Export the final walkthrough, create an approval room, and invite the first reviewer.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 28 }}>
          <Link href="/pricing" style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '14px 22px',
            borderRadius: 6,
            background: '#167b45',
            color: '#fff',
            fontWeight: 700,
            textDecoration: 'none',
          }}>
            Back to pricing
          </Link>
          <Link href="/account" style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '14px 22px',
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#fff',
            fontWeight: 600,
            textDecoration: 'none',
            background: 'rgba(255,255,255,0.04)',
          }}>
            Manage account
          </Link>
        </div>
      </div>
    </main>
  );
}
