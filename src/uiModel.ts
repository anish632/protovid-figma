export const RESOLUTIONS = ['720p', '1080p', '4K'] as const;

export interface PathRecommendationCandidate {
  id: string;
  frameCount: number;
  preflightStatus: 'ready' | 'long_path' | 'split_recommended';
  truncated: boolean;
}

/** Pick a reliable, short default route while keeping alternate paths available. */
export function getRecommendedPathId(paths: PathRecommendationCandidate[]): string | null {
  const reliable = paths
    .filter(path => !path.truncated && path.preflightStatus === 'ready')
    .sort((a, b) => a.frameCount - b.frameCount || a.id.localeCompare(b.id));
  if (reliable[0]) return reliable[0].id;

  const safeFallback = paths
    .filter(path => !path.truncated)
    .sort((a, b) => a.frameCount - b.frameCount || a.id.localeCompare(b.id));
  return safeFallback[0]?.id || null;
}

export type Resolution = (typeof RESOLUTIONS)[number];
export type PlanTier = 'free' | 'pro';

export type ShareExperimentVariant = 'control' | 'invite_panel';
export type PaidOfferPlan = 'monthly' | 'large_export';

export function getExperimentPrimaryPlan(
  configuredPrimaryOffer: PaidOfferPlan,
  projectPassAvailable: boolean,
): PaidOfferPlan {
  return configuredPrimaryOffer === 'large_export' && projectPassAvailable
    ? 'large_export'
    : 'monthly';
}

/** Stable 50/50 assignment for the share distribution experiment. */
export function getShareExperimentVariant(anonymousId: string | null): ShareExperimentVariant {
  const seed = anonymousId || 'protovid-fallback-seed';
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash % 2 === 0 ? 'control' : 'invite_panel';
}

export type VoiceCommand =
  | { type: 'export' }
  | { type: 'refresh' }
  | { type: 'set-resolution'; resolution: Resolution }
  | { type: 'download' }
  | { type: 'share' }
  | { type: 'another-export' }
  | { type: 'choose-path' }
  | { type: 'select-path'; index: number }
  | { type: 'upgrade' }
  | { type: 'close' }
  | { type: 'help' };

function normalizeVoiceText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.,!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Convert short spoken phrases into existing UI actions. Keeping this parser
 * separate from the speech API makes voice behavior deterministic and easy to
 * test without a microphone or browser permissions.
 */
export function parseVoiceCommand(input: string): VoiceCommand | null {
  const text = normalizeVoiceText(input);
  if (!text) return null;

  if (/^(help|what can i say|voice help)$/.test(text)) return { type: 'help' };
  if (/\b(close|exit|quit)\b/.test(text)) return { type: 'close' };
  if (/\b(stop listening|cancel listening)\b/.test(text)) return null;

  const resolutionMatch = text.match(/(?:set|change|use|export in|export at)\s+(?:(?:the\s+)?resolution\s+)?(?:to\s+)?(720p?|720|seven twenty|1080p?|1080|ten eighty|4k|4 k|four k|four kay)\b/);
  if (resolutionMatch) {
    const spokenResolution = resolutionMatch[1].replace(/\s/g, '');
    if (spokenResolution === '4k' || spokenResolution === 'fourk' || spokenResolution === 'fourkay') {
      return { type: 'set-resolution', resolution: '4K' };
    }
    if (spokenResolution === '1080p' || spokenResolution === '1080' || spokenResolution === 'teneighty') {
      return { type: 'set-resolution', resolution: '1080p' };
    }
    return { type: 'set-resolution', resolution: '720p' };
  }

  const pathMatch = text.match(/(?:select|choose|use)\s+(?:path|route)\s+(first|second|third|fourth|\d+)/);
  if (pathMatch) {
    const spokenIndex = pathMatch[1];
    const ordinalIndex: Record<string, number> = {
      first: 0,
      second: 1,
      third: 2,
      fourth: 3,
    };
    const index = ordinalIndex[spokenIndex] ?? Number(spokenIndex) - 1;
    if (Number.isInteger(index) && index >= 0) return { type: 'select-path', index };
  }

  if (/\b(choose|select|pick)\b.*\b(path|route|start frame)\b|\b(choose|select) another start\b/.test(text)) {
    return { type: 'choose-path' };
  }
  if (/\b(another export|export another|start over|new export)\b/.test(text)) return { type: 'another-export' };
  if (/\b(download|save)\b.*\b(mp4|video|file)?\b|\bget the mp4\b/.test(text)) return { type: 'download' };
  if (/\b(share|create|make)\b.*\b(review link|share link|client link)\b|\bshare it\b/.test(text)) return { type: 'share' };
  if (/\b(refresh|rescan|scan)\b.*\b(flow|prototype|connections)?\b/.test(text)) return { type: 'refresh' };
  if (/\b(upgrade|go pro|buy pro)\b/.test(text)) return { type: 'upgrade' };
  if (/\b(export|render|create)\b.*\b(video|mp4|walkthrough)?\b|\bmake the video\b/.test(text)) return { type: 'export' };

  return null;
}

