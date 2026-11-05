import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import MarketingChrome, { figmaInstallHref } from '../../_marketing/Chrome';
import { COMPARE_PAGES, COMPARE_SLUGS } from '../data';

const SITE_URL = 'https://protovid.dasgroupllc.com';

export function generateStaticParams() {
  return COMPARE_SLUGS.map(slug => ({ slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const page = COMPARE_PAGES[slug];
  if (!page) return {};
  const ogImage = `${SITE_URL}/api/og?eyebrow=${encodeURIComponent('Comparison')}&title=${encodeURIComponent(
    `ProtoVid vs ${page.alternativeName}`,
  )}&subtitle=${encodeURIComponent(page.description.slice(0, 120))}`;
  const url = `${SITE_URL}/compare/${slug}`;
  return {
    metadataBase: new URL(SITE_URL),
    title: page.title,
    description: page.description,
    keywords: page.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: page.title,
      description: page.description,
      url,
      siteName: 'ProtoVid',
      type: 'article',
      images: [{ url: ogImage, width: 1200, height: 630, alt: page.h1 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: page.title,
      description: page.description,
      images: [ogImage],
    },
  };
}

export default async function ComparePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = COMPARE_PAGES[slug];
  if (!page) notFound();

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: page.h1,
    description: page.description,
    url: `${SITE_URL}/compare/${slug}`,
    about: ['ProtoVid', page.alternativeName],
    publisher: { '@type': 'Organization', name: 'Das Group' },
  };

  return (
    <MarketingChrome installSource={`compare_${slug.replace(/-/g, '_')}`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <main className="doc-main">
        <div className="container doc-narrow">
          <p className="doc-eyebrow">Comparison</p>
          <h1 className="doc-title">{page.h1}</h1>
          <p className="doc-lead">{page.intro}</p>

          <div className="compare-wrap">
            <table className="compare-table">
              <thead>
                <tr>
                  <th scope="col">&nbsp;</th>
                  <th scope="col" className="compare-ours">ProtoVid</th>
                  <th scope="col">{page.alternativeName}</th>
                </tr>
              </thead>
              <tbody>
                {page.rows.map(row => (
                  <tr key={row.dimension}>
                    <th scope="row">{row.dimension}</th>
                    <td className="compare-ours">
                      <span className="compare-mark" data-win={row.protovidWins}>{row.protovidWins ? '✓' : '–'}</span>
                      {row.protovid}
                    </td>
                    <td>{row.alternative}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="doc-note">
            <strong>Where {page.alternativeName.toLowerCase()} is the better choice</strong>
            <p>{page.fairNote}</p>
          </div>

          <p className="doc-verdict">{page.verdict}</p>

          <section className="doc-cta">
            <h2>Try ProtoVid on your own flow</h2>
            <p>Install free, pick your frames, and export a clean walkthrough in minutes.</p>
            <a href={figmaInstallHref(`compare_${slug.replace(/-/g, '_')}_cta`)} className="btn btn-primary btn-large">Install from Figma Community</a>
          </section>

          <nav className="doc-related" aria-label="Other comparisons">
            {COMPARE_SLUGS.filter(s => s !== slug).map(s => (
              <a key={s} href={`/compare/${s}`}>ProtoVid vs {COMPARE_PAGES[s].alternativeName} →</a>
            ))}
          </nav>
        </div>
      </main>
    </MarketingChrome>
  );
}
