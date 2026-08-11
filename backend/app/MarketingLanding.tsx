import { LARGE_FLOW_PASS, MONTHLY_PRICE_5 } from '@/lib/pricingExperiment';

export default function MarketingLanding() {
  const monthlyPriceLabel = MONTHLY_PRICE_5.label.replace('/mo', '/month');
  const projectPassLabel = LARGE_FLOW_PASS.label;
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'ProtoVid',
    description: 'Figma plugin that turns connected prototype flows into MP4 walkthroughs, review rooms, and decision briefs',
    applicationCategory: 'DesignApplication',
    operatingSystem: 'Figma',
    offers: [
      {
        '@type': 'Offer',
        name: 'Free',
        price: '0',
        priceCurrency: 'USD',
        description: '3 watermarked 720p exports per month',
      },
      {
        '@type': 'Offer',
        name: 'Project Pass',
        price: String(LARGE_FLOW_PASS.amountCents / 100),
        priceCurrency: 'USD',
        description: `${LARGE_FLOW_PASS.accessDays} days of unlimited 1080p and 4K MP4 exports with no watermark, no subscription`,
      },
      {
        '@type': 'Offer',
        name: 'Pro',
        price: String(MONTHLY_PRICE_5.amountCents / 100),
        priceCurrency: 'USD',
        billingIncrement: 'Month',
        description: `Unlimited 1080p and 4K MP4 exports, no watermark, ${monthlyPriceLabel} subscription`,
      },
    ],
    featureList: [
      'Connected prototype flow detection',
      'MP4 walkthrough export',
      '720p Free output',
      '1080p and 4K Project Pass and Pro output',
      'Watermark removal with Project Pass or Pro',
      'Shareable review rooms with timestamped feedback and approval',
      'On-platform review briefs without a separate AI account',
      'Client-ready decision artifacts',
    ],
  };

  return (
    <>
      <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
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
            <h1>Turn Figma flows into<br /><em>product decisions.</em></h1>
            <p className="subtitle">Export the connected path to MP4, send one browser link, and get a review brief, walkthrough script, timestamped feedback, approval, and lightweight delivery analytics.</p>
            <div className="hero-buttons">
              <a href="/api/referrals/figma?source=marketing_landing" className="btn btn-primary btn-large">Install from Figma Community</a>
              <a href="#how-it-works" className="btn btn-secondary btn-large">See how it works</a>
            </div>
            <div className="hero-image">
              <div className="demo-window" role="img" aria-label="A connected Figma prototype flow becoming an MP4 walkthrough">
                <div className="demo-window-top"><span>Connected prototype flow → MP4</span><span className="demo-status">Flow detected</span></div>
                <div className="demo-flow">
                  <div className="demo-frame"><strong>Home</strong><span></span><span></span><i className="demo-arrow">→</i></div>
                  <div className="demo-frame"><strong>Checkout</strong><span></span><span></span><i className="demo-arrow">→</i></div>
                  <div className="demo-frame"><strong>Success</strong><span></span><span></span></div>
                </div>
                <div className="demo-output"><span className="demo-play">▶</span><div className="demo-output-copy"><strong>prototype review room</strong><small>3 connected frames · MP4 · decision brief · approval</small></div><span className="demo-badge">Ready</span></div>
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
                <span className="label">On-platform review context</span>
              </div>
              <div className="stat">
                <span className="number">720p</span>
                <span className="label">Free proof output</span>
              </div>
              <div className="stat">
                <span className="number">1080p / 4K</span>
                <span className="label">Pro — no watermark</span>
              </div>
              <div className="stat">
                <span className="number">Approval</span>
                <span className="label">Owner-managed review status</span>
              </div>
            </div>
          </div>
        </section>
      
        {/*FEATURES*/}
        <section className="features" id="features">
          <div className="container">
            <div className="section-header">
              <span className="section-label">Features</span>
              <h2 className="section-title">From connected flow to decision-ready review</h2>
              <p className="section-subtitle">ProtoVid follows the prototype path you already built in Figma, then packages the walkthrough with the context reviewers need to make a decision.</p>
            </div>
            <div className="feature-grid">
              <div className="feature-card">
                <div className="feature-icon">🔍</div>
                <h3>Automatically detect the flow</h3>
                <p>ProtoVid finds connected prototype frames on the current Figma page and shows the detected order before you export.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🎬</div>
                <h3>Share one review room</h3>
                <p>Send a browser link where clients and teammates can watch, leave timestamped feedback, and approve or request changes.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">⚡</div>
                <h3>Generate a review brief</h3>
                <p>Every share link includes a local decision brief, walkthrough script, review focus, and next steps without a separate AI account.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">📐</div>
                <h3>Client-ready Pro output</h3>
                <p>Pro unlocks 1080p and 4K MP4 exports without the ProtoVid watermark for stakeholder delivery.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🔄</div>
                <h3>Track delivery signal</h3>
                <p>Private owner links show view count, flow size, review type, comments, and approval status for each walkthrough.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🚀</div>
                <h3>Free proof before you pay</h3>
                <p>Start with 3 watermarked 720p MP4 exports per month. Upgrade when the final decision artifact needs to be client-ready.</p>
              </div>
            </div>
          </div>
        </section>
      
        {/*USE CASES*/}
        <section className="use-cases" id="use-cases">
          <div className="container">
            <div className="section-header">
              <span className="section-label">Made for the handoff</span>
              <h2 className="section-title">Show the product decision in the moments that matter</h2>
              <p className="section-subtitle">Create a focused prototype review for the people who need to understand, critique, and approve the experience quickly.</p>
            </div>
            <div className="use-case-grid">
              <div className="use-case">Client walkthroughs</div>
              <div className="use-case">Product demos</div>
              <div className="use-case">Design reviews</div>
              <div className="use-case">Portfolio case studies</div>
              <div className="use-case">Stakeholder updates</div>
              <div className="use-case">Pitch decks and presentations</div>
            </div>
          </div>
        </section>
      
        {/*HOW IT WORKS*/}
        <section className="how-it-works" id="how-it-works">
          <div className="container">
            <div className="how-grid">
              <div>
                <span className="section-label">How it works</span>
              <h2 className="section-title">Three steps from prototype to decision</h2>
              <p className="section-subtitle">Turn a connected Figma prototype into a downloadable walkthrough and shareable review room with a simple export path.</p>
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
                      <p>Review the flow and choose MP4 output quality: 720p Free, or 1080p / 4K Pro.</p>
                    </div>
                  </div>
                  <div className="step">
                    <div className="step-num">3</div>
                    <div className="step-text">
                      <h4>Share</h4>
                      <p>Create the MP4 walkthrough, review brief, timestamped feedback room, and approval link.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="how-image">
                <div className="demo-steps" role="img" aria-label="Three steps: connect frames, export a video, share the MP4">
                  <div className="demo-step"><span className="demo-step-number">1</span><div><strong>Detect the connected flow</strong><span>ProtoVid reads the path you defined in Figma's Prototype panel.</span></div></div>
                  <div className="demo-step"><span className="demo-step-number">2</span><div><strong>Choose output quality</strong><span>Review the frames, then select 720p Free or 1080p / 4K Pro.</span></div></div>
                  <div className="demo-step"><span className="demo-step-number">3</span><div><strong>Share the decision room</strong><span>Use the walkthrough, generated brief, comments, and approval state in handoff.</span></div></div>
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
                <p>Captured frames are used in the plugin for local MP4 encoding when supported. If fallback transcoding is needed, the plugin sends the fallback video payload to ProtoVid's encoding endpoint.</p>
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
              <h2 className="section-title">Designed for the moment a prototype leaves Figma</h2>
              <p className="section-subtitle">A simple export path for client delivery and repeat design iteration.</p>
            </div>
            <div className="faq-grid">
              <div className="faq-item"><h3>Do I need to screen record?</h3><p>No. ProtoVid captures connected prototype frames and produces an MP4 walkthrough directly from the plugin.</p></div>
              <div className="faq-item"><h3>Can I try it before paying?</h3><p>Yes. The Free plan includes 3 watermarked 720p exports each month so you can validate the workflow.</p></div>
              <div className="faq-item"><h3>When do I need Pro?</h3><p>Upgrade when you need 1080p or 4K output, no watermark, or unlimited exports for ongoing client work.</p></div>
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
              <h2 className="section-title">Choose the review workflow you need</h2>
              <p className="section-subtitle">Start with a proof, pay once for a project deadline, or subscribe for ongoing client and stakeholder decisions.</p>
            </div>
            <div className="pricing-grid">
              <div className="pricing-card">
                <div className="plan-name">Free</div>
                <div className="plan-price">
                  <span className="amount">$0</span>
                  <span className="period">/month</span>
                </div>
                <ul className="plan-features">
                  <li><span className="check">✓</span> 3 exports per month</li>
                  <li><span className="check">✓</span> 720p resolution</li>
                  <li><span className="check">✓</span> MP4 output</li>
                  <li><span className="check">✓</span> Auto flow detection</li>
                  <li><span className="check">✓</span> Review brief</li>
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
                  <li><span className="check">✓</span> 1080p and 4K MP4 output</li>
                  <li><span className="check">✓</span> No ProtoVid watermark</li>
                  <li><span className="check">✓</span> Review room and decision brief</li>
                  <li><span className="check">✓</span> No subscription</li>
                </ul>
                <a href="https://protovid.dasgroupllc.com/pricing?plan=project" className="btn btn-primary">Buy Project Pass</a>
              </div>
              <div className="pricing-card">
                <div className="plan-name">Pro</div>
                <div className="plan-price">
                  <span className="amount">{monthlyPriceLabel}</span>
                </div>
                <ul className="plan-features">
                  <li><span className="check">✓</span> 1080p and 4K MP4 output</li>
                  <li><span className="check">✓</span> No ProtoVid watermark</li>
                  <li><span className="check">✓</span> Unlimited exports</li>
                  <li><span className="check">✓</span> Review rooms, briefs, and owner analytics</li>
                </ul>
                <a href="https://protovid.dasgroupllc.com/pricing?plan=pro" className="btn btn-secondary">Choose ongoing Pro</a>
              </div>
            </div>
          </div>
        </section>
      
        {/*CTA*/}
        <section className="cta-section" id="install">
          <div className="container">
            <span className="section-label">Get started</span>
            <h2 className="section-title">Ready to share your first decision room?</h2>
            <p className="section-subtitle">Install ProtoVid from the Figma Community, connect your prototype flow, and create an MP4 review with decision context in minutes.</p>
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
              <a href="https://protovid.dasgroupllc.com/pricing">Pro pricing</a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
