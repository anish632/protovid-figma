import type { ReactNode } from 'react';

// Shared marketing nav + footer so secondary SEO pages (changelog, comparisons)
// match the live landing page. Styling comes from the globally imported
// landing.css, which scopes its tokens under `.landing-page`.

export const FIGMA_COMMUNITY_URL =
  'https://www.figma.com/community/plugin/1606994616321079154';

export function figmaInstallHref(source: string) {
  return `/api/referrals/figma?source=${encodeURIComponent(source)}`;
}

export function MarketingNav({ installSource }: { installSource: string }) {
  return (
    <nav>
      <div className="container">
        <a href="/" className="nav-logo">
          <img src="/logo128x128.png" alt="ProtoVid" />
          ProtoVid
        </a>
        <div className="nav-links">
          <a href="/#how-it-works">How it works</a>
          <a href="/compare/screen-recording">Compare</a>
          <a href="/changelog">Changelog</a>
          <a href="/pricing">Pricing</a>
          <a href={figmaInstallHref(installSource)} className="btn btn-primary">Install free</a>
        </div>
      </div>
    </nav>
  );
}

export function MarketingFooter() {
  return (
    <footer>
      <div className="container">
        <div className="footer-left">© 2026 ProtoVid by Das Group</div>
        <div className="footer-links">
          <a href={figmaInstallHref('footer')}>Figma Community</a>
          <a href="/changelog">Changelog</a>
          <a href="/pricing">Pricing</a>
          <a href="mailto:support@protovid.app">Support</a>
        </div>
      </div>
    </footer>
  );
}

export default function MarketingChrome({
  children,
  installSource,
}: {
  children: ReactNode;
  installSource: string;
}) {
  return (
    <div className="landing-page" id="top">
      <MarketingNav installSource={installSource} />
      {children}
      <MarketingFooter />
    </div>
  );
}
