import type { Metadata } from 'next';
import MarketingChrome, { figmaInstallHref } from '../_marketing/Chrome';
import { CHANGELOG, changelogSlug, type ChangelogEntry } from './entries';

const SITE_URL = 'https://protovid.dasgroupllc.com';
const latest = CHANGELOG[0];
const ogImage = `${SITE_URL}/api/og?eyebrow=${encodeURIComponent('Changelog')}&title=${encodeURIComponent(
  latest ? `Version ${latest.version}` : 'ProtoVid updates',
)}&subtitle=${encodeURIComponent(latest?.headline ?? '')}`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'ProtoVid Changelog — New Figma-to-video features & fixes',
  description:
    'Every ProtoVid release: new Figma-to-video export features, improvements, and fixes. See what changed in the Figma prototype video plugin.',
  keywords: [
    'ProtoVid changelog',
    'ProtoVid updates',
    'Figma to video plugin updates',
    'Figma prototype video new features',
  ],
  alternates: { canonical: `${SITE_URL}/changelog` },
  openGraph: {
    title: 'ProtoVid Changelog',
    description: 'New Figma-to-video export features, improvements, and fixes in every release.',
    url: `${SITE_URL}/changelog`,
    siteName: 'ProtoVid',
    type: 'website',
    images: [{ url: ogImage, width: 1200, height: 630, alt: 'ProtoVid changelog' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ProtoVid Changelog',
    description: 'New Figma-to-video export features, improvements, and fixes in every release.',
    images: [ogImage],
  },
};

function Category({ label, tone, items }: { label: string; tone: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="log-category">
      <span className="log-tag" data-tone={tone}>{label}</span>
      <ul className="log-list">
        {items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    </div>
  );
}

function Entry({ entry }: { entry: ChangelogEntry }) {
  const slug = changelogSlug(entry.version);
  return (
    <article className="log-entry" id={slug}>
      <header className="log-head">
        <a href={`#${slug}`} className="log-version">Version {entry.version}</a>
        <time dateTime={entry.isoDate} className="log-date">{entry.date}</time>
      </header>
      <h2 className="log-headline">{entry.headline}</h2>
      <Category label="New" tone="new" items={entry.new} />
      <Category label="Improved" tone="improved" items={entry.improved} />
      <Category label="Fixed" tone="fixed" items={entry.fixed} />
    </article>
  );
}

export default function ChangelogPage() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'ProtoVid changelog',
    itemListElement: CHANGELOG.map((e, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: `Version ${e.version} — ${e.headline}`,
      url: `${SITE_URL}/changelog#${changelogSlug(e.version)}`,
    })),
  };

  return (
    <MarketingChrome installSource="changelog">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <main className="doc-main">
        <div className="container doc-narrow">
          <p className="doc-eyebrow">Changelog</p>
          <h1 className="doc-title">What&rsquo;s new in ProtoVid</h1>
          <p className="doc-lead">
            Every release of the Figma-to-video plugin — new export features, improvements, and fixes.
            Updates ship to the <a href={figmaInstallHref('changelog_intro')}>Figma Community</a> automatically.
          </p>
          <div className="log-stream">
            {CHANGELOG.map(entry => <Entry key={entry.version} entry={entry} />)}
          </div>
          <section className="doc-cta">
            <h2>Get the latest version</h2>
            <p>Install ProtoVid from the Figma Community and you&rsquo;re always on the newest release.</p>
            <a href={figmaInstallHref('changelog_cta')} className="btn btn-primary btn-large">Install from Figma Community</a>
          </section>
        </div>
      </main>
    </MarketingChrome>
  );
}
