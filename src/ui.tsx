// ProtoVid - Plugin UI (runs in iframe)
import { h, Fragment, render } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { encodeVideo } from './encoder';

interface AppState {
  stage: 'loading' | 'email-gate' | 'setup' | 'scanning' | 'exporting' | 'complete' | 'checking-payment';
  hasPrototype: boolean;
  frameCount: number;
  exportCount: number;
  freeLimit: number;
  isPremium: boolean;
  userEmail: string;
  settings: {
    resolution: '720p' | '1080p' | '4K';
    frameRate: 30 | 60;
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
    settings: {
      resolution: '720p',
      frameRate: 30,
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

  const pollTimerRef = useRef<number | null>(null);

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
            stage: msg.data.savedEmail ? 'setup' : 'email-gate',
            hasPrototype: msg.data.hasPrototype,
            frameCount: msg.data.frameCount,
            exportCount: msg.data.exportCount,
            freeLimit: msg.data.freeLimit,
            userEmail: msg.data.savedEmail || '',
            isPremium: msg.data.isPremium || false
          }));
          break;

        case 'email-saved':
          setState(prev => ({
            ...prev,
            stage: 'setup',
            userEmail: msg.data.email,
            exportCount: msg.data.exportCount,
            freeLimit: msg.data.freeLimit,
            isPremium: msg.data.isPremium || false
          }));
          break;

        case 'scan-complete':
          setState(prev => ({
            ...prev,
            stage: 'setup',
            frameCount: msg.data.frames.length
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
          error: null
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

  const handleOpenCheckout = () => {
    const email = state.userEmail;
    if (!email || !email.includes('@')) {
      setState(prev => ({ ...prev, error: 'Please enter your email address first' }));
      return;
    }
    parent.postMessage({
      pluginMessage: {
        type: 'open-checkout',
        data: { email, plan: 'monthly' }
      }
    }, '*');
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

      {/* ===== EMAIL GATE ===== */}
      {state.stage === 'email-gate' && (
        <div class="setup">
          {state.hasPrototype ? (
            <div class="section aha-card">
              <div class="value-pill">MP4 export ready</div>
              <h3 style="text-align: center;">Found {state.frameCount} prototype frames</h3>
              <p class="small trust-copy">
                Enter your email to start your free 720p export. Email tracks monthly usage and Pro status; frame images are sent only when you click Export to create the video.
              </p>
              <input
                type="email"
                placeholder="you@example.com"
                value={state.userEmail}
                onInput={(e) => setState(prev => ({ ...prev, userEmail: e.currentTarget.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') handleEmailSubmit(); }}
                class="license-input"
                style="margin-bottom: 12px;"
              />
              <button
                onClick={handleEmailSubmit}
                disabled={!state.userEmail.trim() || !state.userEmail.includes('@')}
                class="btn btn-primary btn-large"
              >
                Continue to Export
              </button>
              <p class="small trust-copy muted">
                1 free export/month. Resets on the 1st. 720p, watermarked.
              </p>
            </div>
          ) : (
            <div class="section empty-state">
              <div class="value-pill warning-pill">No prototype found</div>
              <h3>Connect your frames first</h3>
              <p class="small" style="margin-bottom: 4px;">ProtoVid exports frames linked by prototype interactions. Here's how to set one up:</p>
              <div class="empty-steps">
                <div class="empty-step">
                  <span class="step-num">1</span>
                  <span>Select two or more frames on this page</span>
                </div>
                <div class="empty-step">
                  <span class="step-num">2</span>
                  <span>Open the <strong>Prototype</strong> tab in the right panel</span>
                </div>
                <div class="empty-step">
                  <span class="step-num">3</span>
                  <span>Drag the blue handle from one frame to another to create an interaction</span>
                </div>
                <div class="empty-step">
                  <span class="step-num">4</span>
                  <span>Reopen ProtoVid to export</span>
                </div>
              </div>
              <button
                onClick={handleClosePlugin}
                class="btn btn-secondary btn-large"
                style="margin-top: 4px;"
              >
                Go Set Up Prototype
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===== CHECKING PAYMENT ===== */}
      {state.stage === 'checking-payment' && (
        <div class="loading">
          <div class="spinner"></div>
          <h3>Confirming payment...</h3>
          <p class="small" style="margin-top: 8px;">Complete your payment in the browser. We'll detect it automatically.</p>
        </div>
      )}

      {/* ===== MAIN SETUP ===== */}
      {state.stage === 'setup' && (
        <div class="setup">
          {!state.hasPrototype && (
            <div class="alert alert-warning">
              <p style="font-weight: 600; margin-bottom: 8px;">No prototype found on this page.</p>
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
            </div>
          )}

          {state.hasPrototype && (
            <>
              {/* Free tier exhausted banner */}
              {freeUsed && (
                <div class="alert alert-upgrade">
                  <p style="font-weight: 600; margin-bottom: 4px;">Free export used this month</p>
                  <p class="small">Upgrade for unlimited HD exports, no watermark</p>
                  <p class="small" style="margin-top: 4px;">Your next free export resets on the 1st of next month.</p>
                  <button
                    onClick={handleOpenCheckout}
                    class="btn btn-upgrade btn-small"
                    style="margin-top: 8px;"
                  >
                    Upgrade — $8/mo
                  </button>
                </div>
              )}

              <div class="section">
                <h3>Prototype Info</h3>
                <p>Found <strong>{state.frameCount}</strong> prototype frames</p>
                {!state.isPremium && (
                  <p class="small" style="margin-top: 4px;">
                    {remainingExports > 0
                      ? `${remainingExports}/${state.freeLimit} free export remaining this month - resets on the 1st`
                      : 'No free exports remaining - resets on the 1st of next month'}
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
              {!state.isPremium && !freeUsed && (
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
                      From $8/mo
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
                  : 'Upgrade to Export — from $8/mo'}
              </button>
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
              <p class="small" style="margin-bottom: 12px;">Premium removes it and unlocks 1080p/4K + unlimited exports.</p>
              <button
                onClick={handleOpenCheckout}
                class="btn btn-upgrade"
              >
                Upgrade to Pro — $8/mo
              </button>
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
