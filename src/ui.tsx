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
  licenseKey: string;
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

const BACKEND_URL = 'https://backend-one-nu-28.vercel.app';

function App() {
  const [state, setState] = useState<AppState>({
    stage: 'loading',
    hasPrototype: false,
    frameCount: 0,
    exportCount: 0,
    freeLimit: 1,
    isPremium: false,
    licenseKey: '',
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
            licenseKey: msg.data.savedLicenseKey || msg.data.savedEmail || '',
            userEmail: msg.data.savedEmail || '',
            isPremium: msg.data.isPremium || false
          }));
          break;

        case 'email-saved':
          setState(prev => ({
            ...prev,
            stage: 'setup',
            userEmail: msg.data.email,
            licenseKey: msg.data.email,
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
          const { frames, settings: encSettings, isPremium } = msg.data;
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
            isPremium: msg.data.isValid,
            licenseKey: msg.data.isValid ? msg.data.licenseKey : prev.licenseKey
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
    const maxAttempts = 10; // 10 * 3s = 30s
    
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
              licenseKey: email,
              error: null
            }));
            // Notify plugin code to save the license
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
          licenseKey: state.licenseKey
        }
      }
    }, '*');
  };

  const handleValidateLicense = () => {
    if (state.licenseKey.trim()) {
      parent.postMessage({
        pluginMessage: {
          type: 'validate-license',
          data: { licenseKey: state.licenseKey.trim() }
        }
      }, '*');
    }
  };

  const handleOpenCheckout = () => {
    const email = state.userEmail || state.licenseKey.trim();
    if (!email || !email.includes('@')) {
      setState(prev => ({ ...prev, error: 'Please enter your email address to proceed to checkout' }));
      return;
    }
    parent.postMessage({
      pluginMessage: {
        type: 'open-checkout',
        data: { email }
      }
    }, '*');
  };

  const updateSettings = (key: string, value: any) => {
    setState(prev => ({
      ...prev,
      settings: { ...prev.settings, [key]: value }
    }));
  };

  const remainingExports = state.freeLimit - state.exportCount;
  const canExport = state.isPremium || remainingExports > 0;
  const freeUsed = !state.isPremium && state.exportCount >= state.freeLimit;

  return (
    <div class="container">
      <header>
        <h1>🎬 ProtoVid</h1>
        <p class="subtitle">Professional Prototype Video Exporter</p>
      </header>

      {state.error && (
        <div class="alert alert-error">
          <span>⚠️ {state.error}</span>
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
          <div class="section">
            <div class="email-gate-icon">📧</div>
            <h3 style="text-align: center;">Enter your email to start exporting</h3>
            <p class="small" style="text-align: center; margin-bottom: 16px;">Free, no payment needed. We'll save your export history.</p>
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
              Get Started — Free
            </button>
            <p class="small" style="text-align: center; margin-top: 12px; color: #999;">
              1 free export per month · 720p · No credit card required
            </p>
          </div>
        </div>
      )}

      {/* ===== CHECKING PAYMENT ===== */}
      {state.stage === 'checking-payment' && (
        <div class="loading">
          <div class="spinner"></div>
          <h3>Checking payment status...</h3>
          <p class="small" style="margin-top: 8px;">Complete your payment in the browser. We'll detect it automatically.</p>
        </div>
      )}

      {/* ===== MAIN SETUP ===== */}
      {state.stage === 'setup' && (
        <div class="setup">
          {!state.hasPrototype && (
            <div class="alert alert-warning">
              <p>⚠️ No prototype found on this page.</p>
              <p>Create prototype interactions first, then reopen ProtoVid.</p>
            </div>
          )}

          {state.hasPrototype && (
            <>
              {/* Free tier exhausted banner */}
              {freeUsed && (
                <div class="alert alert-upgrade">
                  <p style="font-weight: 600; margin-bottom: 4px;">🚀 Free export used this month</p>
                  <p class="small">Upgrade for unlimited HD exports, no watermark — <strong>$8/mo</strong></p>
                  <button
                    onClick={handleOpenCheckout}
                    class="btn btn-primary btn-small"
                    style="margin-top: 8px;"
                  >
                    Upgrade to Premium
                  </button>
                </div>
              )}

              <div class="section">
                <h3>📊 Prototype Info</h3>
                <p>Found <strong>{state.frameCount}</strong> prototype frames</p>
              </div>

              <div class="section">
                <h3>⚙️ Export Settings</h3>
                
                <label>
                  <span>Resolution</span>
                  <select
                    value={state.settings.resolution}
                    onChange={(e) => updateSettings('resolution', e.currentTarget.value)}
                    disabled={!state.isPremium && state.settings.resolution !== '720p'}
                  >
                    <option value="720p">720p (Free)</option>
                    <option value="1080p">1080p (Premium) ⭐</option>
                    <option value="4K">4K (Premium) ⭐</option>
                  </select>
                </label>

                <p class="small">Output: MP4 Video{!state.isPremium ? ' · Watermarked' : ''}</p>
              </div>

              <div class="section">
                <h3>🔑 License</h3>
                {state.isPremium ? (
                  <div class="alert alert-success">
                    <span>✅ Premium Active — Unlimited exports, no watermark</span>
                  </div>
                ) : (
                  <>
                    <div class="license-info">
                      <p>Free: <strong>{Math.max(0, remainingExports)}/{state.freeLimit}</strong> export{state.freeLimit === 1 ? '' : 's'} remaining this month</p>
                      <p class="small">720p · Watermarked</p>
                    </div>
                    <input
                      type="email"
                      placeholder="Enter your email address..."
                      value={state.licenseKey}
                      onInput={(e) => setState(prev => ({ ...prev, licenseKey: e.currentTarget.value }))}
                      class="license-input"
                    />
                    <div style="display: flex; gap: 8px; flex-direction: column;">
                      <button
                        onClick={handleOpenCheckout}
                        disabled={!state.licenseKey.trim()}
                        class="btn btn-primary btn-small"
                      >
                        🛒 Get Premium ($8/mo)
                      </button>
                      <button
                        onClick={handleValidateLicense}
                        disabled={!state.licenseKey.trim()}
                        class="btn btn-secondary btn-small"
                      >
                        ✅ Already paid? Validate
                      </button>
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={canExport ? handleExport : handleOpenCheckout}
                class={`btn ${canExport ? 'btn-primary' : 'btn-upgrade'} btn-large`}
              >
                {canExport ? '🎬 Export Video' : '🔒 Upgrade to Export — $8/mo'}
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
          <h3>Export Complete!</h3>
          <p>Your prototype video is ready.</p>
          
          {state.videoUrl && (
            <a href={state.videoUrl} download={state.downloadFilename || 'protovid-export'} class="btn btn-primary">
              Download Video
            </a>
          )}

          {!state.isPremium && (
            <div class="upgrade-card">
              <h3 style="margin-bottom: 8px;">⭐ Remove watermark & go HD</h3>
              <p class="small" style="margin-bottom: 4px;">Your export has a "Made with ProtoVid" watermark.</p>
              <p class="small" style="margin-bottom: 12px;">Premium removes it and unlocks 1080p/4K + unlimited exports.</p>
              <button
                onClick={handleOpenCheckout}
                class="btn btn-upgrade btn-large"
              >
                Upgrade to Premium — $8/mo
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
          ProtoVid by <a href="https://protovid.app" target="_blank" class="link">Das Group</a>
        </p>
      </footer>
    </div>
  );
}

// Render app
render(<App />, document.getElementById('app')!);
