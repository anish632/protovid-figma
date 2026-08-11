import { notFound } from 'next/navigation';
import { getShare } from '@/lib/shareStorage';
import ReviewRoom from './ReviewRoom';

export const dynamic = 'force-dynamic';

export default async function SharePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ owner?: string }> }) {
  const { id } = await params;
  const { owner } = await searchParams;
  const share = await getShare(id);
  if (!share) notFound();
  const installHref = `/api/referrals/figma?source=review_room&shareId=${encodeURIComponent(share.id)}`;
  const footerInstallHref = `/api/referrals/figma?source=review_room_footer&shareId=${encodeURIComponent(share.id)}`;

  return (
    <main style={{ minHeight: '100vh', padding: '48px 20px', background: '#08111f', color: '#e5e7eb', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #7c6ef0, #ec4899)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800 }}>P</div>
          <strong style={{ color: '#fff' }}>ProtoVid review</strong>
        </div>
        <section style={{ padding: 20, borderRadius: 20, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <video controls playsInline preload="metadata" style={{ display: 'block', width: '100%', borderRadius: 12, background: '#000' }} src={`/api/shares/${share.id}/video`} />
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginTop: 18 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, color: '#fff' }}>{share.filename}</h1>
              <p style={{ margin: '6px 0 0', color: '#94a3b8' }}>{share.frameCount} frames · {share.resolution} · Link expires {new Date(share.expiresAt).toLocaleDateString()}</p>
            </div>
            <a href={`/api/shares/${share.id}/video`} download={share.filename} style={{ display: 'inline-flex', padding: '11px 16px', borderRadius: 10, background: '#fff', color: '#0f172a', fontWeight: 700, textDecoration: 'none' }}>Download MP4</a>
          </div>
        </section>
        {owner && <section style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          <div style={{ padding: 16, borderRadius: 16, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Video views</div>
            <strong style={{ display: 'block', marginTop: 4, color: '#fff', fontSize: 24 }}>{share.viewCount}</strong>
          </div>
          <div style={{ padding: 16, borderRadius: 16, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Flow size</div>
            <strong style={{ display: 'block', marginTop: 4, color: '#fff', fontSize: 24 }}>{share.frameCount}</strong>
          </div>
          <div style={{ padding: 16, borderRadius: 16, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Review type</div>
            <strong style={{ display: 'block', marginTop: 4, color: '#fff', fontSize: 18 }}>{share.decisionBrief.signals.reviewMode.replace('-', ' ')}</strong>
          </div>
        </section>}
        <section style={{ marginTop: 18, padding: 20, borderRadius: 20, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ maxWidth: 660 }}>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a5b4fc' }}>On-platform review brief</div>
              <h2 style={{ margin: '5px 0 0', color: '#fff', fontSize: 20 }}>Product decision context</h2>
              <p style={{ margin: '8px 0 0', color: '#cbd5e1', lineHeight: 1.6, fontSize: 14 }}>{share.decisionBrief.summary}</p>
            </div>
            <span style={{ padding: '7px 10px', borderRadius: 999, background: 'rgba(124,110,240,0.16)', color: '#ddd6fe', fontSize: 12, fontWeight: 700 }}>
              {share.decisionBrief.signals.reviewMode.replace('-', ' ')}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginTop: 16 }}>
            <div>
              <h3 style={{ margin: 0, color: '#fff', fontSize: 15 }}>Walkthrough Script</h3>
              <p style={{ margin: '8px 0 0', color: '#94a3b8', fontSize: 13, lineHeight: 1.6 }}>{share.decisionBrief.walkthroughScript}</p>
            </div>
            <div>
              <h3 style={{ margin: 0, color: '#fff', fontSize: 15 }}>Review Focus</h3>
              <ul style={{ display: 'grid', gap: 7, margin: '8px 0 0', paddingLeft: 18, color: '#94a3b8', fontSize: 13, lineHeight: 1.5 }}>
                {share.decisionBrief.reviewFocus.map(item => <li key={item}>{item}</li>)}
              </ul>
            </div>
            <div>
              <h3 style={{ margin: 0, color: '#fff', fontSize: 15 }}>Decision Memo</h3>
              <ul style={{ display: 'grid', gap: 7, margin: '8px 0 0', paddingLeft: 18, color: '#94a3b8', fontSize: 13, lineHeight: 1.5 }}>
                {share.decisionBrief.decisionMemo.map(item => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </div>
        </section>
        <ReviewRoom shareId={share.id} ownerToken={owner} nextSteps={share.decisionBrief.nextSteps} />
        <section style={{ marginTop: 20, padding: 18, borderRadius: 16, background: 'rgba(124,110,240,0.12)', border: '1px solid rgba(196,181,253,0.2)' }}>
          <strong style={{ color: '#fff' }}>Turn your own Figma flow into a review room</strong>
          <p style={{ margin: '6px 0 12px', color: '#cbd5e1', lineHeight: 1.5, fontSize: 14 }}>Export free, send one link, and collect timestamped feedback and approval without asking reviewers to open Figma.</p>
          <a href={installHref} style={{ display: 'inline-flex', padding: '10px 14px', borderRadius: 9, background: '#fff', color: '#0f172a', fontWeight: 700, textDecoration: 'none' }}>Create yours free</a>
        </section>
        <p style={{ marginTop: 14, color: '#94a3b8', fontSize: 13 }}>Created with <a href={footerInstallHref} style={{ color: '#c4b5fd' }}>ProtoVid for Figma</a>.</p>
      </div>
    </main>
  );
}
