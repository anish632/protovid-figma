import { ImageResponse } from 'next/og';

// Output varies by query string, so this must be dynamic. Responses are
// deterministic per-URL, so the CDN caches each distinct image.
export const dynamic = 'force-dynamic';

// Dynamic 1200x630 Open Graph image generator. Every shared link becomes a
// branded visual ad. Usage:
//   /api/og?eyebrow=Comparison&title=ProtoVid%20vs%20Loom&subtitle=...
// Referenced from each page's metadata.openGraph.images.

const WIDTH = 1200;
const HEIGHT = 630;
const MAX = { title: 90, subtitle: 160, eyebrow: 40 };

function clamp(value: string | null, max: number, fallback = '') {
  if (!value) return fallback;
  const trimmed = value.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eyebrow = clamp(searchParams.get('eyebrow'), MAX.eyebrow, 'ProtoVid');
  const title = clamp(searchParams.get('title'), MAX.title, 'Turn Figma prototypes into shareable videos');
  const subtitle = clamp(searchParams.get('subtitle'), MAX.subtitle, 'Export Figma prototypes to MP4, WebM, or GIF — no screen recording.');

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          backgroundColor: '#0b1120',
          backgroundImage:
            'radial-gradient(900px 500px at 78% -12%, rgba(124,110,240,0.42), transparent 60%), radial-gradient(760px 480px at 8% 118%, rgba(236,72,153,0.28), transparent 60%)',
          color: '#e2e8f0',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #7c6ef0, #ec4899)',
              color: '#fff',
              fontSize: 40,
              fontWeight: 800,
            }}
          >
            P
          </div>
          <div style={{ fontSize: 30, fontWeight: 700, color: '#fff' }}>ProtoVid</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: 'uppercase',
              color: '#c4b5fd',
              marginBottom: 20,
            }}
          >
            {eyebrow}
          </div>
          <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.05, color: '#ffffff' }}>{title}</div>
          {subtitle ? (
            <div style={{ fontSize: 30, lineHeight: 1.4, color: '#9aa6bd', marginTop: 26, maxWidth: 940 }}>
              {subtitle}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 26, color: '#8892a6' }}>
          <span style={{ color: '#e2e8f0', fontWeight: 600 }}>Figma Community plugin</span>
          <span>·</span>
          <span>protovid.dasgroupllc.com</span>
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT },
  );
}