export interface ResolutionOptionModel {
  value: Resolution;
  label: Resolution;
  availability: 'included' | 'requires-pro';
  badge: 'Pro' | null;
  isSelectable: true;
  helperText: string;
}

export interface ResolutionSelectionModel {
  resolution: Resolution;
  canExport: boolean;
  requiresUpgrade: boolean;
  message: string | null;
}

function isProResolution(resolution: Resolution): boolean {
  return resolution === '1080p' || resolution === '4K';
}

/**
 * Resolution choices remain selectable so Free users can understand the Pro
 * benefit before deciding whether to upgrade. Availability controls export,
 * rather than making a visually ambiguous disabled tile.
 */
export function getResolutionOptions(plan: PlanTier): ResolutionOptionModel[] {
  return RESOLUTIONS.map((resolution) => {
    const requiresUpgrade = plan === 'free' && isProResolution(resolution);

    return {
      value: resolution,
      label: resolution,
      availability: requiresUpgrade ? 'requires-pro' : 'included',
      badge: requiresUpgrade ? 'Pro' : null,
      isSelectable: true,
      helperText: requiresUpgrade
        ? 'Upgrade for HD or 4K without the watermark.'
        : resolution === '720p'
          ? 'Optimized for quick review.'
          : 'Client-ready quality without a watermark.',
    };
  });
}

export function getResolutionSelection(
  resolution: Resolution,
  plan: PlanTier,
): ResolutionSelectionModel {
  const requiresUpgrade = plan === 'free' && isProResolution(resolution);

  return {
    resolution,
    canExport: !requiresUpgrade,
    requiresUpgrade,
    message: requiresUpgrade
      ? `${resolution} is available with Pro for a clean, client-ready MP4.`
      : null,
  };
}

function normalizeRemainingExports(remaining: number): number {
  if (!Number.isFinite(remaining)) return 0;
  return Math.max(0, Math.floor(remaining));
}

export function getRemainingExportsCopy(
  remaining: number,
  plan: PlanTier = 'free',
): string {
  if (plan === 'pro') return 'Unlimited exports included';

  const normalizedRemaining = normalizeRemainingExports(remaining);
  if (normalizedRemaining === 0) return 'No free exports remaining this month';
  if (normalizedRemaining === 1) return '1 free export remaining this month';
  return `${normalizedRemaining} free exports remaining this month`;
}

export type PrimaryActionIntent = 'export' | 'upgrade' | 'refresh' | 'choose-path' | 'wait';

export interface PrimaryActionInput {
  plan: PlanTier;
  resolution: Resolution;
  remainingExports: number | null;
  flowReady?: boolean;
  isExporting?: boolean;
  isCheckoutPending?: boolean;
  hasPreviousExport?: boolean;
}

export interface PrimaryActionModel {
  label: string;
  supportingText: string;
  intent: PrimaryActionIntent;
  disabled: boolean;
}

