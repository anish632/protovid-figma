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
    description: 'Self-serve Figma plugin for agencies and product teams to export connected prototype flows, invite unlimited reviewers, collect timestamped feedback, and record approval.',
    applicationCategory: 'DesignApplication',
    applicationSubCategory: 'Figma Plugin',
    operatingSystem: 'Figma',
    url: siteUrl,
    downloadUrl: 'https://www.figma.com/community/plugin/1606994616321079154',
    installUrl: 'https://www.figma.com/community/plugin/1606994616321079154',
    softwareVersion: '1.3.21',
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
        description: `${LARGE_FLOW_PASS.accessDays} days of unlimited 1080p and 4K exports, review rooms, approval links, and no watermark, no subscription`,
      },
      {
        '@type': 'Offer',
        name: 'Studio',
        price: String(STUDIO_MONTHLY.amountCents / 100),
        priceCurrency: 'USD',
        billingIncrement: 'Month',
        description: `One creator account, unlimited reviewers, 30-day approval rooms, and unlimited HD/4K exports for ${monthlyPriceLabel}`,
      },
    ],
    featureList: [
      'Connected prototype flow detection',
      'MP4, WebM, and GIF product demo export',
      '720p Free output',
      '1080p and 4K Project Pass and Studio output',
      'Watermark removal with Project Pass or Studio',
      'Shareable review rooms with timestamped feedback and approval',
      'On-platform review briefs without a separate AI account',
      'Launch-ready approval packages for client and stakeholder signoff',
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
    description: 'Turn Figma prototypes into product demo videos, review rooms, and approval links.',
    publisher: { '@id': `${siteUrl}/#organization` },
    inLanguage: 'en-US',
  };

  const howTo = {
    '@type': 'HowTo',
    '@id': `${siteUrl}/#howto`,
    name: 'How to turn a Figma prototype into an approval-ready demo package',
    description: 'Export a connected Figma prototype flow as an MP4, WebM, or GIF demo package with a review room in three steps with ProtoVid.',
    totalTime: 'PT2M',
    tool: [{ '@type': 'HowToTool', name: 'Figma' }, { '@type': 'HowToTool', name: 'ProtoVid plugin' }],
    step: [
      { '@type': 'HowToStep', position: 1, name: 'Detect', text: 'ProtoVid finds the connected prototype flow on your Figma page and shows the frames in order.' },
      { '@type': 'HowToStep', position: 2, name: 'Configure', text: 'Review the flow, choose MP4, WebM, or GIF, then select 720p Free or 1080p / 4K paid quality.' },
      { '@type': 'HowToStep', position: 3, name: 'Share', text: 'Create the demo export, then download it or share a review brief, timestamped feedback room, and approval link.' },
    ],
  };

  const faqPage = {
    '@type': 'FAQPage',
    '@id': `${siteUrl}/#faq`,
    mainEntity: [
      { '@type': 'Question', name: 'Do I need to screen record a Figma prototype?', acceptedAnswer: { '@type': 'Answer', text: 'No. ProtoVid captures connected prototype frames and produces MP4, WebM, or GIF walkthrough exports directly from the plugin — no screen recording or editing timeline.' } },
      { '@type': 'Question', name: 'How is ProtoVid different from Figma Motion video export?', acceptedAnswer: { '@type': 'Answer', text: 'Figma Motion exports an animated top-level frame. ProtoVid exports a connected multi-screen prototype path as a client walkthrough video for delivery, demos, and reviews.' } },
      { '@type': 'Question', name: 'Can I try ProtoVid before paying?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. The Free plan includes 1 watermarked 720p export each month so you can validate the workflow before upgrading.' } },
      { '@type': 'Question', name: 'When do I need paid access?', acceptedAnswer: { '@type': 'Answer', text: `Use Project Pass (${LARGE_FLOW_PASS.label}, ${LARGE_FLOW_PASS.accessDays} days) for one deadline. Use Studio (${monthlyPriceLabel}) for recurring client and stakeholder review with unlimited external reviewers.` } },
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
            <h1>Export your Figma prototype<br /><em>for client delivery.</em></h1>
            <p className="subtitle">Turn your Figma flow into a client-ready MP4, WebM, or GIF. Update the design and export the revision with saved settings. Start with a free watermarked proof, then finish your deadline with seven days of unlimited exports.</p>
            <div className="hero-buttons">
              <a href="/api/referrals/figma?source=marketing_landing" className="btn btn-primary btn-large">Install from Figma Community</a>
              <a href="/guides/first-export" className="btn btn-secondary btn-large">Try a guided example</a>
            </div>
            <div className="hero-image">
              <div className="demo-window" role="img" aria-label="A connected Figma prototype flow becoming a product demo video">
                <div className="demo-window-top"><span>Connected prototype flow → demo video</span><span className="demo-status">Flow detected</span></div>
                <div className="demo-flow">
                  <div className="demo-frame"><strong>Home</strong><span></span><span></span><i className="demo-arrow">→</i></div>
                  <div className="demo-frame"><strong>Checkout</strong><span></span><span></span><i className="demo-arrow">→</i></div>
                  <div className="demo-frame"><strong>Success</strong><span></span><span></span></div>
                </div>
                <div className="demo-output"><span className="demo-play">▶</span><div className="demo-output-copy"><strong>approval-ready product demo</strong><small>3 connected frames · MP4/WebM/GIF · approval link optional</small></div><span className="demo-badge">Ready</span></div>
              </div>
            </div>
          </div>
        </section>
      
        {/*SOCIAL PROOF*/}
        <section className="social-proof">
          <div className="container">
            <div className="stats">
              <div className="stat">
                <span className="number">Brief</span>
                <span className="label">Product demo context</span>
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
                <span className="number">Approval</span>
                <span className="label">Optional review status</span>
              </div>
            </div>
          </div>
        </section>
      
        {/*FEATURES*/}
        <section className="features" id="features">
          <div className="container">
            <div className="section-header">
              <span className="section-label">Features</span>
              <h2 className="section-title">From connected flow to approval-ready asset</h2>
              <p className="section-subtitle">ProtoVid follows the prototype path you already built in Figma, then packages the demo, feedback, and approval state in one shareable delivery link.</p>
            </div>
            <div className="feature-grid">
              <div className="feature-card">
                <div className="feature-icon">🔍</div>
                <h3>Automatically detect the flow</h3>
                <p>ProtoVid finds connected prototype frames on the current Figma page and shows the detected order before you export.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🎬</div>
                <h3>Create a polished product demo</h3>
                <p>Export a clean walkthrough file for launches, client updates, portfolios, app previews, and social posts without opening a video editor.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">⚡</div>
                <h3>Share one approval room</h3>
                <p>When you need feedback, send a browser link with a local decision brief, walkthrough script, timestamped comments, and approval state.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">📐</div>
                <h3>Client-ready paid output</h3>
                <p>Paid access unlocks 1080p and 4K exports without the ProtoVid watermark, plus review rooms for stakeholder delivery.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🔄</div>
                <h3>Track delivery signal</h3>
                <p>Private owner links show view count, flow size, review type, comments, and approval status for each walkthrough.</p>
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
              <p className="section-subtitle">Give every reviewer a clear artifact, a timestamped place to respond, and an explicit approval state without provisioning another paid seat.</p>
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
              <h2 className="section-title">Three steps from prototype to demo video</h2>
              <p className="section-subtitle">Turn a connected Figma prototype into a downloadable product demo and optional review room with a simple export path.</p>
                <div className="steps">
                  <div className="step">
                    <div className="step-num">1</div>
                    <div className="step-text">
                      <h4>Detect</h4>
                      <p>ProtoVid finds the connected prototype flow and shows the frames in order.</p>
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
                      <h4>Share</h4>
                      <p>Create the demo export, then share a review brief, timestamped feedback room, and approval link when the project needs it.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="how-image">
                <div className="demo-steps" role="img" aria-label="Three steps: connect frames, export a product demo video, share the review room">
                  <div className="demo-step"><span className="demo-step-number">1</span><div><strong>Detect the connected flow</strong><span>ProtoVid reads the path you defined in Figma's Prototype panel.</span></div></div>
                  <div className="demo-step"><span className="demo-step-number">2</span><div><strong>Choose output quality</strong><span>Review the frames, then select 720p Free or 1080p / 4K Studio.</span></div></div>
                  <div className="demo-step"><span className="demo-step-number">3</span><div><strong>Use the finished asset</strong><span>Download the demo, or share the generated brief, comments, and approval state in handoff.</span></div></div>
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
                <p>Creating a review link stores the MP4, generated review brief, and review metadata server-side. Free links are available for 7 days; paid links for 30 days. Expired links are no longer served.</p>
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
              <h2 className="section-title">Designed for the moment a prototype needs approval</h2>
              <p className="section-subtitle">A simple export path for launch assets, client delivery, signoff, and repeat design iteration.</p>
            </div>
            <div className="faq-grid">
              <div className="faq-item"><h3>Do I need to screen record?</h3><p>No. ProtoVid captures connected prototype frames and produces MP4, WebM, or GIF walkthrough exports directly from the plugin.</p></div>
              <div className="faq-item"><h3>How is this different from Figma Motion?</h3><p>Figma Motion exports an animated top-level frame. ProtoVid follows Prototype connections across multiple screens and turns that path into a client walkthrough video.</p></div>
              <div className="faq-item"><h3>Can I try it before paying?</h3><p>Yes. The Free plan includes 1 watermarked 720p export each month so you can validate the workflow.</p></div>
              <div className="faq-item"><h3>When do I need paid access?</h3><p>Use Project Pass when one deadline needs HD/4K output, no watermark, and a 30-day approval room. Use Studio for recurring delivery with unlimited reviewers. Both start online without a sales call.</p></div>
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
              <h2 className="section-title">Choose the approval workflow you need</h2>
              <p className="section-subtitle">Start with a proof, pay once for a launch deadline, or subscribe for ongoing client, portfolio, and stakeholder signoff.</p>
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
                  <li><span className="check">✓</span> Approval room and decision brief</li>
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
                  <li><span className="check">✓</span> 30-day approval rooms and analytics</li>
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
            <h2 className="section-title">Ready to export your first approval-ready demo?</h2>
            <p className="section-subtitle">Install ProtoVid from the Figma Community, connect your prototype flow, and create a clean demo video with optional review and approval context in minutes.</p>
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
