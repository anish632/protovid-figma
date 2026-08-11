import { ComponentChildren, h } from 'preact';
import { useState } from 'preact/hooks';
import type {
  ExportProgressModel,
  PrimaryActionModel,
  Resolution,
  ResolutionOptionModel,
} from './uiModel';
import { getSuccessActions } from './uiModel';

type IconName =
  | 'alert'
  | 'check'
  | 'chevron'
  | 'close'
  | 'copy'
  | 'download'
  | 'info'
  | 'mic'
  | 'more'
  | 'refresh'
  | 'repeat'
  | 'share'
  | 'shield';

interface IconProps {
  name: IconName;
  size?: number;
  class?: string;
}

export function Icon({ name, size = 16, class: className = '' }: IconProps) {
  const paths: Record<IconName, ComponentChildren> = {
    alert: <><path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    chevron: <path d="m8 10 4 4 4-4"/>,
    close: <><path d="m6 6 12 12"/><path d="M18 6 6 18"/></>,
    copy: <><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></>,
    download: <><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/></>,
    mic: <><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/></>,
    more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    refresh: <><path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 0-2 5"/></>,
    repeat: <><path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="m7 22-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/></>,
    share: <><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.5-4.4M8.2 13.2l7.5 4.4"/></>,
    shield: <><path d="M12 3 5 6v5c0 4.6 2.8 8 7 10 4.2-2 7-5.4 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></>,
  };

  return (
    <svg
      class={`icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

interface AppHeaderProps {
  onClose: () => void;
  voiceStatus: VoiceControlProps['status'];
  voiceTranscript: string;
  voiceError: string | null;
  onVoiceToggle: () => void;
}

export interface VoiceControlProps {
  status: 'idle' | 'listening' | 'processing' | 'unsupported' | 'error';
  transcript: string;
  error: string | null;
  onToggle: () => void;
}

export function VoiceControl({ status, transcript, error, onToggle }: VoiceControlProps) {
  const isActive = status === 'listening' || status === 'processing';
  const label = status === 'listening'
    ? 'Listening…'
    : status === 'processing'
      ? 'Working…'
      : status === 'unsupported'
        ? 'Voice unavailable'
        : status === 'error'
          ? 'Try again'
        : 'Voice';
  const title = error || (transcript ? `Last command: “${transcript}”` : 'Use a voice command');

  return (
    <button
      class={`voice-button ${isActive ? 'is-active' : ''} ${status === 'error' ? 'has-error' : ''}`}
      type="button"
      onClick={onToggle}
      aria-label={isActive ? 'Stop voice listening' : 'Start voice control'}
      aria-pressed={isActive}
      title={title}
    >
      <Icon name="mic" size={16} />
      <span>{label}</span>
    </button>
  );
}

export function AppHeader({ onClose, voiceStatus, voiceTranscript, voiceError, onVoiceToggle }: AppHeaderProps) {
  return (
    <header class="app-header">
      <div class="brand-lockup">
        <img class="app-icon" src="__PROTOVID_ICON__" alt="" />
        <div class="brand-copy">
          <strong>ProtoVid</strong>
          <span>Export to MP4</span>
        </div>
      </div>
      <div class="header-actions">
        <VoiceControl status={voiceStatus} transcript={voiceTranscript} error={voiceError} onToggle={onVoiceToggle} />
        <button class="icon-button" type="button" onClick={onClose} aria-label="Close ProtoVid">
          <Icon name="close" size={18} />
        </button>
      </div>
    </header>
  );
}

interface SectionCardProps {
  title: string;
  eyebrow?: string;
  action?: ComponentChildren;
  children: ComponentChildren;
  class?: string;
}

export function SectionCard({ title, eyebrow, action, children, class: className = '' }: SectionCardProps) {
  return (
    <section class={`section-card ${className}`.trim()}>
      <div class="section-heading-row">
        <div>
          {eyebrow && <p class="section-eyebrow">{eyebrow}</p>}
          <h2>{title}</h2>
        </div>
        {action && <div class="section-action">{action}</div>}
      </div>
      {children}
    </section>
  );
}

export function PlanBadge({ pro, label }: { pro?: boolean; label?: string }) {
  return <span class={`plan-badge ${pro ? 'plan-badge-pro' : 'plan-badge-free'}`}>{label || (pro ? 'Pro' : 'Free')}</span>;
}

interface FlowPreviewProps {
  frameCount: number;
  startName?: string | null;
  endName?: string | null;
}

function compactFrameName(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  return value.length > 13 ? `${value.slice(0, 12)}…` : value;
}

export function FlowPreview({ frameCount, startName, endName }: FlowPreviewProps) {
  const visibleFrames = Math.max(1, Math.min(frameCount, 4));
  const hiddenFrames = Math.max(0, frameCount - visibleFrames);

  return (
    <div class="flow-preview" role="img" aria-label={`Connected path preview with ${frameCount} ${frameCount === 1 ? 'frame' : 'frames'}`}>
      <div class="flow-path" aria-hidden="true">
        {Array.from({ length: visibleFrames }).map((_, index) => {
          const isFirst = index === 0;
          const isLast = index === visibleFrames - 1;
          const label = isFirst
            ? compactFrameName(startName, 'Start')
            : isLast
              ? compactFrameName(endName, `Frame ${frameCount}`)
              : `Frame ${index + 1}`;
          return (
            <div class="flow-node-wrap" key={index}>
              {index > 0 && <span class="flow-connector"><span /></span>}
              <div class={`flow-node ${isFirst ? 'is-start' : ''}`}>
                <span class="flow-node-ui" />
                <span class="flow-node-label">{label}</span>
                {isFirst && <span class="start-marker">Start</span>}
              </div>
            </div>
          );
        })}
        {hiddenFrames > 0 && <span class="flow-overflow">+{hiddenFrames}</span>}
      </div>
    </div>
  );
}

interface FlowStatusProps {
  frameCount: number;
  estimatedDuration: string;
  allowance: string;
  isPro: boolean;
  startName?: string | null;
  endName?: string | null;
  hasIssue?: boolean;
  onRefresh: () => void;
  onChoosePath?: () => void;
}

export function FlowStatus({
  frameCount,
  estimatedDuration,
  allowance,
  isPro,
  startName,
  endName,
  hasIssue = false,
  onRefresh,
  onChoosePath,
}: FlowStatusProps) {
  return (
    <SectionCard
      title="Detected flow"
      eyebrow="1 · Detect"
      action={<button class="text-button" type="button" onClick={onRefresh}><Icon name="refresh" size={14} />Refresh</button>}
    >
      <div class="status-line">
        <span class={`status-dot ${hasIssue ? 'status-dot-warning' : 'status-dot-success'}`} />
        <div>
          <strong>{frameCount} connected {frameCount === 1 ? 'frame' : 'frames'} detected</strong>
          <p>{hasIssue ? 'Review the flow before exporting.' : frameCount === 1 ? 'Connect another frame for a walkthrough.' : 'Ready for a quick review export.'}</p>
        </div>
      </div>
      <FlowPreview frameCount={frameCount} startName={startName} endName={endName} />
      <div class="flow-meta" aria-label="Flow details">
        <span><strong>{frameCount}</strong> {frameCount === 1 ? 'frame' : 'frames'}</span>
        <span><strong>{estimatedDuration}</strong> estimated</span>
        <span><PlanBadge pro={isPro} /> {allowance}</span>
      </div>
      {onChoosePath && (
        <button class="secondary-link" type="button" onClick={onChoosePath}>Choose another start frame</button>
      )}
    </SectionCard>
  );
}

interface ResolutionSelectorProps {
  options: ResolutionOptionModel[];
  value: Resolution;
  onChange: (value: Resolution) => void;
}

export function ResolutionSelector({ options, value, onChange }: ResolutionSelectorProps) {
  return (
    <fieldset class="control-group">
      <legend>Resolution</legend>
      <div class="resolution-grid">
        {options.map(option => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              class={`option-tile ${selected ? 'is-selected' : ''} ${option.availability === 'requires-pro' ? 'requires-pro' : ''}`}
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              title={option.helperText}
            >
              <span>{option.label}</span>
              {option.badge && <PlanBadge pro label={option.badge} />}
              {selected && <Icon name="check" size={14} class="option-check" />}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function FormatSelector() {
  return (
    <div class="format-control">
      <div class="format-selected" aria-label="Selected format MP4">
        <span class="format-icon">MP4</span>
        <div><strong>MP4 video</strong><span>Selected format</span></div>
        <Icon name="check" size={16} />
      </div>
      <details class="inline-disclosure">
        <summary>More formats <Icon name="chevron" size={14} /></summary>
        <p>GIF and WebM are being considered. MP4 is the only available format today.</p>
      </details>
    </div>
  );
}

export function ExportSummary({ summary }: { summary: string }) {
  return (
    <div class="export-summary" aria-label="Export summary">
      <span class="summary-label">Summary</span>
      <strong>{summary}</strong>
    </div>
  );
}

export function TrustRow() {
  return (
    <details class="trust-row">
      <summary>
        <Icon name="shield" size={17} />
        <span>Frames are sent only when you export. ProtoVid does not access unrelated files.</span>
        <span class="learn-more">Learn more</span>
      </summary>
      <p>Only the ordered frames in your selected path are prepared for the MP4. Unrelated pages and files remain untouched.</p>
    </details>
  );
}

interface StickyActionBarProps {
  action: PrimaryActionModel;
  onAction: () => void;
}

export function StickyActionBar({ action, onAction }: StickyActionBarProps) {
  return (
    <div class="sticky-action-bar">
      <button
        class={`primary-action ${action.intent === 'upgrade' ? 'upgrade-action' : ''}`}
        type="button"
        onClick={onAction}
        disabled={action.disabled}
        aria-describedby="primary-action-helper"
      >
        {action.label}
      </button>
      <p id="primary-action-helper">{action.supportingText}</p>
    </div>
  );
}

interface ProgressStepsProps {
  model: ExportProgressModel;
  elapsed: string;
  frameCount: number;
  resolution: Resolution;
  detail: string;
}

export function ProgressSteps({ model, elapsed, frameCount, resolution, detail }: ProgressStepsProps) {
  return (
    <main class="state-screen progress-screen" aria-labelledby="progress-heading">
      <div class="state-icon state-icon-progress"><span /></div>
      <p class="state-eyebrow">3 · Export</p>
      <h1 id="progress-heading">Creating your MP4</h1>
      <p class="state-description" role="status" aria-live="polite">
        {model.currentStage.label}. {detail}
      </p>
      <div class="progress-track" role="progressbar" aria-label="Export progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={model.percent}>
        <span style={{ width: `${model.percent}%` }} />
      </div>
      <div class="progress-meta"><strong>{model.percent}%</strong><span>{elapsed} elapsed</span></div>
      <ol class="progress-steps">
        {model.steps.map((step, index) => (
          <li class={`is-${step.status}`} key={step.id} aria-current={step.status === 'current' ? 'step' : undefined}>
            <span class="step-indicator">{step.status === 'complete' ? <Icon name="check" size={13} /> : index + 1}</span>
            <span>{step.label}</span>
          </li>
        ))}
      </ol>
      <div class="state-facts"><span>{frameCount} {frameCount === 1 ? 'frame' : 'frames'}</span><span>{resolution}</span></div>
    </main>
  );
}

export interface FileSummaryData {
  filename: string;
  duration: string;
  frameCount: number;
  resolution: string;
  watermark: string;
  fileSize?: string | null;
}

export function FileSummary({ data }: { data: FileSummaryData }) {
  return (
    <section class="file-summary" aria-label="MP4 file details">
      <div class="file-identity">
        <span class="file-icon"><span /></span>
        <div>
          <strong title={data.filename}>{data.filename}</strong>
          <span>MP4 video</span>
        </div>
      </div>
      <dl class="file-facts">
        <div><dt>Duration</dt><dd>{data.duration}</dd></div>
        <div><dt>Frames</dt><dd>{data.frameCount}</dd></div>
        <div><dt>Resolution</dt><dd>{data.resolution}</dd></div>
        <div><dt>Watermark</dt><dd>{data.watermark}</dd></div>
        {data.fileSize && <div><dt>File size</dt><dd>{data.fileSize}</dd></div>}
      </dl>
    </section>
  );
}

interface UpgradeCardProps {
  monthlyLabel: string;
  onMonthly: () => void;
  projectPassLabel?: string | null;
  onProjectPass?: () => void;
  primaryOffer: 'monthly' | 'large_export';
}

export function UpgradeCard({
  monthlyLabel,
  onMonthly,
  projectPassLabel,
  onProjectPass,
  primaryOffer,
}: UpgradeCardProps) {
  const projectPassFirst = Boolean(
    primaryOffer === 'large_export' && projectPassLabel && onProjectPass
  );
  return (
    <section class="upgrade-card-compact" aria-labelledby="upgrade-heading">
      <span class="upgrade-accent" />
      <h2 id="upgrade-heading">Ready to ship this project?</h2>
      <p>Re-export this walkthrough in HD or 4K without the watermark.</p>
      <div class="plan-comparison">
        <div><PlanBadge /><span>720p · Watermark · 3 exports/month</span></div>
        <div><PlanBadge pro /><span>1080p and 4K · No watermark · Unlimited</span></div>
      </div>
      <button
        class="upgrade-cta"
        type="button"
        onClick={projectPassFirst && onProjectPass ? onProjectPass : onMonthly}
      >
        {projectPassFirst
          ? `Re-export clean for this project — ${projectPassLabel}`
          : `Re-export clean in HD — ${monthlyLabel}`}
      </button>
      {projectPassLabel && onProjectPass && (
        <button
          class="secondary-button upgrade-pass-cta"
          type="button"
          onClick={projectPassFirst ? onMonthly : onProjectPass}
        >
          {projectPassFirst ? `Ongoing Pro — ${monthlyLabel}` : `Project Pass — ${projectPassLabel}`}
        </button>
      )}
      {projectPassLabel && <p class="stripe-note">Project Pass includes 7 days of unlimited clean exports. No subscription.</p>}
      <p class="stripe-note">Secure checkout powered by Stripe.</p>
    </section>
  );
}

interface PostSuccessEmailSaveProps {
  onSave: () => void;
  onDismiss: () => void;
  email: string;
  onEmailChange: (value: string) => void;
  validEmail: boolean;
}

export function PostSuccessEmailSave({
  onSave,
  onDismiss,
  email,
  onEmailChange,
  validEmail,
}: PostSuccessEmailSaveProps) {
  return (
    <section class="post-success-email" aria-labelledby="post-success-email-heading">
      <h2 id="post-success-email-heading">Keep your exports on this account</h2>
      <p>Add your email after two exports to keep your allowance connected and speed up Pro checkout later.</p>
      <label class="field-label" for="success-account-email">Email address</label>
      <input
        id="success-account-email"
        type="email"
        autocomplete="email"
        placeholder="you@example.com"
        value={email}
        onInput={(event) => onEmailChange(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && validEmail) onSave();
        }}
      />
      <div class="post-success-email-actions">
        <button class="secondary-button" type="button" disabled={!validEmail} onClick={onSave}>Save email</button>
        <button class="text-button" type="button" onClick={onDismiss}>Not now</button>
      </div>
    </section>
  );
}

interface ReviewPromptProps {
  feedbackState: 'unasked' | 'helpful';
  onHelpful: () => void;
  onReview: () => void;
  onDismiss: () => void;
}

export function ReviewPrompt({ feedbackState, onHelpful, onReview, onDismiss }: ReviewPromptProps) {
  if (feedbackState === 'unasked') {
    return (
      <section class="review-prompt review-prompt-strong" aria-labelledby="review-heading">
        <div class="review-copy">
          <h2 id="review-heading">Did ProtoVid save you a screen recording?</h2>
          <p>A quick answer helps us make prototype exports better.</p>
        </div>
        <div class="secondary-action-row">
          <button class="secondary-button" type="button" onClick={onHelpful}>Yes, it saved me time</button>
          <button class="text-button" type="button" onClick={onDismiss}>Not yet</button>
        </div>
      </section>
    );
  }

  return (
    <section class="review-prompt review-prompt-strong" aria-labelledby="review-heading">
      <div class="review-copy">
        <h2 id="review-heading">Would you share that with other designers?</h2>
        <p>Your Figma Community review helps other designers find ProtoVid.</p>
      </div>
      <button class="secondary-button" type="button" onClick={onReview}>Rate on Figma Community</button>
    </section>
  );
}

interface AccountMenuProps {
  isPro: boolean;
  canManage: boolean;
  onRestore: () => void;
  onUseAnotherEmail: () => void;
  onManage: () => void;
}

export function AccountMenu({ isPro, canManage, onRestore, onUseAnotherEmail, onManage }: AccountMenuProps) {
  return (
    <details class="account-menu">
      <summary><span>Account</span>{isPro && <PlanBadge pro label="Pro active" />}<Icon name="chevron" size={14} /></summary>
      <div class="account-menu-panel">
        {!isPro && <button type="button" onClick={onRestore}>Restore purchase</button>}
        <button type="button" onClick={onUseAnotherEmail}>Use another email</button>
        {canManage && <button type="button" onClick={onManage}>Manage subscription</button>}
      </div>
    </details>
  );
}

interface EmptyStateProps {
  onRefresh: () => void;
  onClose: () => void;
  onOpenGuide: () => void;
}

export function EmptyState({ onRefresh, onClose, onOpenGuide }: EmptyStateProps) {
  return (
    <main class="state-screen empty-state" aria-labelledby="empty-heading">
      <div class="empty-preview" aria-hidden="true"><span /><i /><span /></div>
      <p class="state-eyebrow">1 · Detect</p>
      <h1 id="empty-heading">No connected prototype flow found</h1>
      <p class="state-description">Connect two or more frames in the Prototype panel, then refresh ProtoVid to create a shareable walkthrough.</p>
      <ol class="empty-instructions">
        <li>Select a starting frame in Figma.</li>
        <li>Connect it to the next frame in the Prototype panel.</li>
      </ol>
      <button class="primary-action" type="button" onClick={onRefresh}><Icon name="refresh" size={16} />Refresh flow</button>
      <button class="secondary-button" type="button" onClick={onOpenGuide}>See a 20-second example</button>
      <button class="text-button centered" type="button" onClick={onClose}>Close ProtoVid</button>
    </main>
  );
}

interface ErrorStateProps {
  title: string;
  message: string;
  reassurance?: string;
  primaryLabel: string;
  secondaryLabel?: string | null;
  onPrimary: () => void;
  onSecondary?: () => void;
}

export function ErrorState({ title, message, reassurance, primaryLabel, secondaryLabel, onPrimary, onSecondary }: ErrorStateProps) {
  return (
    <section class="error-state" role="alert" aria-labelledby="error-heading">
      <span class="notice-icon notice-icon-error"><Icon name="alert" size={18} /></span>
      <div class="error-copy">
        <h2 id="error-heading">{title}</h2>
        <p>{message}</p>
        {reassurance && <p class="reassurance">{reassurance}</p>}
        <div class="notice-actions">
          <button class="secondary-button" type="button" onClick={onPrimary}>{primaryLabel}</button>
          {secondaryLabel && onSecondary && <button class="text-button" type="button" onClick={onSecondary}>{secondaryLabel}</button>}
        </div>
      </div>
    </section>
  );
}

interface InlineNoticeProps {
  tone?: 'info' | 'success' | 'warning';
  children: ComponentChildren;
}

export function InlineNotice({ tone = 'info', children }: InlineNoticeProps) {
  return (
    <div class={`inline-notice inline-notice-${tone}`} role="status" aria-live="polite">
      <Icon name={tone === 'success' ? 'check' : tone === 'warning' ? 'alert' : 'info'} size={16} />
      <span>{children}</span>
    </div>
  );
}

interface SuccessActionsProps {
  downloadUrl: string;
  filename: string;
  onDownload: () => void;
  onAnother: () => void;
  onCopy: () => void;
  onShare: () => void;
  shareState: 'idle' | 'creating' | 'ready' | 'error';
}

export function SuccessActions({ downloadUrl, filename, onDownload, onAnother, onCopy, onShare, shareState }: SuccessActionsProps) {
  const actions = getSuccessActions(Boolean(downloadUrl));
  const shareAction = actions.find(action => action.id === 'share')!;
  const downloadAction = actions.find(action => action.id === 'download')!;
  const anotherAction = actions.find(action => action.id === 'another')!;
  const copyAction = actions.find(action => action.id === 'copy')!;
  return (
    <div class="success-actions">
      <a class="primary-action success-download-action" href={downloadUrl} download={filename} onClick={onDownload} aria-disabled={!downloadAction.enabled}><Icon name="download" size={17} />{downloadAction.label}</a>
      <div class="secondary-action-row">
        <button class="secondary-button" type="button" onClick={onShare} disabled={!shareAction.enabled || shareState === 'creating'}>
          <Icon name="share" size={15} />
          {shareState === 'creating' ? 'Creating review link…' : shareState === 'ready' ? 'Copy review link' : shareAction.label}
        </button>
        <button class="secondary-button" type="button" onClick={onAnother}><Icon name="repeat" size={15} />{anotherAction.label}</button>
        <button class="secondary-button" type="button" onClick={onCopy}><Icon name="copy" size={15} />{copyAction.label}</button>
      </div>
    </div>
  );
}

interface ShareInvitePanelProps {
  shareUrl: string;
  onCopyLink: () => void;
  onNativeShare: () => void;
  onEmailInvite: (email: string) => void;
  nativeShareAvailable: boolean;
}

/** A small distribution surface for the review link created after export. */
export function ShareInvitePanel({
  shareUrl,
  onCopyLink,
  onNativeShare,
  onEmailInvite,
  nativeShareAvailable,
}: ShareInvitePanelProps) {
  const [inviteEmail, setInviteEmail] = useState('');
  const validEmail = inviteEmail.trim().includes('@');

  return (
    <section class="share-invite-panel" aria-labelledby="share-invite-heading">
      <div class="share-invite-copy">
        <div class="share-invite-heading-row">
          <span class="share-invite-icon"><Icon name="share" size={15} /></span>
          <div>
            <h2 id="share-invite-heading">Invite reviewers</h2>
            <p>Send this decision room with the MP4, review brief, timestamped feedback, and approval.</p>
          </div>
        </div>
        <div class="share-link-row">
          <input aria-label="Review link" type="text" readOnly value={shareUrl} onFocus={(event) => event.currentTarget.select()} />
          <button class="secondary-button" type="button" onClick={onCopyLink}><Icon name="copy" size={14} />Copy</button>
        </div>
      </div>
      <div class="share-invite-controls">
        <label class="field-label" for="reviewer-email">Email a reviewer <span>optional</span></label>
        <div class="share-invite-email-row">
          <input
            id="reviewer-email"
            type="email"
            inputMode="email"
            autocomplete="email"
            placeholder="client@company.com"
            value={inviteEmail}
            onInput={(event) => setInviteEmail(event.currentTarget.value)}
          />
          <button class="secondary-button" type="button" disabled={!validEmail} onClick={() => onEmailInvite(inviteEmail.trim())}>
            Email invite
          </button>
        </div>
        {nativeShareAvailable && <button class="share-native-button" type="button" onClick={onNativeShare}><Icon name="share" size={14} />Share from your device</button>}
      </div>
      <p class="share-invite-note">The brief is generated by ProtoVid from this export. Anyone with the link can comment; only you can approve or request changes from the private owner link.</p>
    </section>
  );
}
