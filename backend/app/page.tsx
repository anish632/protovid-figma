export default function Home() {
  return (
    <div style={{ fontFamily: 'system-ui', maxWidth: 600, margin: '100px auto', textAlign: 'center' }}>
      <h1>ProtoVid API</h1>
      <p>Professional Prototype Video Exporter for Figma</p>
      <p style={{ color: '#666' }}>API endpoints: /api/validate-license, /api/encode-video</p>
    </div>
  );
}
