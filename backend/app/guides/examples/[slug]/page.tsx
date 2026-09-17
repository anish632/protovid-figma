import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import examples from '../examples.json';

export function generateStaticParams() { return examples.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params; const item = examples.find(item => item.slug === slug);
  return { title: item ? `${item.title} — ProtoVid` : 'ProtoVid guide', description: item?.outcome,
    alternates: { canonical: `https://protovid.dasgroupllc.com/guides/examples/${slug}` } };
}
export default async function ExamplePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const item = examples.find(item => item.slug === slug);
  if (!item) notFound();
  return <main style={{ maxWidth: 820, margin: '0 auto', padding: '48px 24px 80px', fontFamily: 'system-ui, sans-serif', lineHeight: 1.7, color: '#173e32' }}>
    <a href="/guides/first-export">ProtoVid first-export guide</a>
    <h1 style={{ fontSize: 'clamp(32px, 6vw, 48px)', lineHeight: 1.15 }}>{item.title}</h1>
    <p>{item.outcome}</p><p><strong>Worked example: {item.project}.</strong> {item.honesty}</p>
    <aside style={{ border: "1px solid #aec5b9", padding: 24, borderRadius: 12 }}><h2>Start from a connected example</h2><p>In ProtoVid v1.3.22, open the plugin on a page with no connected flow, expand <strong>Try a ready-connected example</strong>, and choose the matching example. ProtoVid creates these three editable screens and their connections on a new page. If your version has only one starter example, follow the instructions below.</p><p>Creating the example does not use an export. Exporting it uses your normal allowance.</p></aside>
    <h2>Or build these three screens</h2>
    <p>Create three 1280 × 720 frames on one Figma page at x=0, 1400, and 2800. Use a #F5F7F4 background, #173E32 headings, and Inter. Put each title at (64,168), size 48; body at (64,252), size 28; and a 360 × 64 button at (64,520), with a white 24px label.</p>
    {item.frames.map(frame => <section key={frame.name} style={{ border: '1px solid #aec5b9', padding: 24, borderRadius: 12, margin: '20px 0' }}>
      <p>{frame.name}</p><h3>{frame.title}</h3><p>{frame.body}</p><p>Button label: <strong>{frame.button}</strong></p>
    </section>)}
    <p>These storyboards describe the editable example. You can create it inside the plugin or build it with the instructions above.</p>
    <h2>Connect, export, check</h2>
    <ol>
      <li>Connect frame 1 to 2, then 2 to 3: On click → Navigate to → Dissolve, 300 ms, Ease in and out. Set frame 1 as the starting point; leave frame 3 without an outgoing link.</li>
      <li>Open ProtoVid on the same page. Refresh the flow and check the order. Choose MP4 and 720p. Use a two-second frame duration if your version offers it.</li>
      <li>Export and download the proof. Play it through to check text, crop, transitions, and watermark. The free allowance is one watermarked export per month, so choose one example to try first.</li>
    </ol>
    <p>Expect three screens joined by dissolves. Exact runtime depends on export settings. No cursor, voiceover, captions, or live application behavior is implied.</p>
    <h2>Use it in your work</h2><p>{item.usage}</p>
    <p>Keep a master page and duplicate it for the next delivery. Replace the screen content and check connections before exporting again.</p>
    <p>Need a clean final file? Project Pass is a one-time payment for seven days of paid exports. Studio is a recurring monthly subscription. <a href="/pricing">Check current prices and billing terms</a>.</p>
    <a href={`/api/referrals/figma?source=guide_${slug.replaceAll('-', '_')}`} style={{ display: 'inline-block', background: '#173e32', color: 'white', padding: '12px 18px', borderRadius: 8 }}>Try your first MP4 in ProtoVid</a>
    <p><a href="/guides/first-export">Troubleshoot a missing connected flow</a></p>
  </main>;
}
