export default function PricingPage() {
  return (
    <main style={{
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      maxWidth: 720,
      margin: '96px auto',
      padding: '0 24px',
      lineHeight: 1.5,
    }}>
      <h1 style={{ fontSize: 36, marginBottom: 12 }}>ProtoVid Pricing</h1>
      <p style={{ color: '#555', fontSize: 18, marginBottom: 32 }}>
        Start free in the Figma plugin, then upgrade from inside ProtoVid when you need Pro exports.
      </p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 16,
      }}>
        <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 24 }}>
          <h2 style={{ marginTop: 0 }}>Free</h2>
          <p style={{ fontSize: 28, fontWeight: 700, margin: '8px 0' }}>$0</p>
          <p style={{ color: '#666' }}>1 watermarked 720p export each month.</p>
        </section>
        <section style={{ border: '1px solid #7c6ef0', borderRadius: 8, padding: 24 }}>
          <h2 style={{ marginTop: 0 }}>Pro</h2>
          <p style={{ fontSize: 28, fontWeight: 700, margin: '8px 0' }}>$8/mo</p>
          <p style={{ color: '#666' }}>Unlimited exports, HD/4K resolution, and no watermark.</p>
        </section>
      </div>
    </main>
  );
}