export function getPrimaryActionModel({
  plan,
  resolution,
  remainingExports,
  flowReady = true,
  isExporting = false,
  isCheckoutPending = false,
  hasPreviousExport = false,
}: PrimaryActionInput): PrimaryActionModel {
  if (isExporting) {
    return {
      label: 'Creating MP4…',
      supportingText: 'Your flow and settings are locked for this export.',
      intent: 'wait',
      disabled: true,
    };
  }

  if (isCheckoutPending) {
    return {
      label: 'Opening secure checkout…',
      supportingText: 'Secure checkout powered by Stripe.',
      intent: 'wait',
      disabled: true,
    };
  }

  if (!flowReady) {
    return {
      label: 'Refresh flow',
      supportingText: 'Connect your frames in Figma, then try again.',
      intent: 'refresh',
      disabled: false,
    };
  }

  if (plan === 'free' && remainingExports === null) {
    return {
      label: 'Checking allowance…',
      supportingText: 'This usually takes only a moment.',
      intent: 'wait',
      disabled: true,
    };
  }

  if (plan === 'free' && normalizeRemainingExports(remainingExports ?? 0) === 0) {
    return {
      label: 'Upgrade to continue',
      supportingText: 'You’ve used all free exports this month.',
      intent: 'upgrade',
      disabled: false,
    };
  }

  const resolutionSelection = getResolutionSelection(resolution, plan);
  if (resolutionSelection.requiresUpgrade) {
    return {
      label: `Upgrade for ${resolution}`,
      supportingText: 'Export in HD or 4K without the watermark.',
      intent: 'upgrade',
      disabled: false,
    };
  }

  if (plan === 'pro') {
    return {
      label: hasPreviousExport ? 'Export updated version' : 'Export client-ready MP4',
      supportingText: hasPreviousExport ? 'Reuse your saved flow and settings' : `${resolution} without a watermark`,
      intent: 'export',
      disabled: false,
    };
  }

  return {
    label: 'Export free proof',
    supportingText: '720p with ProtoVid watermark',
    intent: 'export',
    disabled: false,
  };
}

export interface ExportSummaryInput {
  plan: PlanTier;
  resolution: Resolution;
  estimatedDuration?: string | null;
  estimatedSize?: string | null;
}

export function getExportSummaryCopy({
  plan,
  resolution,
  estimatedDuration,
  estimatedSize,
}: ExportSummaryInput): string {
  const requiresUpgrade = getResolutionSelection(resolution, plan).requiresUpgrade;
  const summary = requiresUpgrade
    ? ['MP4', resolution, 'Pro required', 'No watermark']
    : plan === 'pro'
      ? ['MP4', resolution, 'Client-ready', 'No watermark']
      : ['MP4', '720p', 'Free proof', 'Watermark included'];

  if (estimatedDuration) summary.push(estimatedDuration);
  if (estimatedSize) summary.push(estimatedSize);
  return summary.join(' · ');
}

export const SUCCESS_ACTIONS = [
  { id: 'download', label: 'Download MP4', priority: 'primary' },
  { id: 'share', label: 'Create client review link', priority: 'secondary' },
  { id: 'another', label: 'Export another', priority: 'secondary' },
  { id: 'copy', label: 'Copy export details', priority: 'secondary' },
] as const;

export function getSuccessActions(hasFile: boolean) {
  return SUCCESS_ACTIONS.map(action => ({
    ...action,
    enabled: action.id === 'share' || action.id === 'download' ? hasFile : true,
  }));
}

export type RestoreResult = 'checking' | 'restored' | 'not-found' | 'failed';

