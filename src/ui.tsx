// ProtoVid - Plugin UI (runs in iframe)
import { h, Fragment, render } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { encodeVideo } from './encoder';

interface AppState {
  stage: 'loading' | 'setup' | 'scanning' | 'exporting' | 'complete' | 'checking-payment';
  hasPrototype: boolean;
  frameCount: number;
  exportCount: number;
  freeLimit: number;
  isPremium: boolean;
  userEmail: string;
  paymentCheckAvailable: boolean;
  pricingVariant: string;
  monthlyPriceLabel: string;
  monthlyAmountCents: number;
  pricingLoadedEmail: string;
  trialExpired: boolean;
  daysSinceFirstExport: number | null;
  settings: {
    resolution: '720p' | '1080p' | '4K';
    format: 'mp4';
    showCursor: boolean;
  };
  progress: {
    stage: string;
    percent: number;
  };
  error: string | null;
  videoUrl: string | null;
  downloadFilename: string | null;
}

const BACKEND_URL = 'https://protovid.dasgroupllc.com';

function App() {
  const [state, setState] = useState<AppState>({
    stage: 'loading',
    hasPrototype: false,
    frameCount: 0,
    exportCount: 0,
    freeLimit: 1,
    isPremium: false,
    userEmail: '',
    paymentCheckAvailable: false,
    pricingVariant: 'monthly_8',
    monthlyPriceLabel: '$8/mo',
    monthlyAmountCents: 800,
    pricingLoadedEmail: '',
    trialExpired: false,
    daysSinceFirstExport: null,
    settings: {
      resolution: '720p',
      format: 'mp4',
      showCursor: true
    },
    progress: {
      stage: '',
      percent: 0
    },
    error: null,
    videoUrl: null,
    downloadFilename: null
  });

  // Email is collected just-in-time at checkout (not before the first export).
  const [needEmail, setNeedEmail] = useState(false);

  const pollTimerRef = useRef<number | null>(null);
  const scanReturnStageRef = useRef<AppState['stage']>('setup');
  const demoStateTrackedRef = useRef(false);
  const paywallViewedRef = useRef(false);
  const pricingEmailRef = useRef('');

  // Stop polling on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  useEffect(() => {
    // Initialize
    parent.postMessage({ pluginMessage: { type: 'init' } }, '*');

    // Listen for messages from plugin code
    window.onmessage = async (event) => {
      const msg = event.data.pluginMessage;
      if (!msg) return;

      switch (msg.type) {
        case 'init-complete':
          setState(prev => ({
            ...prev,
            stage: 'setup',
            hasPrototype: msg.data.hasPrototype,
            frameCount: msg.data.frameCount,
            exportCount: msg.data.exportCount,
            freeLimit: msg.data.freeLimit,
            userEmail: msg.data.savedEmail || '',
            isPremium: msg.data.isPremium || false,
            trialExpired: msg.data.trialExpired || false,
            daysSinceFirstExport: msg.data.daysSinceFirstExport || null
          }));
          break;

        case 'email-saved':
          setState(prev => ({
            ...prev,
            stage: 'setup',
            userEmail: msg.data.email,
            exportCount: msg.data.exportCount,
            freeLimit: msg.data.freeLimit,
            isPremium: msg.data.isPremium || false,
            trialExpired: msg.data.trialExpired || false,
            daysSinceFirstExport: msg.data.daysSinceFirstExport || null
          }));
          break;

        case 'scan-complete':
          const scannedFrameCount = msg.data.frames.length;
          setState(prev => ({
            ...prev,
            stage: 'setup',
            hasPrototype: scannedFrameCount > 0,
            frameCount: scannedFrameCount,
            error: scannedFrameCount > 0 ? null : 'No prototype connections found yet.'
          }));
          break;

        case 'progress':
          setState(prev => ({
            ...prev,
            stage: 'exporting',
            progress: msg.data
          }));
          break;

        case 'encode-frames': {
          const { frames, settings: encSettings } = msg.data;
          const isPremium = msg.data.isPremium === true;
          try {
            const result = await encodeVideo(
              frames.map((f: any) => ({
                imageData: f.imageData instanceof Uint8Array ? f.imageData : new Uint8Array(f.imageData),
                width: f.width,
                height: f.height,
              })),
              encSettings,
              (percent: number) => {
                setState(prev => ({
                  ...prev,
                  progress: { stage: 'encoding', percent }
                }));
              },
              isPremium  // Pass premium flag for watermark
            );

            setState(prev => ({
              ...prev,
              stage: 'complete',
              videoUrl: result.url,
              downloadFilename: result.filename,
            }));

            parent.postMessage({
              pluginMessage: { type: 'encoding-complete', data: { isPremium } }
            }, '*');
          } catch (error: any) {
            parent.postMessage({
              pluginMessage: { type: 'encoding-failed' }
            }, '*');
            setState(prev => ({
              ...prev,
              stage: 'setup',
              error: error.message || 'Video encoding failed'
            }));
          }
          break;
        }

        case 'export-count-updated':
          setState(prev => ({
            ...prev,
            exportCount: msg.data.exportCount
          }));
          break;

        case 'license-validated':
          setState(prev => ({
            ...prev,
            isPremium: msg.data.isValid
          }));
          break;

        case 'checkout-opened':
          // Start auto-polling for payment completion
          startPaymentPolling(msg.data.email);
          break;

        case 'free-limit-reached':
          setState(prev => ({
            ...prev,
            stage: 'setup',
            exportCount: msg.data.exportCount,
            freeLimit: msg.data.freeLimit,
            isPremium: false,
            trialExpired: msg.data.trialExpired || false,
            daysSinceFirstExport: msg.data.daysSinceFirstExport || null,
            paymentCheckAvailable: false,
            error: null
          }));
          break;

        case 'error':
          setState(prev => ({
            ...prev,
            stage: 'setup',
            error: msg.data.message
          }));
          break;
      }
    };
  }, []);

  useEffect(() => {
    const isNoPrototypeSurface = !state.hasPrototype && state.stage === 'setup';
    if (!isNoPrototypeSurface || demoStateTrackedRef.current) return;

    demoStateTrackedRef.current = true;
    parent.postMessage({
      pluginMessage: {
        type: 'track-event',
        data: {
          eventType: 'demo_state_shown',
          metadata: {
            surface: state.stage,
            reason: 'no_prototype'
          }
        }
      }
    }, '*');
  }, [state.hasPrototype, state.stage]);

  useEffect(() => {
    if (state.isPremium || state.exportCount < state.freeLimit) {
      paywallViewedRef.current = false;
      return;
    }
    const pricingReady = state.userEmail
      ? state.pricingLoadedEmail === state.userEmail.toLowerCase().trim()
      : true;
    if (!pricingReady) return;

    if (state.stage === 'setup' && !paywallViewedRef.current) {
      paywallViewedRef.current = true;
      parent.postMessage({
        pluginMessage: {
          type: 'track-event',
          data: {
            eventType: 'paywall_viewed',
            metadata: {
              trigger: 'free_limit_ui_shown',
              exportCount: state.exportCount,
              freeLimit: state.freeLimit,
              pricingVariant: state.pricingVariant,
              priceLabel: state.monthlyPriceLabel,
              amountCents: state.monthlyAmountCents
            }
          }
        }
      }, '*');
    }
  }, [state.isPremium, state.exportCount, state.freeLimit, state.stage, state.userEmail, state.pricingLoadedEmail, state.pricingVariant, state.monthlyPriceLabel, state.monthlyAmountCents]);

  useEffect(() => {
    const email = state.userEmail.toLowerCase().trim();
    if (!email || !email.includes('@') || pricingEmailRef.current === email) return;

    pricingEmailRef.current = email;
    fetch(`${BACKEND_URL}/api/billing/pricing-variant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, plan: 'monthly' })
    })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        setState(prev => {
          if (!data?.pricingVariant || !data?.priceLabel) {
            return { ...prev, pricingLoadedEmail: email };
          }
          return {
            ...prev,
            pricingVariant: data.pricingVariant,
            monthlyPriceLabel: data.priceLabel,
            monthlyAmountCents: data.amountCents || prev.monthlyAmountCents,
            pricingLoadedEmail: email
          };
        });
      })
      .catch(() => {
        setState(prev => ({ ...prev, pricingLoadedEmail: email }));
      });
  }, [state.userEmail]);

  // Auto-poll for payment completion after checkout
  const startPaymentPolling = (email: string) => {
    setState(prev => ({ ...prev, stage: 'checking-payment' }));

    let attempts = 0;
    const maxAttempts = 20; // 20 * 3s = 60s

    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = window.setInterval(async () => {
      attempts++;

      try {
        const response = await fetch(`${BACKEND_URL}/api/validate-license`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ licenseKey: email })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.valid && data.tier === 'pro') {
            // Payment confirmed!
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
            setState(prev => ({
              ...prev,
              stage: 'setup',
              isPremium: true,
              error: null
            }));
            // Notify plugin code
            parent.postMessage({
              pluginMessage: { type: 'validate-license', data: { licenseKey: email } }
            }, '*');
            return;
          }
        }
      } catch (_e) {
        // Network error, keep trying
      }

      if (attempts >= maxAttempts) {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
        setState(prev => ({
          ...prev,
          stage: 'setup',
          error: null,
          paymentCheckAvailable: true
        }));
      }
    }, 3000);
  };

  const handleEmailSubmit = () => {
    const email = state.userEmail.trim();
    if (!email || !email.includes('@')) {
      setState(prev => ({ ...prev, error: 'Please enter a valid email address' }));
      return;
    }
    parent.postMessage({
      pluginMessage: { type: 'save-email', data: { email } }
    }, '*');
  };

  const handleExport = () => {
    setState(prev => ({ ...prev, error: null, stage: 'exporting' }));
    parent.postMessage({
      pluginMessage: {
        type: 'export-video',
        data: {
          ...state.settings,
          licenseKey: state.userEmail
        }
      }
    }, '*');
  };

  const handleScanPrototype = () => {
    scanReturnStageRef.current = state.stage;
    setState(prev => ({ ...prev, stage: 'scanning', error: null }));
    parent.postMessage({ pluginMessage: { type: 'scan-prototype' } }, '*');
  };

  const handleOpenCheckout = () => {
    const email = state.userEmail;
    if (!email || !email.includes('@')) {
      // Reveal the inline email field instead of blocking — we only need an
      // email to attach the subscription, collected right at checkout.
      setNeedEmail(true);
      setState(prev => ({ ...prev, error: 'Enter your email to continue to checkout.' }));
      return;
    }
    setNeedEmail(false);
    setState(prev => ({ ...prev, error: null }));
    parent.postMessage({
      pluginMessage: {
        type: 'open-checkout',
        data: {
          email,
          plan: 'monthly',
          pricingVariant: state.pricingVariant,
          priceLabel: state.monthlyPriceLabel,
          amountCents: state.monthlyAmountCents
        }
      }
    }, '*');
  };

  const handleManualPaymentCheck = () => {
    const email = state.userEmail;
    if (!email || !email.includes('@')) return;
    setState(prev => ({ ...prev, stage: 'checking-payment', paymentCheckAvailable: false }));
    startPaymentPolling(email);
  };

  const handleClosePlugin = () => {
    parent.postMessage({ pluginMessage: { type: 'cancel' } }, '*');
  };

  const handleOpenCommunityListing = () => {
    parent.postMessage({ pluginMessage: { type: 'open-community-listing' } }, '*');
  };

  const remainingExports = state.freeLimit - state.exportCount;
  const canExport = state.isPremium || remainingExports > 0;
  const freeUsed = !state.isPremium && state.exportCount >= state.freeLimit;
  const collectEmail = needEmail && !state.isPremium;

  // Inline, just-in-time email capture shown only after a user opts to upgrade.
  const emailCaptureCard = collectEmail ? (
    <div class="section aha-card">
      <p style="font-weight: 600; margin-bottom: 4px; font-size: 13px;">One step to Pro</p>
      <p class="small trust-copy" style="margin-bottom: 8px;">Enter your email to start checkout. It links your subscription so Pro works on any device.</p>
      <input
        type="email"
        placeholder="you@example.com"
        value={state.userEmail}
        onInput={(e) => setState(prev => ({ ...prev, userEmail: e.currentTarget.value }))}
        onKeyDown={(e) => { if (e.key === 'Enter') handleOpenCheckout(); }}
        class="license-input"
        style="margin-bottom: 8px;"
      />
      <button
        onClick={handleOpenCheckout}
        disabled={!state.userEmail.trim() || !state.userEmail.includes('@')}
        class="btn btn-upgrade btn-large"
      >
        Continue to checkout — {state.monthlyPriceLabel}
      </button>
    </div>
  ) : null;

  const samplePreview = (
    <div class="sample-preview">
      <div class="sample-header">
        <span>Sample MP4 outcome</span>
        <strong>8s</strong>
      </div>
      <div class="sample-flow" aria-hidden="true">
        <div class="sample-frame active">
          <span>Start</span>
        </div>
        <div class="sample-arrow"></div>
        <div class="sample-frame">
          <span>Flow</span>
        </div>
        <div class="sample-arrow"></div>
        <div class="sample-frame">
          <span>Done</span>
        </div>
      </div>
      <div class="sample-meta">
        <span>4 frames</span>
        <span>720p MP4</span>
        <span>Ready to share</span>
      </div>
    </div>
  );

  return (
    <div class="container">
      <header>
        <h1>ProtoVid</h1>
        <p class="subtitle">Export Figma Prototypes as MP4</p>
      </header>

      {state.error && (
        <div class="alert alert-error">
          <span>{state.error}</span>
        </div>
      )}

      {state.stage === 'loading' && (
        <div class="loading">
          <div class="spinner"></div>
          <p>Loading plugin...</p>
        </div>
      )}

      {state.stage === 'scanning' && (
        <div class="loading">
          <div class="spinner"></div>
          <h3>Scanning prototype...</h3>
          <p class="small" style="margin-top: 8px;">Checking this page for connected frames.</p>
        </div>
      )}

      {/* ===== CHECKING PAYMENT ===== */}
      {state.stage === 'checking-payment' && (
        <div class="loading">
          <div class="spinner"></div>
          <h3>Confirming payment...</h3>
          <p class="small" style="margin-top: 8px;">Complete checkout in the browser. The success page confirms Pro, then ProtoVid detects it here automatically.</p>
          <p class="small" style="margin-top: 8px; color: #6b7280;">If you already paid, use the status check after returning to the plugin.</p>
        </div>
      )}

      {/* ===== MAIN SETUP ===== */}
      {state.stage === 'setup' && (
        <div class="setup">
          {!state.hasPrototype && (
            <div class="alert alert-warning">
              <p style="font-weight: 600; margin-bottom: 8px;">No prototype found on this page.</p>
              {samplePreview}
              <div class="empty-steps" style="margin: 0;">
                <div class="empty-step" style="padding: 6px 0;">
                  <span class="step-num">1</span>
                  <span>Select two frames → open the <strong>Prototype</strong> tab</span>
                </div>
                <div class="empty-step" style="padding: 6px 0;">
                  <span class="step-num">2</span>
                  <span>Drag the blue handle to link them</span>
                </div>
                <div class="empty-step" style="padding: 6px 0;">
                  <span class="step-num">3</span>
                  <span>Click <strong>Scan Prototype</strong> below to refresh</span>
                </div>
              </div>
              <button
                onClick={handleScanPrototype}
                class="btn btn-primary btn-large"
                style="margin-top: 10px;"
              >
                Scan Prototype
              </button>
              <button
                onClick={handleClosePlugin}
                class="btn btn-secondary btn-large"
                style="margin-top: 8px;"
              >
                Close Plugin
              </button>
            </div>
          )}

          {state.hasPrototype && (
            <>
              {emailCaptureCard}

              {/* Free tier exhausted banner */}
              {freeUsed && !collectEmail && (
                <div class="alert alert-upgrade">
                  <p style="font-weight: 600; margin-bottom: 4px;">
                    {state.trialExpired
                      ? `Your free trial has expired after ${state.daysSinceFirstExport} days`
                      : `You've used all ${state.freeLimit} free exports this month`}
                  </p>
                  <p class="small">
                    {state.trialExpired
                      ? 'Upgrade to keep exporting prototypes.'
                      : 'Upgrade to keep exporting this prototype today.'}
                  </p>
                  <p class="small" style="margin-top: 4px;">Pro includes unlimited MP4 exports, 1080p/4K, and no watermark.</p>
                  <p class="small" style="margin-top: 4px;">Or come back on the 1st — your free exports reset monthly.</p>
                  <button
                    onClick={handleOpenCheckout}
                    class="btn btn-upgrade btn-small"
                    style="margin-top: 8px;"
                  >
                    Upgrade — {state.monthlyPriceLabel}
                  </button>
                </div>
              )}

              <div class="section">
                <h3>Prototype Info</h3>
                <p>Found <strong>{state.frameCount}</strong> prototype frames</p>
                {!state.isPremium && (
                  <p class="small" style="margin-top: 4px;">
                    {state.trialExpired
                      ? `Trial expired after ${state.daysSinceFirstExport} days — upgrade to continue`
                      : remainingExports > 0
                        ? `${remainingExports} of ${state.freeLimit} free exports left this month — resets on the 1st`
                        : 'No free exports left — resets on the 1st of next month'}
                  </p>
                )}
                {state.isPremium && (
                  <p class="small" style="margin-top: 4px; color: #16a34a;">
                    Premium — Unlimited exports, no watermark
                  </p>
                )}
              </div>

              <div class="section">
                <h3>Export Settings</h3>

                <label>
                  <span>Resolution</span>
                  <select
                    value={state.settings.resolution}
                    onChange={(e) => {
                      const val = e.currentTarget.value;
                      if (!state.isPremium && val !== '720p') {
                        handleOpenCheckout();
                        return;
                      }
                      setState(prev => ({ ...prev, settings: { ...prev.settings, resolution: val as any } }));
                    }}
                  >
                    <option value="720p">720p {!state.isPremium ? '' : ''}</option>
                    <option value="1080p">1080p {!state.isPremium ? '— Premium' : ''}</option>
                    <option value="4K">4K {!state.isPremium ? '— Premium' : ''}</option>
                  </select>
                </label>

                <p class="small">
                  Output: MP4 video
                  {!state.isPremium && ' · Watermarked'}
                </p>
              </div>

              {/* Upgrade section for free users */}
              {!state.isPremium && !freeUsed && !collectEmail && (
                <div class="section upgrade-section">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                      <p style="font-weight: 600; font-size: 13px;">Remove watermark + HD</p>
                      <p class="small">Unlimited exports, 1080p/4K, no watermark</p>
                    </div>
                    <button
                      onClick={handleOpenCheckout}
                      class="btn btn-upgrade btn-small"
                    >
                      {state.monthlyPriceLabel}
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={canExport ? handleExport : handleOpenCheckout}
                class={`btn ${canExport ? 'btn-primary' : 'btn-upgrade'} btn-large`}
              >
                {canExport
                  ? (state.isPremium ? 'Export HD Video' : 'Export Video (720p, Watermarked)')
                  : `Upgrade to Export — ${state.monthlyPriceLabel}`}
              </button>
              {(freeUsed || state.paymentCheckAvailable) && state.userEmail && (
                <p class="small" style="margin-top: 8px; text-align: center;">
                  <a href="#" class="link" onClick={(e) => { e.preventDefault(); handleManualPaymentCheck(); }}>
                    Already paid? Check payment status
                  </a>
                </p>
              )}
            </>
          )}
        </div>
      )}

      {state.stage === 'exporting' && (
        <div class="exporting">
          <div class="spinner"></div>
          <h3>{state.progress.stage}</h3>
          <div class="progress-bar">
            <div class="progress-fill" style={{ width: `${state.progress.percent}%` }}></div>
          </div>
          <p>{Math.round(state.progress.percent)}%</p>
        </div>
      )}

      {state.stage === 'complete' && (
        <div class="complete">
          <div class="success-icon">✅</div>
          <h3>Prototype Video Exported</h3>

          <div class="export-meta">
            {state.downloadFilename && (
              <div class="meta-row">
                <span class="meta-label">File</span>
                <span class="meta-value">{state.downloadFilename}</span>
              </div>
            )}
            <div class="meta-row">
              <span class="meta-label">Duration</span>
              <span class="meta-value">{state.frameCount * 2}s ({state.frameCount} frames)</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">Resolution</span>
              <span class="meta-value">{state.settings.resolution}{!state.isPremium ? ' · watermarked' : ''}</span>
            </div>
          </div>

          {state.videoUrl && (
            <a href={state.videoUrl} download={state.downloadFilename || 'protovid-export'} class="btn btn-primary btn-large" style="margin-top: 12px;">
              Download MP4
            </a>
          )}

          <div class="review-card">
            <p style="font-weight: 600; margin-bottom: 4px; font-size: 13px;">Enjoying ProtoVid?</p>
            <p class="small">If this saved a screen recording session, a review on Figma Community helps other designers find it.</p>
            <button onClick={handleOpenCommunityListing} class="btn btn-secondary btn-small">
              Leave a Review
            </button>
          </div>

          {!state.isPremium && (
            <div class="upgrade-card">
              <h3 style="margin-bottom: 8px;">Remove watermark + unlock HD</h3>
              <p class="small" style="margin-bottom: 4px;">Your export has a "Made with love by ProtoVid" watermark.</p>
              <p class="small" style="margin-bottom: 12px;">Premium removes it and unlocks 1080p/4K + unlimited exports — from $29/year.</p>
              {collectEmail ? emailCaptureCard : (
                <button
                  onClick={handleOpenCheckout}
                  class="btn btn-upgrade"
                >
                  Upgrade to Pro — {state.monthlyPriceLabel}
                </button>
              )}
            </div>
          )}

          <button
            onClick={() => setState(prev => ({ ...prev, stage: 'setup', videoUrl: null, downloadFilename: null }))}
            class="btn btn-secondary"
            style="margin-top: 12px;"
          >
            Export Another
          </button>
        </div>
      )}

      <footer>
        <p class="small">
          ProtoVid by <a href="https://dasgroupllc.com" target="_blank" class="link">Das Group</a>
          {state.isPremium && (
            <span> · <a href="#" onClick={(e) => { e.preventDefault(); parent.postMessage({ pluginMessage: { type: 'open-billing-portal' } }, '*'); }} class="link">Manage Subscription</a></span>
          )}
        </p>
      </footer>
    </div>
  );
}

// Render app
render(<App />, document.getElementById('app')!);
