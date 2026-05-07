export default function AccountPage() {
  return (
    <main style={{
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      maxWidth: 640,
      margin: '96px auto',
      padding: '0 24px',
      textAlign: 'center',
      lineHeight: 1.5,
    }}>
      <h1 style={{ fontSize: 36, marginBottom: 12 }}>ProtoVid Account</h1>
      <p style={{ color: '#555', fontSize: 18 }}>
        Subscription changes are saved. Return to Figma to keep using ProtoVid.
      </p>
    </main>
  );
}