export function getRestoreResultModel(result: RestoreResult): {
  status: 'loading' | 'success' | 'error';
  message: string;
  canRetry: boolean;
} {
  if (result === 'checking') {
    return { status: 'loading', message: 'Checking for an active purchase…', canRetry: false };
  }
  if (result === 'restored') {
    return { status: 'success', message: 'Pro restored for this email.', canRetry: false };
  }
  if (result === 'not-found') {
    return {
      status: 'error',
      message: 'No active Pro plan was found for that email. Your free allowance is still available.',
      canRetry: true,
    };
  }
  return {
    status: 'error',
    message: 'Purchase could not be restored. Check your connection and try again.',
    canRetry: true,
  };
}

export const EXPORT_PROGRESS_STAGES = [
  { id: 'preparing', label: 'Preparing frames', startsAt: 0 },
  { id: 'rendering', label: 'Rendering transitions', startsAt: 25 },
  { id: 'encoding', label: 'Encoding MP4', startsAt: 60 },
  { id: 'finalizing', label: 'Finalizing download', startsAt: 90 },
] as const;

export type ExportProgressStage = (typeof EXPORT_PROGRESS_STAGES)[number];
export type ProgressStepStatus = 'complete' | 'current' | 'upcoming';

export interface ProgressStepModel {
  id: ExportProgressStage['id'];
  label: ExportProgressStage['label'];
  status: ProgressStepStatus;
}

export interface ExportProgressModel {
  percent: number;
  currentStage: ExportProgressStage;
  steps: ProgressStepModel[];
}

function normalizeProgress(percent: number): number {
  if (!Number.isFinite(percent)) return 0;
  return Math.min(100, Math.max(0, Math.round(percent)));
}

export function mapEncoderProgressToOverall(percent: number, currentOverall = 60): number {
  const normalizedEncoderProgress = normalizeProgress(percent);
  const mapped = Math.round(60 + normalizedEncoderProgress * 0.36);
  return Math.max(normalizeProgress(currentOverall), mapped);
}

export function mapCaptureProgressToOverall(percent: number, currentOverall = 0): number {
  const normalizedCaptureProgress = Math.min(60, normalizeProgress(percent));
  const mapped = Math.round((normalizedCaptureProgress / 60) * 24);
  return Math.max(normalizeProgress(currentOverall), mapped);
}

export function mapPluginProgressToOverall(stage: string, percent: number, currentOverall = 0): number {
  if (stage === 'rendering') {
    const renderingProgress = Math.min(59, Math.max(25, normalizeProgress(percent)));
    return Math.max(normalizeProgress(currentOverall), renderingProgress);
  }
  return mapCaptureProgressToOverall(percent, currentOverall);
}

export function getProgressStage(percent: number): ExportProgressStage {
  const normalizedPercent = normalizeProgress(percent);

  for (let index = EXPORT_PROGRESS_STAGES.length - 1; index >= 0; index -= 1) {
    const stage = EXPORT_PROGRESS_STAGES[index];
    if (normalizedPercent >= stage.startsAt) return stage;
  }

  return EXPORT_PROGRESS_STAGES[0];
}

export function getExportProgressModel(percent: number): ExportProgressModel {
  const normalizedPercent = normalizeProgress(percent);
  const currentStage = getProgressStage(normalizedPercent);
  const currentIndex = EXPORT_PROGRESS_STAGES.findIndex(
    (stage) => stage.id === currentStage.id,
  );

  return {
    percent: normalizedPercent,
    currentStage,
    steps: EXPORT_PROGRESS_STAGES.map((stage, index) => ({
      id: stage.id,
      label: stage.label,
      status: index < currentIndex
        ? 'complete'
        : index === currentIndex
          ? 'current'
          : 'upcoming',
    })),
  };
}

export interface ExportRequestGate {
  activeRequestId: string | null;
}

export interface ExportRequestDecision {
  accepted: boolean;
  reason: 'started' | 'duplicate' | 'in-progress' | 'invalid-request';
  gate: ExportRequestGate;
}

export function createExportRequestGate(): ExportRequestGate {
  return { activeRequestId: null };
}

