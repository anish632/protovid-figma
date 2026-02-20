// ProtoVid - Plugin UI (runs in iframe)
import { h, Fragment, render } from 'preact';
import { useState, useEffect } from 'preact/hooks';

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
    format: 'mp4' | 'gif';
    showCursor: boolean;
  };
  progress: {
    stage: string;
    percent: number;
  };
  error: string | null;
  videoUrl: string | null;
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
    videoUrl: null
  });

  useEffect(() => {
    // Initialize
    parent.postMessage({ pluginMessage: { type: 'init' } }, '*');

    // Listen for messages from plugin code
    window.onmessage = (event) => {
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
            freeLimit: msg.data.freeLimit
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

        case 'export-complete':
          setState(prev => ({
            ...prev,
            stage: 'complete',
            videoUrl: msg.data.videoUrl,
            exportCount: msg.data.exportCount,
            isPremium: msg.data.isPremium
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

                <label>
                  <span>Frame Rate</span>
                  <select
                    value={state.settings.frameRate}
                    onChange={(e) => updateSettings('frameRate', parseInt(e.currentTarget.value))}
                  >
                    <option value="30">30 fps</option>
                    <option value="60">60 fps</option>
                  </select>
                </label>

                <label>
                  <span>Format</span>
                  <select
                    value={state.settings.format}
                    onChange={(e) => updateSettings('format', e.currentTarget.value)}
                    disabled={!state.isPremium && state.settings.format === 'gif'}
                  >
                    <option value="mp4">MP4 Video</option>
                    <option value="gif">GIF (Premium) ⭐</option>
                  </select>
                </label>

                <label class="checkbox">
                  <input
                    type="checkbox"
                    checked={state.settings.showCursor}
                    onChange={(e) => updateSettings('showCursor', e.currentTarget.checked)}
                  />
                  <span>Show cursor animation</span>
                </label>
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
                      <p class="small">720p only, watermarked</p>
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
                    <a href="https://protovid.lemonsqueezy.com" target="_blank" class="link">
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
            <a href={state.videoUrl} download class="btn btn-primary">
              Download Video
            </a>
          )}

          {!state.isPremium && (
            <div class="alert alert-info">
              <p>Exports remaining: <strong>{remainingExports}</strong></p>
              <a href="https://protovid.lemonsqueezy.com" target="_blank" class="link">
                Upgrade to Premium for unlimited exports →
              </a>
            </div>
          )}

          <button
            onClick={() => setState(prev => ({ ...prev, stage: 'setup', videoUrl: null }))}
            class="btn btn-secondary"
          >
            Export Another
          </button>
        </div>
      )}

      <footer>
        <p class="small">
          Need help? <a href="https://protovid.app/docs" target="_blank" class="link">View Docs</a>
        </p>
      </footer>
    </div>
  );
}

// Render app
render(<App />, document.getElementById('app')!);
