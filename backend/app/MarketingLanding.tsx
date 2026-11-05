import { LARGE_FLOW_PASS, STUDIO_MONTHLY, STUDIO_YEARLY } from '@/lib/pricingExperiment';

export default function MarketingLanding() {
  const monthlyPriceLabel = STUDIO_MONTHLY.label.replace('/mo', '/month');
  const yearlyPriceLabel = STUDIO_YEARLY.label.replace('/yr', '/year');
  const projectPassLabel = LARGE_FLOW_PASS.label;
  const siteUrl = 'https://protovid.dasgroupllc.com';
  const softwareApplication = {
    '@type': 'SoftwareApplication',
    '@id': `${siteUrl}/#software`,
    name: 'ProtoVid',
    alternateName: 'ProtoVid — Figma Prototype to Product Demo Video',
    description: 'Self-serve Figma plugin for turning connected or unlinked frames into client-ready walkthrough videos, with optional browser-based review links.',
    applicationCategory: 'DesignApplication',
    applicationSubCategory: 'Figma Plugin',
    operatingSystem: 'Figma',
    url: siteUrl,
    downloadUrl: 'https://www.figma.com/community/plugin/1606994616321079154',
    installUrl: 'https://www.figma.com/community/plugin/1606994616321079154',
    softwareVersion: '1.3.26',
    image: `${siteUrl}/logo128x128.png`,
    screenshot: `${siteUrl}/logo128x128.png`,
    publisher: { '@id': `${siteUrl}/#organization` },
    author: { '@id': `${siteUrl}/#organization` },
    offers: [
      {
        '@type': 'Offer',
        name: 'Free',
        price: '0',
        priceCurrency: 'USD',
        description: '1 watermarked 720p export per month',
      },
      {
        '@type': 'Offer',
        name: 'Project Pass',
        price: String(LARGE_FLOW_PASS.amountCents / 100),
        priceCurrency: 'USD',
        description: `${LARGE_FLOW_PASS.accessDays} days of unlimited 1080p and 4K client-ready walkthrough exports with no watermark and no subscription`,
      },
      {
        '@type': 'Offer',
        name: 'Studio',
        price: String(STUDIO_MONTHLY.amountCents / 100),
        priceCurrency: 'USD',
        billingIncrement: 'Month',
        description: `One creator account, unlimited HD/4K walkthrough exports, and review links that stay live for a full year for ${monthlyPriceLabel}`,
      },
    ],
    featureList: [
      'Connected prototype flow detection',
      'MP4, WebM, and GIF product demo export',
      '720p Free output',
      '1080p and 4K Project Pass and Studio output',
      'Watermark removal with Project Pass or Studio',
      'One-click connection for unlinked frames',
      'Shareable browser review links with timestamped feedback',
      'Client delivery for design revisions and launch walkthroughs',
    ],
  };

  const organization = {
    '@type': 'Organization',
    '@id': `${siteUrl}/#organization`,
    name: 'Das Group',
    url: 'https://dasgroupllc.com',
    logo: `${siteUrl}/logo128x128.png`,
    brand: { '@type': 'Brand', name: 'ProtoVid' },
  };

  const website = {
    '@type': 'WebSite',
    '@id': `${siteUrl}/#website`,
    url: siteUrl,
    name: 'ProtoVid',
    description: 'Turn Figma frames into client-ready walkthrough videos without screen recording.',
    publisher: { '@id': `${siteUrl}/#organization` },
    inLanguage: 'en-US',
  };

  const howTo = {
    '@type': 'HowTo',
    '@id': `${siteUrl}/#howto`,
    name: 'How to turn Figma frames into a client-ready walkthrough video',
    description: 'Export connected or unlinked Figma frames as an MP4, WebM, or GIF walkthrough in three steps with ProtoVid.',
    totalTime: 'PT2M',
    tool: [{ '@type': 'HowToTool', name: 'Figma' }, { '@type': 'HowToTool', name: 'ProtoVid plugin' }],
    step: [
      { '@type': 'HowToStep', position: 1, name: 'Choose frames', text: 'ProtoVid finds a connected prototype flow or connects unlinked frames left to right on the current Figma page.' },
      { '@type': 'HowToStep', position: 2, name: 'Configure', text: 'Review the flow, choose MP4, WebM, or GIF, then select 720p Free or 1080p / 4K paid quality.' },
      { '@type': 'HowToStep', position: 3, name: 'Deliver', text: 'Download the demo video or send a browser review link for timestamped feedback when needed.' },
    ],
  };

  const faqPage = {
    '@type': 'FAQPage',
    '@id': `${siteUrl}/#faq`,
    mainEntity: [
      { '@type': 'Question', name: 'Do I need to screen record a Figma prototype?', acceptedAnswer: { '@type': 'Answer', text: 'No. ProtoVid captures connected prototype frames and produces MP4, WebM, or GIF walkthrough exports directly from the plugin — no screen recording or editing timeline.' } },
      { '@type': 'Question', name: 'How is ProtoVid different from Figma Motion video export?', acceptedAnswer: { '@type': 'Answer', text: 'Figma Motion exports an animated top-level frame. ProtoVid turns connected or unlinked multi-screen Figma frames into a client walkthrough video for delivery, demos, and reviews.' } },
      { '@type': 'Question', name: 'Can I try ProtoVid before paying?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. The Free plan includes 1 watermarked 720p export each month so you can validate the workflow before upgrading.' } },
      { '@type': 'Question', name: 'When do I need paid access?', acceptedAnswer: { '@type': 'Answer', text: `Use Project Pass (${LARGE_FLOW_PASS.label}, ${LARGE_FLOW_PASS.accessDays} days) for one deadline. Use Studio (${monthlyPriceLabel}) when delivered work needs to stay live: review links and their comments stay available for a full year instead of 30 days, with unlimited external reviewers.` } },
      { '@type': 'Question', name: 'Can I share a review of the demo?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. After exporting you can create a browser-based review link with a generated decision brief, timestamped comments, and approval or change-request status.' } },
      { '@type': 'Question', name: 'Do I need a separate AI account?', acceptedAnswer: { '@type': 'Answer', text: 'No. ProtoVid generates review context on-platform from export metadata and review-room activity, without a separate AI account or external model.' } },
      { '@type': 'Question', name: 'What formats and resolutions does ProtoVid export?', acceptedAnswer: { '@type': 'Answer', text: 'ProtoVid exports MP4, WebM, and GIF. Free exports are 720p with a watermark; Project Pass and Studio unlock 1080p and 4K with no watermark.' } },
    ],
  };

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [organization, website, softwareApplication, howTo, faqPage],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <div className="landing-page" id="top">
      {/*NAV*/}
        <nav>
          <div className="container">
            <a href="#top" className="nav-logo">
              <img src="/logo128x128.png" alt="ProtoVid" />
              ProtoVid
            </a>
            <div className="nav-links">
              <a href="#features">Features</a>
              <a href="#how-it-works">How it works</a>
              <a href="#faq">FAQ</a>
              <a href="#pricing">Pricing</a>
              <a href="/api/referrals/figma?source=marketing_landing" className="btn btn-primary">Install free</a>
            </div>
          </div>
        </nav>
      
        {/*HERO*/}
        <section className="hero">
          <div className="container">
            <div className="hero-badge">Figma Community plugin <span>— Free to start</span></div>
            <h1>Turn Figma frames into<br /><em>client-ready walkthroughs.</em></h1>
            <p className="subtitle">No prototype wiring? ProtoVid connects your frames left to right, then exports an MP4, WebM, or GIF for client delivery. Start with a free watermarked proof and export polished revisions when your deadline calls for it.</p>
            <div className="hero-buttons">
              <a href="/api/referrals/figma?source=marketing_landing" className="btn btn-primary btn-large">Install from Figma Community</a>
              <a href="/guides/first-export" className="btn btn-secondary btn-large">Try a guided example</a>
            </div>
            <div className="hero-image">
              <div className="demo-window" role="img" aria-label="Figma frames becoming a client-ready walkthrough video">
                <div className="demo-window-top"><span>Figma frames → client walkthrough</span><span className="demo-status">Ready to export</span></div>
                <div className="demo-flow">
                  <div className="demo-frame"><strong>Home</strong><span></span><span></span><i className="demo-arrow">→</i></div>
                  <div className="demo-frame"><strong>Checkout</strong><span></span><span></span><i className="demo-arrow">→</i></div>
                  <div className="demo-frame"><strong>Success</strong><span></span><span></span></div>
                </div>
                <div className="demo-output"><span className="demo-play">▶</span><div className="demo-output-copy"><strong>client-ready walkthrough</strong><small>3 frames · MP4/WebM/GIF · review link optional</small></div><span className="demo-badge">Ready</span></div>
              </div>
            </div>
          </div>
        </section>
      
        {/*SOCIAL PROOF*/}
        <section className="social-proof">
          <div className="container">
            <div className="stats">
              <div className="stat">
                <span className="number">1 click</span>
                <span className="label">Connect unlinked frames</span>
              </div>
              <div className="stat">
                <span className="number">720p</span>
                <span className="label">Free proof output</span>
              </div>
              <div className="stat">
                <span className="number">1080p / 4K</span>
                <span className="label">Studio — no watermark</span>
              </div>
              <div className="stat">
                <span className="number">Review</span>
                <span className="label">Optional browser feedback link</span>
              </div>
            </div>
          </div>
        </section>
      
        {/*FEATURES*/}
        <section className="features" id="features">
          <div className="container">
            <div className="section-header">
              <span className="section-label">Features</span>
              <h2 className="section-title">From Figma frames to a video your client can watch</h2>
              <p className="section-subtitle">ProtoVid handles the last mile between your Figma canvas and a clean walkthrough for a client update, product demo, launch, or portfolio case study.</p>
            </div>
            <div className="feature-grid">
              <div className="feature-card">
                <div className="feature-icon">🔍</div>
                <h3>Start with the frames you have</h3>
                <p>ProtoVid follows connected prototype frames or connects unlinked frames left to right on the current page before you export.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🎬</div>
                <h3>Create a polished product demo</h3>
                <p>Export a clean walkthrough file for launches, client updates, portfolios, app previews, and social posts without opening a video editor.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">⚡</div>
                <h3>Send a clear review link</h3>
                <p>When feedback matters, send one browser link with the walkthrough, timestamped comments, and an approval or changes-needed decision.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">📐</div>
                <h3>Finish the polished version</h3>
                <p>Paid access unlocks clean 1080p and 4K video without the ProtoVid watermark for the version you send outside Figma.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🔄</div>
                <h3>Make revisions without starting over</h3>
                <p>Saved export settings make it fast to create the next walkthrough after you update the design.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🚀</div>
                <h3>Free proof before you pay</h3>
                <p>Start with 1 watermarked 720p export per month. Upgrade when the final demo needs to be client-ready or launch-ready.</p>
              </div>
            </div>
          </div>
        </section>
      
        {/*USE CASES*/}
        <section className="use-cases" id="use-cases">
          <div className="container">
            <div className="section-header">
              <span className="section-label">Made for where demos go</span>
              <h2 className="section-title">Move prototype decisions forward</h2>
              <p className="section-subtitle">Give people outside your Figma file a clean artifact to watch, comment on, and decide from without asking them to learn your design tool.</p>
            </div>
            <div className="use-case-grid">
              <div className="use-case">Agency client approval</div>
              <div className="use-case">Product design reviews</div>
              <div className="use-case">Launch signoff</div>
              <div className="use-case">Engineering handoff</div>
              <div className="use-case">Portfolio case studies</div>
              <div className="use-case">Investor updates</div>
            </div>
          </div>
        </section>
      
        {/*HOW IT WORKS*/}
        <section className="how-it-works" id="how-it-works">
          <div className="container">
            <div className="how-grid">
              <div>
                <span className="section-label">How it works</span>
              <h2 className="section-title">Three steps from Figma canvas to client walkthrough</h2>
              <p className="section-subtitle">Use the connections you already built, or start with unlinked frames, then create a downloadable video in a simple export path.</p>
                <div className="steps">
                  <div className="step">
                    <div className="step-num">1</div>
                    <div className="step-text">
                      <h4>Choose frames</h4>
                      <p>ProtoVid finds the connected flow or connects unlinked frames left to right on the current page.</p>
                    </div>
                  </div>
                  <div className="step">
                    <div className="step-num">2</div>
                    <div className="step-text">
                      <h4>Configure</h4>
                      <p>Review the flow, choose MP4, WebM, or GIF, then select 720p Free or 1080p / 4K paid quality.</p>
                    </div>
                  </div>
                  <div className="step">
                    <div className="step-num">3</div>
                    <div className="step-text">
                      <h4>Deliver</h4>
                      <p>Download the walkthrough, or send a browser review link for timestamped feedback when the project needs it.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="how-image">
                <div className="demo-steps" role="img" aria-label="Three steps: choose Figma frames, export a walkthrough video, send an optional review link">
                  <div className="demo-step"><span className="demo-step-number">1</span><div><strong>Choose the frames</strong><span>ProtoVid follows your Figma prototype path or connects the frames left to right.</span></div></div>
                  <div className="demo-step"><span className="demo-step-number">2</span><div><strong>Choose output quality</strong><span>Review the frames, then select 720p Free or 1080p / 4K Studio.</span></div></div>
                  <div className="demo-step"><span className="demo-step-number">3</span><div><strong>Send the finished walkthrough</strong><span>Download the video or share a browser review link when feedback is needed.</span></div></div>
                </div>
              </div>
            </div>
          </div>
        </section>
      
        {/*PRIVACY / TRUST*/}
        <section className="privacy" id="privacy">
          <div className="container">
            <div className="section-header">
              <span className="section-label">Privacy & data</span>
              <h2 className="section-title">What happens to your prototype data</h2>
              <p className="section-subtitle">A plain-language summary of the current implementation.</p>
            </div>
            <div className="privacy-grid">
              <div className="privacy-card">
                <h3>Scoped to the connected flow</h3>
                <p>ProtoVid scans prototype connections on the current Figma page and captures only the frames in the selected connected path. It does not scan unrelated files.</p>
              </div>
              <div className="privacy-card">
                <h3>Sent when you export</h3>
                <p>Captured frames are used in the plugin for local MP4, WebM, or GIF encoding when supported. If MP4 fallback transcoding is needed, the plugin sends the fallback video payload to ProtoVid's encoding endpoint.</p>
              </div>
              <div className="privacy-card">
                <h3>Review links expire</h3>
                <p>Creating a review link stores the MP4, generated review brief, and review metadata server-side. Free links are available for 7 days, Project Pass links for 30 days, and Studio links for a full year. Expired links are no longer served.</p>
              </div>
            </div>
            <p className="privacy-note">Review briefs are generated from export metadata inside ProtoVid and do not require a separate AI account or external model. Expired review videos, comments, and owner links are physically deleted by a daily retention cleanup.</p>
          </div>
        </section>
      
        {/*FAQ*/}
        <section className="faq" id="faq">
          <div className="container">
            <div className="section-header">
              <span className="section-label">Questions</span>
              <h2 className="section-title">Designed for the moment a Figma file needs to travel</h2>
              <p className="section-subtitle">A simple export path for client delivery, product demos, launch assets, and portfolio walkthroughs.</p>
            </div>
            <div className="faq-grid">
              <div className="faq-item"><h3>Do I need to screen record?</h3><p>No. ProtoVid captures connected prototype frames and produces MP4, WebM, or GIF walkthrough exports directly from the plugin.</p></div>
              <div className="faq-item"><h3>How is this different from Figma Motion?</h3><p>Figma Motion exports an animated top-level frame. ProtoVid follows Prototype connections across multiple screens and turns that path into a client walkthrough video.</p></div>
              <div className="faq-item"><h3>Can I try it before paying?</h3><p>Yes. The Free plan includes 1 watermarked 720p export each month so you can validate the workflow.</p></div>
              <div className="faq-item"><h3>When do I need paid access?</h3><p>Use Project Pass when one deadline needs HD/4K output and no watermark. Use Studio to keep delivered work live — review links and comments stay available for a full year instead of 30 days. Both start online without a sales call.</p></div>
              <div className="faq-item"><h3>Can I share a review?</h3><p>Yes. After exporting, you can create a browser-based review link with a generated decision brief, timestamped comments, and approval or change-request status.</p></div>
              <div className="faq-item"><h3>Do I need a separate AI account?</h3><p>No. ProtoVid generates review context on-platform from export metadata and review-room activity.</p></div>
            </div>
          </div>
        </section>
      
        {/*PRICING*/}
        <section className="pricing" id="pricing">
          <div className="container">
            <div className="section-header">
              <span className="section-label">Pricing</span>
              <h2 className="section-title">Choose the delivery plan you need</h2>
              <p className="section-subtitle">Start with a proof, pay once for a deadline, or subscribe for recurring client walkthroughs.</p>
            </div>
            <div className="pricing-grid">
              <div className="pricing-card">
                <div className="plan-name">Free</div>
                <div className="plan-price">
                  <span className="amount">$0</span>
                  <span className="period">/month</span>
                </div>
                <ul className="plan-features">
                  <li><span className="check">✓</span> 1 export per month</li>
                  <li><span className="check">✓</span> 720p resolution</li>
                  <li><span className="check">✓</span> MP4, WebM, and GIF output</li>
                  <li><span className="check">✓</span> Auto flow detection</li>
                  <li><span className="check">✓</span> Product demo export</li>
                  <li><span className="check">✓</span> ProtoVid watermark</li>
                  <li className="disabled"><span className="check">—</span> 1080p / 4K</li>
                </ul>
                <a href="#install" className="btn btn-secondary">Start Free</a>
              </div>
              <div className="pricing-card featured">
                <div className="plan-name">Project Pass</div>
                <div className="plan-price">
                  <span className="amount">{projectPassLabel}</span>
                </div>
                <ul className="plan-features">
                  <li><span className="check">✓</span> 7 days of unlimited exports</li>
                  <li><span className="check">✓</span> 1080p and 4K output</li>
                  <li><span className="check">✓</span> No ProtoVid watermark</li>
                  <li><span className="check">✓</span> Browser review link when needed</li>
                  <li><span className="check">✓</span> No subscription</li>
                </ul>
                <a href="https://protovid.dasgroupllc.com/pricing?plan=project" className="btn btn-primary">Buy Project Pass</a>
              </div>
              <div className="pricing-card">
                <div className="plan-name">Studio</div>
                <div className="plan-price">
                  <span className="amount">{monthlyPriceLabel}</span>
                </div>
                <ul className="plan-features">
                  <li><span className="check">✓</span> 1080p and 4K output</li>
                  <li><span className="check">✓</span> No ProtoVid watermark</li>
                  <li><span className="check">✓</span> Unlimited exports</li>
                  <li><span className="check">✓</span> One creator account</li>
                  <li><span className="check">✓</span> Unlimited external reviewers</li>
                  <li><span className="check">✓</span> Review links stay live for a full year</li>
                </ul>
                <a href="https://protovid.dasgroupllc.com/pricing" className="btn btn-secondary">Start Studio online</a>
              </div>
            </div>
          </div>
        </section>
      
        {/*CTA*/}
        <section className="cta-section" id="install">
          <div className="container">
            <span className="section-label">Get started</span>
            <h2 className="section-title">Ready to create your first client walkthrough?</h2>
            <p className="section-subtitle">Install ProtoVid from the Figma Community, choose your frames, and create a clean video for delivery in minutes.</p>
            <a href="/api/referrals/figma?source=marketing_landing" className="btn btn-primary btn-large">Install Figma Plugin</a>
            <p className="cta-hint">Or search "ProtoVid" in Figma's plugin library</p>
            <p className="cta-hint">Optional convenience: voice control is available after you explicitly choose to use it.</p>
          </div>
        </section>
      
        {/*FOOTER*/}
        <footer>
          <div className="container">
            <div className="footer-left">© 2026 ProtoVid by Das Group</div>
            <div className="footer-links">
              <a href="mailto:support@protovid.app">Support</a>
              <a href="#privacy">Privacy & data</a>
              <a href="https://protovid.dasgroupllc.com/pricing">Self-serve pricing</a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
