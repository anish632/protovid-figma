import type { Metadata } from 'next';
import { LARGE_FLOW_PASS_DISPLAY } from '@/lib/plans';

export const metadata: Metadata = {
  title: 'Export your first Figma prototype to MP4 — ProtoVid guide',
  description: 'Connect three Figma frames, export a free video proof, and prepare a client walkthrough, launch demo, or portfolio clip.',
  alternates: { canonical: 'https://protovid.dasgroupllc.com/guides/first-export' },
};

export default function FirstExportGuide() {
  return <main style={{ maxWidth: 820, margin: '0 auto', padding: '48px 24px 80px', lineHeight: 1.7, fontFamily: 'Inter, system-ui, sans-serif', color: '#182c22' }}>
    <a href="/">ProtoVid</a>
    <p style={{ marginTop: 36 }}>FIRST EXPORT GUIDE</p>
    <h1 style={{ fontSize: 'clamp(32px, 6vw, 52px)', lineHeight: 1.12 }}>Your Figma prototype, ready for client delivery.</h1>
    <p>Start with three connected screens and make a free 720p video proof. You can check the result before paying for a final version.</p>
    <ol style={{ paddingLeft: 24 }}>
      <li><strong>Connect the screens.</strong> Open a Figma design file with at least two frames on the same page. Select the starting frame, open the Prototype tab, and drag its connection handle to the next frame. Choose Navigate to. Repeat for the next screen.</li>
      <li><strong>Open ProtoVid.</strong> Run the plugin on that page and click Refresh flow. Check the detected order. If your flow branches, choose the route you want to show.</li>
      <li><strong>Export a proof.</strong> Choose MP4 and 720p, then export and download the video. The free plan includes one watermarked export per month. Check transitions and text before sending it.</li>
      <li><strong>Finish the delivery.</strong> For a clean 1080p or 4K version, choose Project Pass ({LARGE_FLOW_PASS_DISPLAY}) after export. It unlocks seven days of unlimited exports without a subscription.</li>
    </ol>
    <aside style={{ border: '1px solid #67ae8b', borderRadius: 12, padding: 24, margin: '28px 0' }}>
      <h2>No connected flow?</h2>
      <p>Frames placed beside each other are not connected automatically. Add a Navigate to interaction in Figma, keep the destination on the same page, then refresh ProtoVid.</p>
      <p>With no connected flow, open the example option in ProtoVid to create three editable screens on a new page. Version 1.3.22 adds a choice of client booking, SaaS task planning, and portfolio examples. Older versions provide a single starter flow. Your original page stays intact.</p>
    </aside>
    <h2>Three walkthroughs to try</h2>
    <ul>
      <li><a href="/guides/examples/client-delivery">Build a client booking walkthrough</a></li>
      <li><a href="/guides/examples/saas-walkthrough">Build a SaaS task-planning walkthrough</a></li>
      <li><a href="/guides/examples/portfolio-case-study">Build a portfolio interaction example</a></li>
    </ul>
    <p><strong>Client delivery:</strong> Connect Overview → Key interaction → Success. Keep the video focused on the decision the client needs to make. Add an optional review link for timestamped feedback.</p>
    <p><strong>SaaS launch:</strong> Connect Dashboard → Core feature → Result. Use a short clip that shows the benefit quickly, then export MP4 for your landing page.</p>
    <p><strong>Portfolio:</strong> Connect Problem → Interaction → Outcome. Export a proof to check legibility, then use the finished clip alongside your case study.</p>
    <h2>Check the finished file</h2>
    <p>Play the downloaded video from beginning to end. Confirm the route, animation, crop, and text. If encoding fails, ProtoVid restores the reserved free export so you can retry. Split very long flows into shorter walkthroughs if needed.</p>
    <a style={{ display: 'inline-block', padding: '12px 18px', borderRadius: 8, background: '#167b45', color: '#fff', textDecoration: 'none' }} href="/api/referrals/figma?source=first_export_guide">Install ProtoVid from Figma Community</a>
    <p><a href="/pricing?plan=project">See Project Pass pricing</a></p>
  </main>;
}
