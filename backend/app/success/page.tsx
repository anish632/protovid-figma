export default function SuccessPage() {
  return (
    <main style={{
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      maxWidth: 640,
      margin: '96px auto',
      padding: '0 24px',
      textAlign: 'center',
      lineHeight: 1.5,
    }}>
      <h1 style={{ fontSize: 36, marginBottom: 12 }}>ProtoVid Pro is active</h1>
      <p style={{ color: '#555', fontSize: 18, marginBottom: 24 }}>
        Return to Figma. The ProtoVid plugin will detect your payment and unlock Pro automatically.
      </p>
      <p style={{ color: '#777', fontSize: 14 }}>
        If the plugin does not update within a minute, close and reopen ProtoVid with the same email address.
      </p>
    </main>
  );
}
