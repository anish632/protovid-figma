// ProtoVid - Plugin UI (runs in iframe)
import { h, Fragment, render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { encodeVideo } from './encoder';

interface AppState {
  stage: 'loading' | 'setup' | 'scanning' | 'exporting' | 'complete';
  hasPrototype: boolean;
  frameCount: number;
  exportCount: number;
  freeLimit: number;
  isPremium: boolean;
  licenseKey: string;
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

function App() {
  const [state, setState] = useState<AppState>({
    stage: 'loading',
    hasPrototype: false,
    frameCount: 0,
    exportCount: 0,
    freeLimit: 3,
    isPremium: false,
    licenseKey: '',
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
            licenseKey: msg.data.savedLicenseKey || ''
          }));
          // Auto-validate saved license key
          if (msg.data.savedLicenseKey) {
            parent.postMessage({
              pluginMessage: {
                type: 'validate-license',
                data: { licenseKey: msg.data.savedLicenseKey }
              }
            }, '*');
          }
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
              }
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
            licenseKey: msg.data.isValid ? msg.data.licenseKey : ''
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

  const updateSettings = (key: string, value: any) => {
    setState(prev => ({
      ...prev,
      settings: { ...prev.settings, [key]: value }
    }));
  };

  const remainingExports = state.freeLimit - state.exportCount;
  const canExport = state.isPremium || remainingExports > 0;

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

{/* Frame rate is automatic */}

                <p class="small">Output: MP4 Video</p>
              </div>

              <div class="section">
                <h3>🔑 License</h3>
                {state.isPremium ? (
                  <div class="alert alert-success">
                    <span>✅ Premium Active</span>
                  </div>
                ) : (
                  <>
                    <div class="license-info">
                      <p>Free: <strong>{remainingExports}/{state.freeLimit}</strong> exports remaining</p>
                      <p class="small">720p only</p>
                    </div>
                    <input
                      type="text"
                      placeholder="Enter premium license key..."
                      value={state.licenseKey}
                      onInput={(e) => setState(prev => ({ ...prev, licenseKey: e.currentTarget.value }))}
                      class="license-input"
                    />
                    <button
                      onClick={handleValidateLicense}
                      disabled={!state.licenseKey.trim()}
                      class="btn btn-secondary btn-small"
                    >
                      Validate License
                    </button>
                    <a href="https://dasgroup.lemonsqueezy.com" target="_blank" class="link">
                      Get Premium ($12/mo) →
                    </a>
                  </>
                )}
              </div>

              <button
                onClick={handleExport}
                disabled={!canExport}
                class="btn btn-primary btn-large"
              >
                {canExport ? '🎬 Export Video' : '🔒 Upgrade to Export'}
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
            <div class="alert alert-info">
              <p>Exports remaining: <strong>{remainingExports}</strong></p>
              <a href="https://dasgroup.lemonsqueezy.com" target="_blank" class="link">
                Upgrade to Premium for unlimited exports →
              </a>
            </div>
          )}

          <button
            onClick={() => setState(prev => ({ ...prev, stage: 'setup', videoUrl: null, downloadFilename: null }))}
            class="btn btn-secondary"
          >
            Export Another
          </button>
        </div>
      )}

      <footer>
        <p class="small">
          ProtoVid by <a href="https://dasgroup.lemonsqueezy.com" target="_blank" class="link">Das Group</a>
        </p>
      </footer>
    </div>
  );
}

// Render app
render(<App />, document.getElementById('app')!);