export function requestExport(
  gate: ExportRequestGate,
  requestId: string,
): ExportRequestDecision {
  const normalizedRequestId = requestId.trim();
  if (!normalizedRequestId) {
    return { accepted: false, reason: 'invalid-request', gate };
  }

  if (gate.activeRequestId !== null) {
    return {
      accepted: false,
      reason: gate.activeRequestId === normalizedRequestId ? 'duplicate' : 'in-progress',
      gate,
    };
  }

  return {
    accepted: true,
    reason: 'started',
    gate: { activeRequestId: normalizedRequestId },
  };
}

export function finishExportRequest(
  gate: ExportRequestGate,
  requestId: string,
): ExportRequestGate {
  return gate.activeRequestId === requestId
    ? createExportRequestGate()
    : gate;
}

export type RecoverableExportErrorCode =
  | 'offline'
  | 'network'
  | 'invalid-flow'
  | 'unsupported-content'
  | 'flow-too-large'
  | 'export-failed';

export interface RecoverableErrorModel {
  code: RecoverableExportErrorCode;
  title: string;
  message: string;
  reassurance: string;
  primaryAction: 'Try again' | 'Review flow';
  secondaryAction: 'Review flow' | null;
}

function normalizeErrorCode(error: unknown): RecoverableExportErrorCode {
  const candidate = typeof error === 'string'
    ? error
    : error && typeof error === 'object' && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';
  const normalized = candidate.toLowerCase();

  if (normalized === 'offline' || normalized.includes('offline')) return 'offline';
  if (
    normalized === 'network' ||
    normalized.includes('network') ||
    normalized.includes('fetch') ||
    normalized.includes('timeout')
  ) return 'network';
  if (
    normalized.includes('invalid-flow') ||
    normalized.includes('broken-interaction') ||
    normalized.includes('prototype path') ||
    normalized.includes('frame order') ||
    normalized.includes('no longer connected') ||
    normalized.includes('scan again and choose')
  ) {
    return 'invalid-flow';
  }
  if (
    normalized.includes('unsupported') ||
    normalized.includes('could not capture') ||
    normalized.includes('visible content')
  ) return 'unsupported-content';
  if (
    normalized.includes('flow-too-large') ||
    normalized.includes('payload-too-large') ||
    normalized.includes('too large') ||
    normalized.includes('413')
  ) return 'flow-too-large';
  return 'export-failed';
}

/** Maps diagnostics to approved user copy and never returns raw backend text. */
export function getRecoverableErrorModel(error: unknown): RecoverableErrorModel {
  const code = normalizeErrorCode(error);
  const reassurance = 'Your selected flow and settings are still available.';

  switch (code) {
    case 'offline':
      return {
        code,
        title: 'You appear to be offline',
        message: 'Reconnect and try again.',
        reassurance,
        primaryAction: 'Try again',
        secondaryAction: null,
      };
    case 'network':
      return {
        code,
        title: 'Export could not be completed',
        message: 'ProtoVid could not reach the export service. Check your connection and try again.',
        reassurance,
        primaryAction: 'Try again',
        secondaryAction: null,
      };
    case 'invalid-flow':
      return {
        code,
        title: 'Flow needs attention',
        message: 'ProtoVid could not follow one or more prototype connections.',
        reassurance,
        primaryAction: 'Review flow',
        secondaryAction: null,
      };
    case 'unsupported-content':
      return {
        code,
        title: 'Some frame content is not supported',
        message: 'Review the affected frame, then try the export again.',
        reassurance,
        primaryAction: 'Review flow',
        secondaryAction: null,
      };
    case 'flow-too-large':
      return {
        code,
        title: 'This flow is too large to export',
        message: 'This export is too large to send as one request. Shorten the flow or remove oversized assets, then try again.',
        reassurance,
        primaryAction: 'Review flow',
        secondaryAction: null,
      };
    default:
      return {
        code: 'export-failed',
        title: 'Export could not be completed',
        message: 'Try again, or review the flow if the problem continues.',
        reassurance,
        primaryAction: 'Try again',
        secondaryAction: 'Review flow',
      };
  }
}
