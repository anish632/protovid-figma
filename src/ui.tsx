// ProtoVid - Plugin UI (runs in iframe)
import { h, render } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { encodeVideo, type EncodeTelemetryEvent } from './encoder';
import {
  isValidAccountEmail,
  getExportProgressModel,
  getExperimentPrimaryPlan,
  getExportSummaryCopy,
  getPrimaryActionModel,
  getRecoverableErrorModel,
  getRemainingExportsCopy,
  getCheckoutConfirmCopy,
  getPaidAccessActivatedNotice,
  getRestoreResultModel,
  getShareExperimentVariant,
  getResolutionOptions,
  getResolutionSelection,
  mapEncoderProgressToOverall,
  mapPluginProgressToOverall,
  createExportRequestGate,
  finishExportRequest,
  parseVoiceCommand,
  requestExport,
  ExportFormat,
  Resolution,
  VoiceCommand,
} from './uiModel';
import {
  AccountMenu,
  AppHeader,
  EmptyState,
  ErrorState,
  ExportSummary,
  FileSummary,
  FlowStatus,
  FormatSelector,
  Icon,
  InlineNotice,
  ProgressSteps,
  ResolutionSelector,
  SectionCard,
  ShareInvitePanel,
  StickyActionBar,
  SuccessActions,
  TrustRow,
  UpgradeCard,
  UpgradeChoicePanel,
  PostSuccessEmailSave,
  ReviewPrompt,
} from './uiComponents';
import {
  FREE_RESOLUTION,
  LARGE_FLOW_PASS_ACCESS_DAYS,
  LARGE_FLOW_PASS_CENTS,
  LARGE_FLOW_PASS_DISPLAY,
  PRO_PRICE_MONTHLY_CENTS,
  PRO_PRICE_MONTHLY_DISPLAY,
} from './planConfig';
import {
  ENTITLEMENT_VERIFICATION_ERROR,
  EntitlementResponse,
} from './entitlement';

interface AppState {
  stage: 'loading' | 'setup' | 'scanning' | 'exporting' | 'complete' | 'checking-payment';
  hasPrototype: boolean;
  frameCount: number;
  unconnectedFrameCount: number;
  prototypePaths: PrototypePath[];
  selectedPathId: string;
  pathSelectionRequired: boolean;
  pathEnumerationTruncated: boolean;
  activeExportFrameCount: number;
  activeExportAttemptId: string | null;
  entitlement: EntitlementResponse | null;
  anonymousId: string | null;
  projectId: string | null;
  entitlementError: boolean;
  isPremium: boolean;
  userEmail: string;
  paymentCheckAvailable: boolean;
  pricingVariant: string;
  monthlyPriceLabel: string;
  monthlyAmountCents: number;
  pricingLoadedEmail: string;
  largeFlowPassAvailable: boolean;
  largeFlowPassLabel: string;
  largeFlowPassAmountCents: number;
  largeFlowPassAccessDays: number;
  offerExperimentId: string;
  offerExperimentVariant: 'pro_first' | 'project_pass_first';
  primaryOffer: 'monthly' | 'large_export';
  pendingCheckoutUrl: string;
  pendingCheckoutEmail: string;
  pendingCheckoutPlan: 'monthly' | 'large_export' | '';
  pendingCheckoutSessionId: string;
  trialExpired: boolean;
  daysSinceFirstExport: number | null;
  settings: {
    resolution: '720p' | '1080p' | '4K';
    format: ExportFormat;
    showCursor: boolean;
  };
  progress: {
    stage: string;
    percent: number;
  };
  error: string | null;
  notice: string | null;
  videoUrl: string | null;
  downloadFilename: string | null;
  shareUrl: string | null;
  ownerShareUrl: string | null;
  shareState: 'idle' | 'creating' | 'ready' | 'error';
  outputWidth: number | null;
  outputHeight: number | null;
  deliveryProfile: 'requested' | 'fallback' | null;
  fileSizeBytes: number | null;
  exportStartedAt: number | null;
  downloadStarted: boolean;
  checkoutState: 'idle' | 'opening' | 'pending' | 'success' | 'cancelled' | 'error';
  restoreState: 'idle' | 'checking' | 'success' | 'error';
  flowAnalysis: FlowAnalysis | null;
  savedExport: SavedExportInfo | null;
}

interface SavedExportInfo {
  settings: {
    resolution: Resolution;
    format: ExportFormat;
    showCursor: boolean;
  };
  selectedPathId?: string;
  selectedPathFrameIds?: string[];
  lastSuccessfulExportAt: string;
  lastSuccessfulExportId: string;
}

interface PrototypePath {
  id: string;
  frameIds: string[];
  frameCount: number;
  startNodeId: string;
  endNodeId: string;
  startNodeName?: string | null;
  endNodeName?: string | null;
  label: string;
  estimatedDuration?: number;
  preflight?: {
    status: 'ready' | 'long_path' | 'split_recommended';
    message: string | null;
  };
  truncated?: boolean;
  truncationReason?: 'cycle' | null;
  reliabilityHint?: string;
}

interface FlowAnalysis {
  totalFrames?: number;
  estimatedDuration?: number;
  hasTransitions?: boolean;
  pathCount?: number;
  pathSelectionRequired?: boolean;
  maxPathFrameCount?: number;
  pathEnumerationTruncated?: boolean;
  mixedDimensions?: boolean;
}

const BACKEND_URL = 'https://protovid.dasgroupllc.com';
import { PLUGIN_VERSION } from './version';
type UpgradeSource = 'upsell_card' | 'free_limit_paywall' | 'large_flow_pass';
type CheckoutPlan = 'monthly' | 'large_export';

type AnalyticsPayload = {
  email?: string | null;
  eventType: string;
  pluginVersion?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

let uiAnalyticsQueue: Promise<void> = Promise.resolve();

function sendAnalyticsEvent(payload: AnalyticsPayload): Promise<void> {
  uiAnalyticsQueue = uiAnalyticsQueue.then(async () => {
    try {
      await fetch(`${BACKEND_URL}/api/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          ...payload,
          pluginVersion: payload.pluginVersion || PLUGIN_VERSION,
        }),
      });
    } catch (_error) {
      // Product work must never be blocked by analytics delivery.
    }
  });
  return uiAnalyticsQueue;
}

type VoiceStatus = 'idle' | 'listening' | 'processing' | 'unsupported' | 'error';

interface VoiceRecognitionEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface VoiceRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: VoiceRecognitionEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
}

type VoiceRecognitionConstructor = new () => VoiceRecognition;

function getVoiceRecognitionConstructor(): VoiceRecognitionConstructor | null {
  if (window.isSecureContext === false) return null;
  const speechWindow = window as typeof window & {
    SpeechRecognition?: VoiceRecognitionConstructor;
    webkitSpeechRecognition?: VoiceRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null;
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

function getFormatLabel(format: ExportFormat): string {
  return format.toUpperCase();
}

function getFormatMime(format: ExportFormat): string {
  if (format === 'webm') return 'video/webm';
  if (format === 'gif') return 'image/gif';
  return 'video/mp4';
}

function formatAccessEnd(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function deriveEntitlementState(entitlement: EntitlementResponse | null) {
  return {
    entitlement,
    entitlementError: false,
    isPremium: entitlement?.isPaid ?? false,
  };
}

function toUint8Array(data: any): Uint8Array {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  return new Uint8Array(data);
}

function normalizeLayerMotion(layer: any) {
  if (!layer) return layer;
  return {
    ...layer,
    source: layer.source ? {
      ...layer.source,
      imageData: layer.source.imageData ? toUint8Array(layer.source.imageData) : undefined,
    } : layer.source,
    destination: layer.destination ? {
      ...layer.destination,
      imageData: layer.destination.imageData ? toUint8Array(layer.destination.imageData) : undefined,
    } : layer.destination,
  };
}

function normalizeTransitionIn(transition: any) {
  if (!transition) return null;
  return {
    ...transition,
    smartAnimateLayers: Array.isArray(transition.smartAnimateLayers)
      ? transition.smartAnimateLayers.map(normalizeLayerMotion)
      : transition.smartAnimateLayers ?? null,
  };
}

function App() {
  const [state, setState] = useState<AppState>({
    stage: 'loading',
    hasPrototype: false,
    frameCount: 0,
    unconnectedFrameCount: 0,
    prototypePaths: [],
    selectedPathId: '',
    pathSelectionRequired: false,
    pathEnumerationTruncated: false,
    activeExportFrameCount: 0,
    activeExportAttemptId: null,
    entitlement: null,
    anonymousId: null,
    projectId: null,
    entitlementError: false,
    isPremium: false,
    userEmail: '',
    paymentCheckAvailable: false,
    pricingVariant: 'studio_monthly',
    monthlyPriceLabel: PRO_PRICE_MONTHLY_DISPLAY,
    monthlyAmountCents: PRO_PRICE_MONTHLY_CENTS,
    pricingLoadedEmail: '',
    largeFlowPassAvailable: true,
    largeFlowPassLabel: LARGE_FLOW_PASS_DISPLAY,
    largeFlowPassAmountCents: LARGE_FLOW_PASS_CENTS,
    largeFlowPassAccessDays: LARGE_FLOW_PASS_ACCESS_DAYS,
    offerExperimentId: 'project_pass_primary_v1',
    offerExperimentVariant: 'project_pass_first',
    primaryOffer: 'large_export',
    pendingCheckoutUrl: '',
    pendingCheckoutEmail: '',
    pendingCheckoutPlan: '',
    pendingCheckoutSessionId: '',
    trialExpired: false,
    daysSinceFirstExport: null,
    settings: {
      resolution: FREE_RESOLUTION,
      format: 'mp4',
      showCursor: true
    },
    progress: {
      stage: '',
      percent: 0
    },
    error: null,
    notice: null,
    videoUrl: null,
    downloadFilename: null,
    shareUrl: null,
    ownerShareUrl: null,
    shareState: 'idle',
    outputWidth: null,
    outputHeight: null,
    deliveryProfile: null,
    fileSizeBytes: null,
    exportStartedAt: null,
    downloadStarted: false,
    checkoutState: 'idle',
    restoreState: 'idle',
    flowAnalysis: null,
    savedExport: null,
  });

  // Email is collected just-in-time at checkout (not before the first export).
  const [needEmail, setNeedEmail] = useState(false);
  const [emailIntent, setEmailIntent] = useState<'checkout' | 'restore' | 'switch' | 'save'>('checkout');
  const [showPostSuccessEmailSave, setShowPostSuccessEmailSave] = useState(false);
  const [reviewFeedback, setReviewFeedback] = useState<'unasked' | 'helpful' | 'dismissed'>('unasked');
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>(() =>
    getVoiceRecognitionConstructor() ? 'idle' : 'unsupported'
  );
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // The window.onmessage handler below is bound once (empty-deps effect), so
  // reading `state` inside it would capture the first render's values forever.
  // Mirror the latest state here and read from the ref inside that handler.
  const stateRef = useRef(state);
  stateRef.current = state;

  const pollTimerRef = useRef<number | null>(null);
  const pollGenerationRef = useRef(0);
  const checkoutReturnStageRef = useRef<AppState['stage']>('setup');
  const autoDownloadUrlRef = useRef<string | null>(null);
  const demoStateTrackedRef = useRef(false);
  const limitPaywallViewedRef = useRef(false);
  const postExportUpsellTrackedRef = useRef<string | null>(null);
  const postSuccessEmailPromptTrackedRef = useRef(false);
  const postSuccessEmailDismissedRef = useRef(false);
  // Users who never get a prototype detected re-refresh several times (median 6
  // failures per stuck user in production). Escalate once per session so we
  // stop leaving them looping in the empty state.
  const consecutiveFlowFailuresRef = useRef(0);
  const stuckGuideAutoOpenedRef = useRef(false);
  const pricingEmailRef = useRef('');
  const upgradeSourceRef = useRef<UpgradeSource>('upsell_card');
  const upgradePlanRef = useRef<CheckoutPlan>('monthly');
  const restoreInProgressRef = useRef(false);
  const accountSwitchInProgressRef = useRef(false);
  const exportRequestGateRef = useRef(createExportRequestGate());
  const checkoutRequestLockedRef = useRef(false);
  const voiceRecognitionRef = useRef<VoiceRecognition | null>(null);
  const voiceCommandHandlerRef = useRef<(command: VoiceCommand, transcript: string) => void>(() => {});
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const releaseExportRequest = () => {
    const activeRequestId = exportRequestGateRef.current.activeRequestId;
    if (!activeRequestId) return;
    exportRequestGateRef.current = finishExportRequest(exportRequestGateRef.current, activeRequestId);
  };

  const focusEmailCapture = () => {
    window.setTimeout(() => {
      const input = document.getElementById('account-email') as HTMLInputElement | null;
      input?.scrollIntoView({ block: 'center' });
      input?.focus();
      input?.select();
    }, 0);
  };

  const finishExportTransition = async () => {
    setState(prev => ({
      ...prev,
      progress: {
        stage: 'finalizing',
        percent: Math.max(prev.progress.percent, 96),
      }
    }));
    await new Promise<void>(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));
  };

  // Stop polling on unmount
  useEffect(() => {
    return () => {
      pollGenerationRef.current += 1;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (voiceRecognitionRef.current) {
        try {
          voiceRecognitionRef.current.stop();
        } catch (_error) {
          // Recognition may already have ended.
        }
        voiceRecognitionRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (state.stage !== 'exporting') {
      setElapsedSeconds(0);
      return;
    }

    const startedAt = state.exportStartedAt || Date.now();
    const updateElapsed = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
    return () => clearInterval(timer);
  }, [state.stage, state.exportStartedAt]);

  useEffect(() => {
    // Initialize
    parent.postMessage({
      pluginMessage: {
        type: 'track-event',
        data: { eventType: 'flow_detection_started', metadata: { source: 'initial' } }
      }
    }, '*');
    parent.postMessage({ pluginMessage: { type: 'init' } }, '*');

    // Listen for messages from plugin code
    window.onmessage = async (event) => {
      const msg = event.data.pluginMessage;
      if (!msg) return;

      switch (msg.type) {
        case 'analytics-event':
          void sendAnalyticsEvent(msg.data as AnalyticsPayload);
          break;

        case 'preview-state':
          if (location.hostname !== '127.0.0.1' && location.hostname !== 'localhost') break;
          if (msg.data?.stage !== 'exporting') releaseExportRequest();
          if (msg.data?.downloadStarted && msg.data?.videoUrl) {
            autoDownloadUrlRef.current = msg.data.videoUrl;
          }
          setState(prev => ({
            ...prev,
            ...msg.data,
            settings: msg.data?.settings ? { ...prev.settings, ...msg.data.settings } : prev.settings,
            progress: msg.data?.progress ? { ...prev.progress, ...msg.data.progress } : prev.progress,
          }));
          break;

        case 'init-complete':
          {
          const initPaths: PrototypePath[] = Array.isArray(msg.data.paths) ? msg.data.paths : [];
          const savedExport = msg.data.savedExportPreferences as SavedExportInfo | null;
          const savedPathId = savedExport?.selectedPathId && initPaths.some(path => path.id === savedExport.selectedPathId)
            ? savedExport.selectedPathId
            : '';
          setState(prev => ({
            ...prev,
            stage: 'setup',
            hasPrototype: msg.data.hasPrototype,
            unconnectedFrameCount: typeof msg.data.unconnectedFrameCount === 'number' ? msg.data.unconnectedFrameCount : 0,
            frameCount: msg.data.frameCount,
            prototypePaths: initPaths,
            pathSelectionRequired: msg.data.pathSelectionRequired === true,
            pathEnumerationTruncated: msg.data.pathEnumerationTruncated === true,
            selectedPathId: savedPathId || msg.data.selectedPathId || msg.data.defaultPathId || initPaths[0]?.id || '',
            settings: savedExport?.settings ? { ...prev.settings, ...savedExport.settings } : prev.settings,
            savedExport,
            ...deriveEntitlementState(msg.data.entitlement || null),
            anonymousId: typeof msg.data.anonymousId === 'string' ? msg.data.anonymousId : prev.anonymousId,
            projectId: typeof msg.data.projectId === 'string' ? msg.data.projectId : prev.projectId,
            entitlementError: msg.data.entitlementError === true,
            userEmail: msg.data.savedEmail || '',
            paymentCheckAvailable: msg.data.pendingCheckout?.email ? true : prev.paymentCheckAvailable,
            pendingCheckoutUrl: msg.data.pendingCheckout?.url || '',
            pendingCheckoutEmail: msg.data.pendingCheckout?.email || '',
            pendingCheckoutPlan: msg.data.pendingCheckout?.plan || '',
            pendingCheckoutSessionId: msg.data.pendingCheckout?.sessionId || '',
            checkoutState: msg.data.pendingCheckout?.email ? 'pending' : prev.checkoutState,
            trialExpired: msg.data.trialExpired || false,
            daysSinceFirstExport: msg.data.daysSinceFirstExport || null,
            flowAnalysis: msg.data.flow || null,
            error: msg.data.entitlementError ? ENTITLEMENT_VERIFICATION_ERROR : prev.error
          }));
          trackUiEvent(msg.data.hasPrototype ? 'flow_detected' : 'flow_detection_failed', {
            source: 'initial',
            frameCount: msg.data.frameCount || 0,
            reason: msg.data.hasPrototype ? 'connected_path' : 'no_connected_path',
          });
          if (msg.data.hasPrototype) {
            consecutiveFlowFailuresRef.current = 0;
          } else {
            handleFlowDetectionFailure('initial');
          }
          if (msg.data.hasPrototype && msg.data.pathSelectionRequired === true && msg.data.defaultPathId) {
            trackUiEvent('prototype_path_auto_selected', {
              source: 'recommended_default',
              pathCount: Array.isArray(msg.data.paths) ? msg.data.paths.length : 0,
            });
          }
          break;
          }

        case 'export-context':
          setState(prev => ({
            ...prev,
            activeExportAttemptId: typeof msg.data.exportId === 'string' ? msg.data.exportId : prev.activeExportAttemptId,
          }));
          break;

        case 'email-saved': {
          const restored = restoreInProgressRef.current;
          const switched = accountSwitchInProgressRef.current;
          const savedFromSuccess = emailIntent === 'save';
          restoreInProgressRef.current = false;
          accountSwitchInProgressRef.current = false;
          const paidAccessFound = msg.data.entitlement?.isPaid === true;
          setNeedEmail(restored && !paidAccessFound);
          setEmailIntent(restored && !paidAccessFound ? 'restore' : 'checkout');
          if (savedFromSuccess) {
            setShowPostSuccessEmailSave(false);
          }
          setState(prev => ({
            ...prev,
            stage: savedFromSuccess && prev.stage === 'complete' ? 'complete' : 'setup',
            userEmail: msg.data.email,
            ...deriveEntitlementState(msg.data.entitlement || null),
            trialExpired: msg.data.trialExpired || false,
            daysSinceFirstExport: msg.data.daysSinceFirstExport || null,
            restoreState: restored
              ? (paidAccessFound ? 'success' : 'error')
              : switched || savedFromSuccess ? 'success' : prev.restoreState,
            notice: restored
              ? getRestoreResultModel(paidAccessFound ? 'restored' : 'not-found').message
              : switched
                ? paidAccessFound ? 'Account switched. Studio is active.' : 'Account switched. Your free allowance is available.'
                : savedFromSuccess
                  ? 'Email saved. Upgrade checkout will be faster next time.'
                  : prev.notice
          }));
          if (restored) {
            trackUiEvent(msg.data.entitlement?.isPaid ? 'purchase_restored' : 'purchase_restore_failed', {
              result: msg.data.entitlement?.isPaid ? 'active_plan' : 'not_found',
            });
          }
          break;
        }

        case 'scan-complete': {
          const scannedFrameCount = msg.data.frames.length;
          setState(prev => ({
            ...prev,
            stage: 'setup',
            hasPrototype: scannedFrameCount > 0,
            frameCount: scannedFrameCount,
            unconnectedFrameCount: typeof msg.data.unconnectedFrameCount === 'number' ? msg.data.unconnectedFrameCount : 0,
            prototypePaths: Array.isArray(msg.data.paths) ? msg.data.paths : prev.prototypePaths,
            pathSelectionRequired: msg.data.pathSelectionRequired === true,
            pathEnumerationTruncated: msg.data.pathEnumerationTruncated === true,
            selectedPathId: msg.data.selectedPathId || msg.data.defaultPathId || msg.data.paths?.[0]?.id || prev.selectedPathId,
            flowAnalysis: msg.data.flow || prev.flowAnalysis,
            error: prev.entitlementError
              ? prev.error
              : scannedFrameCount > 0
                ? null
                : 'No prototype connections found yet.'
          }));
          trackUiEvent(scannedFrameCount > 0 ? 'flow_detected' : 'flow_detection_failed', {
            source: 'refresh',
            frameCount: scannedFrameCount,
            reason: scannedFrameCount > 0 ? 'connected_path' : 'no_connected_path',
          });
          if (scannedFrameCount > 0) {
            consecutiveFlowFailuresRef.current = 0;
          } else {
            handleFlowDetectionFailure('refresh');
          }
          if (scannedFrameCount > 0 && msg.data.pathSelectionRequired === true && msg.data.defaultPathId) {
            trackUiEvent('prototype_path_auto_selected', {
              source: 'recommended_default',
              pathCount: Array.isArray(msg.data.paths) ? msg.data.paths.length : 0,
            });
          }
          break;
        }

        case 'path-selection-required':
          setState(prev => ({
            ...prev,
            stage: 'setup',
            prototypePaths: Array.isArray(msg.data.paths) ? msg.data.paths : prev.prototypePaths,
            selectedPathId: msg.data.defaultPathId || prev.selectedPathId,
            pathSelectionRequired: true,
            pathEnumerationTruncated: msg.data.pathEnumerationTruncated === true,
            error: msg.data.message || 'Choose a connected path before exporting.',
          }));
          break;

        case 'progress':
          setState(prev => ({
            ...prev,
            stage: 'exporting',
            progress: {
              ...msg.data,
              percent: mapPluginProgressToOverall(
                msg.data?.stage || 'capturing',
                msg.data?.percent ?? 0,
                prev.progress.percent,
              ),
            }
          }));
          break;

        case 'encode-frames': {
          const { frames, settings: encSettings } = msg.data;
          const isPremium = msg.data.isPremium === true;
          const exportAttemptId = typeof msg.data.exportAttemptId === 'string' ? msg.data.exportAttemptId : null;
          if (exportAttemptId) {
            setState(prev => ({ ...prev, activeExportAttemptId: exportAttemptId }));
          }
          // Read live state via the ref — this handler's closure is stale.
          const exportEmail = stateRef.current.userEmail;
          const exportAnonymousId = typeof msg.data.anonymousId === 'string'
            ? msg.data.anonymousId
            : stateRef.current.anonymousId;
          const exportResolution = stateRef.current.settings.resolution;
          const exportFrameCount = msg.data.frameCount || stateRef.current.activeExportFrameCount || stateRef.current.frameCount;
          const exportStartedAt = stateRef.current.exportStartedAt || Date.now();
          const emitEncodeTelemetry = (event: EncodeTelemetryEvent) => {
            parent.postMessage({
              pluginMessage: {
                type: 'track-event',
                data: {
                  eventType: event.eventType,
                  metadata: {
                    ...event.metadata,
                    export_id: exportAttemptId,
                  },
                },
              },
            }, '*');
          };
          const normalizedFrames = frames.map((f: any) => ({
            imageData: toUint8Array(f.imageData),
            width: f.width,
            height: f.height,
            exportScale: typeof f.exportScale === 'number' ? f.exportScale : 1,
            layers: Array.isArray(f.layers) ? f.layers : [],
            transitionIn: normalizeTransitionIn(f.transitionIn),
          }));
          let usedSafeRetry = false;

          try {
            const result = await encodeVideo(
              normalizedFrames,
              encSettings,
              (percent: number) => {
                setState(prev => ({
                  ...prev,
                  progress: {
                    stage: 'encoding',
                    percent: mapEncoderProgressToOverall(percent, prev.progress.percent),
                  }
                }));
              },
              isPremium,  // Pass premium flag for watermark
              {
                email: exportEmail,
                resolution: exportResolution,
                anonymousId: exportAnonymousId || undefined,
                exportId: exportAttemptId || undefined,
                projectId: stateRef.current.projectId || undefined,
                plan: isPremium ? ('pro' as const) : ('free' as const),
                watermarkEnabled: !isPremium,
              },
              { onTelemetry: emitEncodeTelemetry }
            );

            await finishExportTransition();
            releaseExportRequest();
            setState(prev => ({
              ...prev,
              stage: 'complete',
              videoUrl: result.url,
              downloadFilename: result.filename,
              shareUrl: null,
              ownerShareUrl: null,
              shareState: 'idle',
              outputWidth: result.width,
              outputHeight: result.height,
              deliveryProfile: result.deliveryProfile,
              fileSizeBytes: result.fileSizeBytes,
              downloadStarted: false,
            }));

            parent.postMessage({
              pluginMessage: {
                type: 'encoding-complete',
                data: {
                  isPremium,
                  usedSafeRetry,
                  exportAttemptId,
                  outputWidth: result.width,
                  outputHeight: result.height,
                  deliveryProfile: result.deliveryProfile,
                  frameCount: exportFrameCount,
                  exportId: exportAttemptId,
                  payloadBytes: result.payloadBytes ?? null,
                  uploadDurationMs: result.uploadDurationMs ?? null,
                  transcodeDurationMs: result.transcodeDurationMs ?? null,
                  exportDurationMs: Date.now() - exportStartedAt,
                }
              }
            }, '*');
          } catch (firstError: any) {
            const firstMessage = firstError?.message || 'Video encoding failed';

            // Determine first error source for smarter safe retry
            const firstWasBackend = firstMessage.startsWith('BACKEND_TRANSCODE:');

            parent.postMessage({
              pluginMessage: {
                type: 'track-event',
                data: {
                  eventType: 'export_safe_retry_started',
                  metadata: {
                    firstErrorSource: firstWasBackend ? 'backend' : 'browser',
                    attempt_id: exportAttemptId,
                    originalResolution: exportResolution,
                    frameCount: exportFrameCount
                  }
                }
              }
            }, '*');

            try {
              usedSafeRetry = true;
              setState(prev => ({
                ...prev,
                progress: {
                  stage: 'retrying safer 720p export',
                  percent: Math.max(prev.progress.percent, 60),
                }
              }));

              const safeRetryContext = {
                email: exportEmail,
                resolution: 'safe_720p',
                anonymousId: exportAnonymousId || undefined,
                exportId: exportAttemptId || undefined,
                projectId: stateRef.current.projectId || undefined,
                plan: isPremium ? ('pro' as const) : ('free' as const),
                watermarkEnabled: !isPremium,
              };
              // Smart safe retry: if first was backend, try a simpler client-side encode;
              // if first was client-side, force the lean backend fallback.
              const safeRetryOptions = firstWasBackend
                ? {
                    forceBackend: false,
                    disableTransitions: true,
                    maxWidth: 1280,
                    maxHeight: 720,
                    holdSeconds: 1,
                    jpegQuality: 0.82,
                    onTelemetry: emitEncodeTelemetry,
                  }
                : {
                    forceBackend: true,
                  safeMode: true,
                  onTelemetry: emitEncodeTelemetry,
                  };

              const result = await encodeVideo(
                normalizedFrames,
                encSettings,
                (percent: number) => {
                  setState(prev => ({
                    ...prev,
                    progress: {
                      stage: 'retrying safer 720p export',
                      percent: mapEncoderProgressToOverall(percent, prev.progress.percent),
                    }
                  }));
                },
                isPremium,
                safeRetryContext,
                safeRetryOptions
              );

              parent.postMessage({
                pluginMessage: {
                  type: 'track-event',
                  data: {
                    eventType: 'export_safe_retry_succeeded',
                    metadata: {
                    originalResolution: exportResolution,
                    frameCount: exportFrameCount,
                    attempt_id: exportAttemptId,
                      retryStrategy: firstWasBackend ? 'client_after_backend' : 'backend_after_client'
                    }
                  }
                }
              }, '*');

              await finishExportTransition();
              releaseExportRequest();
              setState(prev => ({
                ...prev,
                stage: 'complete',
                videoUrl: result.url,
                downloadFilename: result.filename,
                  shareUrl: null,
                  ownerShareUrl: null,
                shareState: 'idle',
                outputWidth: result.width,
                outputHeight: result.height,
                deliveryProfile: result.deliveryProfile,
                fileSizeBytes: result.fileSizeBytes,
                downloadStarted: false,
              }));

              parent.postMessage({
                pluginMessage: {
                  type: 'encoding-complete',
                  data: {
                  isPremium,
                  usedSafeRetry,
                  exportAttemptId,
                  outputWidth: result.width,
                    outputHeight: result.height,
                    deliveryProfile: result.deliveryProfile,
                    frameCount: exportFrameCount,
                    exportId: exportAttemptId,
                    payloadBytes: result.payloadBytes ?? null,
                    uploadDurationMs: result.uploadDurationMs ?? null,
                    transcodeDurationMs: result.transcodeDurationMs ?? null,
                    exportDurationMs: Date.now() - exportStartedAt,
                  }
                }
              }, '*');
            } catch (safeError: any) {
              const safeMessage = safeError?.message || 'Video encoding failed';
              parent.postMessage({
                pluginMessage: {
                  type: 'track-event',
                  data: {
                    eventType: 'export_safe_retry_failed',
                    metadata: {
                      frameCount: exportFrameCount,
                      attempt_id: exportAttemptId,
                      retryStrategy: firstWasBackend ? 'client_after_backend' : 'backend_after_client',
                      firstErrorSource: firstWasBackend ? 'backend' : 'browser',
                    }
                  }
                }
              }, '*');
              // Extract backend error details for better diagnostics
              let backendErrorType: string | null = null;
              let inputSizeMB: number | null = null;
              let backendFrameCount: number | null = null;
              let backendResolution: string | null = null;

              if (safeMessage.startsWith('BACKEND_TRANSCODE:')) {
                // Parse the structured error message: msg:<error>|size:<mb>|frames:<n>|res:<res>
                const contextStr = safeMessage.slice('BACKEND_TRANSCODE: '.length);
                const parts = contextStr.split('|');

                for (const part of parts) {
                  // Check for FFmpeg error category in brackets [category]
                  const categoryMatch = part.match(/\[(\w+)\]/);
                  if (categoryMatch) {
                    const category = categoryMatch[1];
                    if (category === 'timeout' || category === 'timed_out') {
                      backendErrorType = 'timeout';
                    } else if (category === 'out_of_memory') {
                      backendErrorType = 'memory_limit';
                    } else if (category === 'invalid_input' || category === 'file_not_found') {
                      backendErrorType = category;
                    } else if (category === 'unsupported_format') {
                      backendErrorType = 'unsupported_format';
                    } else if (category === 'ffmpeg_missing') {
                      backendErrorType = 'ffmpeg_missing';
                    } else {
                      backendErrorType = category || 'unknown_backend_error';
                    }
                    continue;
                  }

                  if (part.startsWith('msg:')) {
                    const msg = part.slice(4);
                    if (msg.includes('timeout') || msg.includes('timed out')) {
                      backendErrorType = 'timeout';
                    } else if (msg.includes('No video data') || msg.includes('empty')) {
                      backendErrorType = 'no_data';
                    } else if (msg.includes('FFmpeg') || msg.includes('ffmpeg')) {
                      backendErrorType = 'ffmpeg_error';
                    } else if (msg.includes('ffmpeg binary not found')) {
                      backendErrorType = 'ffmpeg_missing';
                    } else if (msg.includes('file size') || msg.includes('too large') || msg.includes('limit')) {
                      backendErrorType = 'file_too_large';
                    } else if (msg.includes('memory') || msg.includes('heap')) {
                      backendErrorType = 'memory_limit';
                    } else {
                      backendErrorType = 'unknown_backend_error';
                    }
                  } else if (part.startsWith('code:')) {
                    const code = part.slice(5).trim();
                    if (code === 'memory_limit') backendErrorType = 'memory_limit';
                    else if (code === 'timeout') backendErrorType = 'timeout';
                    else if (code === 'invalid_input') backendErrorType = 'invalid_input';
                    else if (code === 'unsupported_format') backendErrorType = 'unsupported_format';
                    else if (code === 'ffmpeg_missing') backendErrorType = 'ffmpeg_missing';
                    else if (code === 'payload_too_large') backendErrorType = 'payload_too_large';
                    else if (code) backendErrorType = code;
                  } else if (part.startsWith('size:')) {
                    const sizeStr = part.slice(5).replace('mb', '').trim();
                    inputSizeMB = parseFloat(sizeStr) || null;
                  } else if (part.startsWith('frames:')) {
                    backendFrameCount = parseInt(part.slice(7), 10) || null;
                  } else if (part.startsWith('res:')) {
                    backendResolution = part.slice(4);
                  }
                }

                // Default if no type was extracted from message
                if (!backendErrorType) {
                  backendErrorType = 'unknown_backend_error';
                }
              }

              parent.postMessage({
                pluginMessage: {
                  type: 'encoding-failed',
                  data: {
                    firstErrorSource: firstWasBackend ? 'backend' : 'browser',
                    source: safeMessage.startsWith('BACKEND_TRANSCODE:')
                      ? 'backend-transcode'
                      : 'browser-encode',
                    frameCount: exportFrameCount,
                    exportAttemptId,
                    backendErrorType: backendErrorType,
                    inputSizeMB: inputSizeMB,
                    backendFrameCount: backendFrameCount,
                    backendResolution: backendResolution,
                    safeRetryUsed: true
                  }
                }
              }, '*');
              const payloadTooLarge = safeMessage.includes('[payload_too_large]');
              releaseExportRequest();
              setState(prev => ({
                ...prev,
                stage: 'setup',
                error: payloadTooLarge
                  ? 'This prototype is too large to send as one export. ProtoVid tried smaller compatibility profiles; shorten the flow or remove oversized assets, then try again.'
                  : 'Export failed after a safer 720p retry. Please try again, or reduce the prototype to fewer connected frames.'
              }));
            }
          }
          break;
        }

        case 'export-count-updated':
          setState(prev => ({
            ...prev,
            ...deriveEntitlementState(msg.data.entitlement || prev.entitlement)
          }));
          break;

        case 'license-validated':
          checkoutRequestLockedRef.current = false;
          setState(prev => ({
            ...prev,
            ...deriveEntitlementState(msg.data.entitlement || prev.entitlement),
            isPremium: msg.data.entitlement?.isPaid ?? msg.data.isValid,
            paymentCheckAvailable: msg.data.entitlement?.isPaid || msg.data.isValid ? false : prev.paymentCheckAvailable,
            pendingCheckoutUrl: msg.data.entitlement?.isPaid || msg.data.isValid ? '' : prev.pendingCheckoutUrl,
            pendingCheckoutEmail: msg.data.entitlement?.isPaid || msg.data.isValid ? '' : prev.pendingCheckoutEmail,
            pendingCheckoutPlan: msg.data.entitlement?.isPaid || msg.data.isValid ? '' : prev.pendingCheckoutPlan,
            pendingCheckoutSessionId: msg.data.entitlement?.isPaid || msg.data.isValid ? '' : prev.pendingCheckoutSessionId,
            checkoutState: msg.data.entitlement?.isPaid || msg.data.isValid ? 'success' : prev.checkoutState
          }));
          break;

        case 'checkout-opened':
          checkoutRequestLockedRef.current = false;
          setState(prev => ({
            ...prev,
            pendingCheckoutUrl: msg.data.url || prev.pendingCheckoutUrl,
            pendingCheckoutEmail: msg.data.email || prev.pendingCheckoutEmail,
            pendingCheckoutPlan: msg.data.plan || prev.pendingCheckoutPlan,
            pendingCheckoutSessionId: msg.data.sessionId || prev.pendingCheckoutSessionId,
            paymentCheckAvailable: true,
            checkoutState: 'pending'
          }));
          // Start auto-polling for payment completion
          startPaymentPolling(msg.data.email, msg.data.plan || '');
          break;

        case 'free-limit-reached':
          releaseExportRequest();
          setState(prev => ({
            ...prev,
            stage: 'setup',
            ...deriveEntitlementState(msg.data.entitlement || prev.entitlement),
            isPremium: false,
            trialExpired: msg.data.trialExpired || false,
            daysSinceFirstExport: msg.data.daysSinceFirstExport || null,
            paymentCheckAvailable: false,
            error: null
          }));
          break;

        case 'entitlement-error':
          releaseExportRequest();
          setState(prev => ({
            ...prev,
            stage: prev.stage === 'complete' ? 'complete' : 'setup',
            entitlement: null,
            entitlementError: true,
            isPremium: false,
            error: msg.data.message || ENTITLEMENT_VERIFICATION_ERROR
          }));
          break;

        case 'error':
          releaseExportRequest();
          setState(prev => ({
            ...prev,
            stage: prev.stage === 'complete' ? 'complete' : 'setup',
            error: msg.data.message,
            checkoutState: prev.checkoutState === 'opening' ? 'error' : prev.checkoutState,
            restoreState: prev.restoreState === 'checking' ? 'error' : prev.restoreState,
          }));
          checkoutRequestLockedRef.current = false;
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
    if (!state.entitlement || state.entitlementError) return;
    if (state.isPremium) {
      limitPaywallViewedRef.current = false;
      return;
    }
    const pricingReady = state.userEmail
      ? state.pricingLoadedEmail === state.userEmail.toLowerCase().trim()
      : true;
    if (!pricingReady) return;

    const freeLimitHit = state.entitlement.upgradeRequired;

    if (state.stage === 'setup' && freeLimitHit && !limitPaywallViewedRef.current) {
      limitPaywallViewedRef.current = true;
      parent.postMessage({
        pluginMessage: {
          type: 'track-event',
          data: {
            eventType: 'paywall_viewed',
            metadata: {
              reason: 'free_limit_hit',
              trigger: 'free_limit_ui_shown',
              exportCount: state.entitlement.freeExportsUsed,
              freeLimit: state.entitlement.freeExportsLimit,
              free_tier_experiment_id: state.entitlement.freeTierExperimentId || null,
              pricingVariant: state.pricingVariant,
              priceLabel: state.monthlyPriceLabel,
              amountCents: state.monthlyAmountCents,
              offer_experiment_id: state.offerExperimentId,
              offer_experiment_variant: state.offerExperimentVariant,
              primary_offer: state.primaryOffer
            }
          }
        }
      }, '*');
    }
  }, [state.entitlement, state.entitlementError, state.isPremium, state.stage, state.hasPrototype, state.userEmail, state.pricingLoadedEmail, state.pricingVariant, state.monthlyPriceLabel, state.monthlyAmountCents, state.offerExperimentId, state.offerExperimentVariant, state.primaryOffer]);

  useEffect(() => {
    const email = state.userEmail.toLowerCase().trim();
    const pricingKey = `${email && email.includes('@') ? email : 'anonymous'}:${state.anonymousId || 'none'}`;
    if (pricingEmailRef.current === pricingKey) return;

    pricingEmailRef.current = pricingKey;
    fetch(`${BACKEND_URL}/api/billing/pricing-variant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(email && email.includes('@') ? { email } : {}),
        plan: 'monthly',
        ...(state.anonymousId ? { anonymousId: state.anonymousId } : {}),
      })
    })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        setState(prev => {
          if (!data?.pricingVariant || !data?.priceLabel) {
            return { ...prev, pricingLoadedEmail: email };
          }
          const pass = data.largeFlowPass;
          const offerExperiment = data.offerExperiment;
          return {
            ...prev,
            pricingVariant: data.pricingVariant,
            monthlyPriceLabel: data.priceLabel,
            monthlyAmountCents: data.amountCents || prev.monthlyAmountCents,
            largeFlowPassAvailable: pass?.available === true,
            largeFlowPassLabel: pass?.priceLabel || prev.largeFlowPassLabel,
            largeFlowPassAmountCents: pass?.amountCents || prev.largeFlowPassAmountCents,
            largeFlowPassAccessDays: pass?.accessDays || prev.largeFlowPassAccessDays,
            offerExperimentId: offerExperiment?.id || prev.offerExperimentId,
            offerExperimentVariant: offerExperiment?.variant === 'project_pass_first'
              ? 'project_pass_first'
              : 'pro_first',
            primaryOffer: offerExperiment?.primaryOffer === 'large_export'
              ? 'large_export'
              : 'monthly',
            pricingLoadedEmail: email
          };
        });
      })
      .catch(() => {
        setState(prev => ({ ...prev, pricingLoadedEmail: email }));
      });
  }, [state.userEmail, state.anonymousId]);

  useEffect(() => {
    if (state.stage !== 'complete' || !state.videoUrl || autoDownloadUrlRef.current === state.videoUrl) return;

    autoDownloadUrlRef.current = state.videoUrl;
    window.setTimeout(() => {
      const link = document.createElement('a');
      link.href = state.videoUrl!;
      link.download = state.downloadFilename || `protovid-export.${state.settings.format}`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
            setState(prev => ({ ...prev, downloadStarted: true }));
            trackUiEvent('download_started', {
              source: 'auto',
              resolution: state.settings.resolution,
              frameCount: state.activeExportFrameCount || state.frameCount,
            });
            trackUiEvent('download_clicked', {
        source: 'auto',
        resolution: state.settings.resolution,
        isPremium: state.isPremium,
        frameCount: state.activeExportFrameCount || state.frameCount,
        attempt_id: state.activeExportAttemptId,
      });
    }, 250);
  }, [state.stage, state.videoUrl, state.downloadFilename, state.settings.resolution, state.isPremium, state.frameCount, state.activeExportFrameCount, state.activeExportAttemptId]);

  useEffect(() => {
    if (state.stage !== 'complete' || state.isPremium || !state.videoUrl || postExportUpsellTrackedRef.current === state.videoUrl) return;
    postExportUpsellTrackedRef.current = state.videoUrl;
    trackUiEvent('upsell_viewed', {
      upsell_context: 'post_export',
      frameCount: state.activeExportFrameCount || state.frameCount,
      attempt_id: state.activeExportAttemptId,
      remainingExports: state.entitlement?.freeExportsRemaining ?? null,
      pricingVariant: state.pricingVariant,
      priceLabel: state.monthlyPriceLabel,
      amountCents: state.monthlyAmountCents,
      offer_experiment_id: state.offerExperimentId,
      offer_experiment_variant: state.offerExperimentVariant,
      primary_offer: state.primaryOffer,
    });
    trackUiEvent('upsell_card_viewed', {
      upsell_context: 'post_export',
      reason: 'post_export',
      trigger: 'post_export_upgrade_card',
      frameCount: state.activeExportFrameCount || state.frameCount,
      attempt_id: state.activeExportAttemptId,
      remainingExports: state.entitlement?.freeExportsRemaining ?? null,
      pricingVariant: state.pricingVariant,
      priceLabel: state.monthlyPriceLabel,
      amountCents: state.monthlyAmountCents,
      offer_experiment_id: state.offerExperimentId,
      offer_experiment_variant: state.offerExperimentVariant,
      primary_offer: state.primaryOffer,
    });
    trackUiEvent('upgrade_viewed', {
      source: 'post_export',
      frameCount: state.activeExportFrameCount || state.frameCount,
      remainingExports: state.entitlement?.freeExportsRemaining ?? null,
      offer_experiment_id: state.offerExperimentId,
      offer_experiment_variant: state.offerExperimentVariant,
      primary_offer: state.primaryOffer,
    });
  }, [state.stage, state.isPremium, state.videoUrl, state.activeExportFrameCount, state.activeExportAttemptId, state.frameCount, state.entitlement, state.pricingVariant, state.monthlyPriceLabel, state.monthlyAmountCents, state.offerExperimentId, state.offerExperimentVariant, state.primaryOffer]);

  useEffect(() => {
    // Most free users export only once, so gating the email prompt at 2+
    // exports meant it almost never appeared. Ask after any successful export
    // (the user has already gotten value); a dismiss ref still prevents
    // repeated nagging within the same session.
    const hasMeaningfulEmailMoment = (state.entitlement?.freeExportsUsed ?? 0) >= 1;
    if (state.stage !== 'complete' || state.isPremium || state.userEmail.trim().includes('@') || !hasMeaningfulEmailMoment) {
      if (state.stage !== 'complete') {
        setShowPostSuccessEmailSave(false);
        postSuccessEmailDismissedRef.current = false;
      }
      return;
    }
    if (postSuccessEmailDismissedRef.current) return;
    setShowPostSuccessEmailSave(true);
    if (!postSuccessEmailPromptTrackedRef.current) {
      postSuccessEmailPromptTrackedRef.current = true;
      trackUiEvent('post_success_email_prompt_shown', {
        frameCount: state.activeExportFrameCount || state.frameCount,
        attempt_id: state.activeExportAttemptId,
        exportsUsed: state.entitlement?.freeExportsUsed ?? null,
      });
    }
  }, [state.stage, state.isPremium, state.userEmail, state.entitlement, state.activeExportFrameCount, state.frameCount, state.activeExportAttemptId]);

  // Auto-poll for payment completion after checkout
  const startPaymentPolling = (email: string, plan: CheckoutPlan | '' = '') => {
    stopPaymentPolling();
    const pollGeneration = pollGenerationRef.current;
    const confirmedPlan: CheckoutPlan = plan === 'large_export' ? 'large_export' : 'monthly';

    setState(prev => ({ ...prev, stage: 'checking-payment', checkoutState: 'pending' }));
    parent.postMessage({
      pluginMessage: {
        type: 'track-event',
        data: {
          eventType: 'payment_poll_started',
          metadata: { source: 'plugin_poll', plan: confirmedPlan }
        }
      }
    }, '*');

    let attempts = 0;
    const maxAttempts = 20; // 20 * 3s = 60s
    let requestInFlight = false;
    let timerId: number | null = null;

    const finishCurrentPoll = () => {
      if (pollGenerationRef.current !== pollGeneration) return false;
      pollGenerationRef.current += 1;
      if (timerId !== null) clearInterval(timerId);
      if (pollTimerRef.current === timerId) pollTimerRef.current = null;
      return true;
    };

    timerId = window.setInterval(async () => {
      if (pollGenerationRef.current !== pollGeneration || requestInFlight) return;

      requestInFlight = true;
      attempts++;

      try {
        const response = await fetch(`${BACKEND_URL}/api/validate-license`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ licenseKey: email })
        });

        if (response.ok) {
          const data = await response.json();
          if (pollGenerationRef.current !== pollGeneration) return;
          if (data.valid && data.tier === 'pro') {
            // Payment confirmed!
            if (!finishCurrentPoll()) return;
            trackUiEvent('payment_completed', { source: 'plugin_poll', plan: confirmedPlan });
            trackUiEvent('payment_confirmed', { source: 'plugin_poll', plan: confirmedPlan });
            setState(prev => ({
              ...prev,
              stage: 'setup',
              isPremium: true,
              error: null,
              paymentCheckAvailable: false,
              pendingCheckoutUrl: '',
              pendingCheckoutEmail: '',
              pendingCheckoutPlan: '',
              pendingCheckoutSessionId: '',
              checkoutState: 'success',
              notice: getPaidAccessActivatedNotice(confirmedPlan),
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
      } finally {
        requestInFlight = false;
      }

      if (attempts >= maxAttempts) {
        if (!finishCurrentPoll()) return;
        setState(prev => ({
          ...prev,
          stage: 'setup',
          error: null,
          paymentCheckAvailable: true
        }));
        parent.postMessage({
          pluginMessage: {
            type: 'track-event',
            data: {
              eventType: 'payment_poll_timeout',
              metadata: { attempts }
            }
          }
        }, '*');
      }
    }, 3000);
    pollTimerRef.current = timerId;
  };

  const stopPaymentPolling = () => {
    pollGenerationRef.current += 1;
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const handleCancelPaymentCheck = () => {
    stopPaymentPolling();
    setState(prev => ({
      ...prev,
      stage: checkoutReturnStageRef.current === 'complete' ? 'complete' : 'setup',
      error: null,
      paymentCheckAvailable: !!prev.userEmail,
      checkoutState: 'cancelled',
      notice: 'Checkout was not confirmed. Your flow and settings are unchanged.'
    }));
  };

  const handleRetryEntitlement = () => {
    setState(prev => ({
      ...prev,
      stage: 'loading',
      error: null,
      notice: null,
      entitlementError: false
    }));
    parent.postMessage({ pluginMessage: { type: 'init' } }, '*');
  };

  const handleRestorePurchase = () => {
    const email = state.userEmail.trim();
    if (!email || !email.includes('@')) {
      setState(prev => ({ ...prev, error: 'Please enter a valid email address' }));
      return;
    }
    restoreInProgressRef.current = true;
    trackUiEvent('purchase_restore_started');
    setState(prev => ({ ...prev, error: null, notice: null, restoreState: 'checking' }));
    parent.postMessage({
      pluginMessage: { type: 'save-email', data: { email } }
    }, '*');
  };

  const handleStartRestorePurchase = () => {
    restoreInProgressRef.current = false;
    setEmailIntent('restore');
    setNeedEmail(true);
    setState(prev => ({ ...prev, error: null, notice: null }));
    focusEmailCapture();
  };

  const handleStartUseAnotherEmail = () => {
    accountSwitchInProgressRef.current = true;
    setEmailIntent('switch');
    setNeedEmail(true);
    setState(prev => ({ ...prev, error: null, notice: null, restoreState: 'idle' }));
    focusEmailCapture();
  };

  const handleSwitchAccount = () => {
    const email = state.userEmail.trim();
    if (!email || !email.includes('@')) {
      setState(prev => ({ ...prev, error: 'Please enter a valid email address' }));
      return;
    }
    accountSwitchInProgressRef.current = true;
    setState(prev => ({ ...prev, error: null, notice: null }));
    parent.postMessage({
      pluginMessage: { type: 'save-email', data: { email, source: 'account_switch' } }
    }, '*');
  };

  const handleSaveAccountEmail = () => {
    const email = state.userEmail.trim();
    if (!email || !email.includes('@')) {
      setState(prev => ({ ...prev, error: 'Please enter a valid email address' }));
      return;
    }
    setEmailIntent('save');
    setState(prev => ({ ...prev, error: null }));
    trackUiEvent('post_success_email_save_clicked', {
      frameCount: state.activeExportFrameCount || selectedPathFrameCount,
      attempt_id: state.activeExportAttemptId,
    });
    parent.postMessage({
      pluginMessage: { type: 'save-email', data: { email, source: 'post_export_success' } }
    }, '*');
  };

  const handleDismissPostSuccessEmail = () => {
    postSuccessEmailDismissedRef.current = true;
    setShowPostSuccessEmailSave(false);
    trackUiEvent('post_success_email_dismissed', {
      frameCount: state.activeExportFrameCount || selectedPathFrameCount,
      attempt_id: state.activeExportAttemptId,
    });
  };

  const handleExport = () => {
    if (state.stage === 'exporting') return;
    if (!state.entitlement) {
      setState(prev => ({
        ...prev,
        entitlementError: true,
        error: ENTITLEMENT_VERIFICATION_ERROR
      }));
      return;
    }
    if (state.pathSelectionRequired && !selectedPath) {
      setState(prev => ({ ...prev, error: 'Choose a connected prototype path before exporting.', notice: null }));
      return;
    }
    const requestDecision = requestExport(exportRequestGateRef.current, `ui-${Date.now()}`);
    if (!requestDecision.accepted) return;
    exportRequestGateRef.current = requestDecision.gate;
    trackUiEvent('export_clicked', {
      resolution: state.settings.resolution,
      format: state.settings.format,
      isPremium: state.isPremium,
      remainingExports: state.entitlement.freeExportsRemaining,
      freeLimit: state.entitlement.freeExportsLimit,
      free_tier_experiment_id: state.entitlement.freeTierExperimentId || null,
      frameCount: selectedPathFrameCount,
    });
    setState(prev => ({
      ...prev,
      error: null,
      notice: null,
      stage: 'exporting',
      activeExportFrameCount: selectedPathFrameCount,
      activeExportAttemptId: null,
      outputWidth: null,
      outputHeight: null,
      deliveryProfile: null,
      fileSizeBytes: null,
      exportStartedAt: Date.now(),
      downloadStarted: false,
      progress: { stage: 'preparing', percent: 0 },
    }));
    parent.postMessage({
      pluginMessage: {
        type: 'export-video',
        data: {
          ...state.settings,
          frameCount: selectedPathFrameCount,
          licenseKey: state.userEmail,
          selectedPathId: selectedPath?.id,
          selectedPathFrameIds: selectedPath?.frameIds,
        }
      }
    }, '*');
  };

  const handleScanPrototype = () => {
    trackUiEvent('flow_detection_started', { source: 'refresh' });
    setState(prev => ({
      ...prev,
      stage: 'scanning',
      error: prev.entitlementError ? prev.error : null,
      notice: null
    }));
    parent.postMessage({ pluginMessage: { type: 'scan-prototype' } }, '*');
  };

  const handleOpenCheckout = (
    source: UpgradeSource = freeUsed ? 'free_limit_paywall' : 'upsell_card',
    plan: CheckoutPlan = 'monthly',
    fromEmailPrompt = false
  ) => {
    if (checkoutRequestLockedRef.current) return;
    const email = state.userEmail.trim().toLowerCase();
    upgradeSourceRef.current = source;
    upgradePlanRef.current = plan;
    const isLargeFlowPass = plan === 'large_export';
    trackUiEvent(fromEmailPrompt ? 'checkout_email_submitted' : 'upgrade_clicked', {
      source,
      plan,
      upsell_context: source === 'large_flow_pass' ? 'project_delivery' : source === 'free_limit_paywall' ? 'free_limit' : 'post_export',
      pricingVariant: state.pricingVariant,
      priceLabel: isLargeFlowPass ? state.largeFlowPassLabel : state.monthlyPriceLabel,
      amountCents: isLargeFlowPass ? state.largeFlowPassAmountCents : state.monthlyAmountCents,
      offer_experiment_id: state.offerExperimentId,
      offer_experiment_variant: state.offerExperimentVariant,
      primary_offer: state.primaryOffer,
      freeLimit: state.entitlement?.freeExportsLimit ?? null,
      free_tier_experiment_id: state.entitlement?.freeTierExperimentId || null,
      frameCount: selectedPathFrameCount
    });
    if (!isValidAccountEmail(email)) {
      if (fromEmailPrompt) {
        trackUiEvent('checkout_email_validation_failed', { source, plan, reason: 'invalid_email' });
      }
      // Reveal the inline email field instead of blocking — we only need an
      // email to attach the subscription, collected right at checkout.
      setNeedEmail(true);
      setEmailIntent('checkout');
      checkoutReturnStageRef.current = state.stage;
      focusEmailCapture();
      setState(prev => ({ ...prev, error: null }));
      parent.postMessage({
        pluginMessage: {
          type: 'track-event',
          data: {
            eventType: 'checkout_email_prompt_shown',
            metadata: {
              trigger: freeUsed ? 'free_limit' : 'upgrade_cta',
              source,
              plan,
              pricingVariant: state.pricingVariant,
              priceLabel: isLargeFlowPass ? state.largeFlowPassLabel : state.monthlyPriceLabel,
              amountCents: isLargeFlowPass ? state.largeFlowPassAmountCents : state.monthlyAmountCents,
              offer_experiment_id: state.offerExperimentId,
              offer_experiment_variant: state.offerExperimentVariant,
              primary_offer: state.primaryOffer,
              freeLimit: state.entitlement?.freeExportsLimit ?? null,
              free_tier_experiment_id: state.entitlement?.freeTierExperimentId || null,
              frameCount: selectedPathFrameCount
            }
          }
        }
      }, '*');
      return;
    }
    setNeedEmail(false);
    checkoutRequestLockedRef.current = true;
    checkoutReturnStageRef.current = state.stage;
    setState(prev => ({ ...prev, error: null, checkoutState: 'opening', notice: null }));
    parent.postMessage({
      pluginMessage: {
        type: 'open-checkout',
        data: {
          email,
          plan,
          pricingVariant: state.pricingVariant,
          priceLabel: isLargeFlowPass ? state.largeFlowPassLabel : state.monthlyPriceLabel,
          amountCents: isLargeFlowPass ? state.largeFlowPassAmountCents : state.monthlyAmountCents,
          source,
          offerExperimentId: state.offerExperimentId,
          offerExperimentVariant: state.offerExperimentVariant,
          primaryOffer: state.primaryOffer,
          frameCount: selectedPathFrameCount
        }
      }
    }, '*');
  };

  const handleResumeCheckout = () => {
    if (!state.pendingCheckoutUrl) {
      handleOpenCheckout(
        state.pendingCheckoutPlan === 'large_export' ? 'large_flow_pass' : 'upsell_card',
        state.pendingCheckoutPlan === 'large_export' ? 'large_export' : 'monthly'
      );
      return;
    }
    trackUiEvent('checkout_recovered', {
      plan: state.pendingCheckoutPlan || 'monthly',
      frameCount: selectedPathFrameCount
    });
    parent.postMessage({
      pluginMessage: {
        type: 'resume-checkout',
        data: {
          url: state.pendingCheckoutUrl,
          email: state.pendingCheckoutEmail || state.userEmail,
          plan: state.pendingCheckoutPlan || 'monthly',
          sessionId: state.pendingCheckoutSessionId || undefined
        }
      }
    }, '*');
    if (state.pendingCheckoutEmail || state.userEmail) {
      startPaymentPolling(
        state.pendingCheckoutEmail || state.userEmail,
        state.pendingCheckoutPlan || '',
      );
    }
  };

  const handleManualPaymentCheck = () => {
    const email = state.userEmail;
    if (!email || !email.includes('@')) return;
    parent.postMessage({
      pluginMessage: {
        type: 'track-event',
        data: {
          eventType: 'payment_status_checked',
          metadata: { source: 'manual', plan: state.pendingCheckoutPlan || 'monthly' }
        }
      }
    }, '*');
    setState(prev => ({ ...prev, stage: 'checking-payment', paymentCheckAvailable: false }));
    startPaymentPolling(email, state.pendingCheckoutPlan || '');
  };

  const handleClosePlugin = () => {
    parent.postMessage({ pluginMessage: { type: 'cancel' } }, '*');
  };

  const handleOpenSetupGuide = () => {
    parent.postMessage({ pluginMessage: { type: 'open-setup-guide' } }, '*');
  };

  const handleFlowDetectionFailure = (source: 'initial' | 'refresh') => {
    consecutiveFlowFailuresRef.current += 1;
    if (consecutiveFlowFailuresRef.current >= 2 && !stuckGuideAutoOpenedRef.current) {
      stuckGuideAutoOpenedRef.current = true;
      trackUiEvent('flow_detection_stuck', {
        source,
        failureCount: consecutiveFlowFailuresRef.current,
      });
      handleOpenSetupGuide();
    }
  };

  const handleOpenSubscriptionManagement = () => {
    if (state.entitlement?.billingAccessKind === 'one_time_access') return;
    parent.postMessage({ pluginMessage: { type: 'open-billing-portal' } }, '*');
  };

  const handleOpenCommunityListing = () => {
    parent.postMessage({ pluginMessage: { type: 'open-community-listing' } }, '*');
  };

  const trackUiEvent = (eventType: string, metadata?: Record<string, string | number | boolean | null>) => {
    const activeExportId = stateRef.current.activeExportAttemptId;
    const current = stateRef.current;
    void sendAnalyticsEvent({
      email: current.userEmail.trim().includes('@') ? current.userEmail.trim().toLowerCase() : null,
      eventType,
      pluginVersion: PLUGIN_VERSION,
      metadata: {
        ...(current.anonymousId ? { anonymousId: current.anonymousId } : {}),
        ...(current.projectId ? { project_id: current.projectId } : {}),
        ...(activeExportId ? { export_id: activeExportId } : {}),
        ...(metadata || {}),
      },
    });
  };

  const handleResolutionChange = (value: string) => {
    trackUiEvent('resolution_selected', {
      resolution: value,
      isPremium: state.isPremium,
      source: 'resolution_selector',
    });
    trackUiEvent('export_settings_changed', {
      setting: 'resolution',
      value,
      isPremium: state.isPremium
    });
    const resolution = value as Resolution;
    const selection = getResolutionSelection(resolution, state.isPremium ? 'pro' : 'free');
    if (selection.requiresUpgrade) {
      trackUiEvent('selected_paid_feature', {
        feature: resolution,
        source: 'resolution_selector',
        upsell_context: 'direct_paid_option',
      });
      trackUiEvent('upsell_viewed', {
        upsell_context: 'direct_paid_option',
        selected_paid_feature: resolution,
      });
    }
    setState(prev => ({
      ...prev,
      settings: { ...prev.settings, resolution },
      error: null,
      notice: selection.message,
    }));
  };

  const handleFormatChange = (format: ExportFormat) => {
    trackUiEvent('format_interest', {
      format,
      source: 'format_selector',
      isPremium: state.isPremium,
    });
    trackUiEvent('export_settings_changed', {
      setting: 'format',
      value: format,
      isPremium: state.isPremium,
    });
    setState(prev => ({
      ...prev,
      settings: { ...prev.settings, format },
      error: null,
      notice: null,
    }));
  };

  const handlePathChange = (pathId: string) => {
    const path = state.prototypePaths.find(candidate => candidate.id === pathId);
    if (!path) return;
    setState(prev => ({ ...prev, selectedPathId: pathId, pathSelectionRequired: false, error: null, notice: null }));
    trackUiEvent('prototype_path_selected', {
      frameCount: path.frameCount,
      pathCount: state.prototypePaths.length,
      source: 'ui_selection',
    });
  };

  const handleDownloadClick = () => {
    setState(prev => ({ ...prev, downloadStarted: true }));
    trackUiEvent('download_started', {
      source: 'manual',
      resolution: state.settings.resolution,
      frameCount: state.activeExportFrameCount || selectedPathFrameCount,
    });
    trackUiEvent('download_clicked', {
      source: 'manual',
      resolution: state.settings.resolution,
      isPremium: state.isPremium,
      frameCount: state.activeExportFrameCount || selectedPathFrameCount,
      attempt_id: state.activeExportAttemptId,
      export_id: state.activeExportAttemptId,
    });
  };

  const remainingExports = state.entitlement?.freeExportsRemaining ?? 0;
  const freeUsed = state.entitlement?.upgradeRequired ?? false;
  const collectEmail = needEmail;
  const validEmail = isValidAccountEmail(state.userEmail);
  const selectedPath = state.prototypePaths.find(path => path.id === state.selectedPathId) || null;
  const selectedPathFrameCount = selectedPath?.frameCount || state.frameCount;
  const hasMultiplePaths = state.prototypePaths.length > 1;
  const needsPathSelection = state.pathSelectionRequired && !selectedPath;
  const hasAutoSelectedPath = state.pathSelectionRequired && Boolean(selectedPath);
  const needsLargePathWarning = selectedPathFrameCount >= 25
    || selectedPath?.preflight?.status === 'long_path'
    || selectedPath?.preflight?.status === 'split_recommended';
  const completedExportFrameCount = state.activeExportFrameCount || selectedPathFrameCount;
  const showLargeFlowPassOffer = !state.isPremium && state.largeFlowPassAvailable;
  const experimentPrimaryPlan: CheckoutPlan = getExperimentPrimaryPlan(
    state.primaryOffer,
    showLargeFlowPassOffer,
  );
  // Most free users only export once, so the prior `>= 2` gate meant almost no
  // one saw the review prompt. Ask after the first successful export — the
  // review prompt is only rendered on the success screen anyway.
  const shouldShowReview = !state.isPremium && (state.entitlement?.freeExportsUsed ?? 0) >= 1;
  const isOneTimeAccess = state.entitlement?.billingAccessKind === 'one_time_access';
  const accessEndLabel = formatAccessEnd(state.entitlement?.currentPeriodEnd);

  const plan = state.isPremium ? 'pro' : 'free';
  const estimatedDurationSeconds = selectedPath?.estimatedDuration || selectedPathFrameCount * 2;
  const estimatedDuration = `${estimatedDurationSeconds} sec`;
  const allowanceCopy = state.entitlement
    ? getRemainingExportsCopy(remainingExports, plan)
    : state.entitlementError
      ? 'Allowance unavailable'
      : 'Checking allowance…';
  const summaryCopy = getExportSummaryCopy({
    plan,
    resolution: state.settings.resolution,
    format: state.settings.format,
    estimatedDuration,
  });
  const basePrimaryAction = getPrimaryActionModel({
    plan,
    resolution: state.settings.resolution,
    remainingExports: state.entitlement ? remainingExports : null,
    flowReady: state.hasPrototype,
    isExporting: state.stage === 'exporting',
    isCheckoutPending: state.checkoutState === 'opening',
  });
  const progressModel = getExportProgressModel(state.progress.percent);
  const baseErrorModel = state.error ? getRecoverableErrorModel(state.error) : null;
  const errorModel = baseErrorModel
    ? state.checkoutState === 'error'
      ? {
          ...baseErrorModel,
          title: 'Checkout could not be opened',
          message: 'No charge was made. Check your connection and try again.',
          reassurance: 'Your selected flow and settings are still available.',
          primaryAction: 'Try again' as const,
          secondaryAction: null,
        }
      : state.restoreState === 'error' && restoreInProgressRef.current
        ? {
            ...baseErrorModel,
            title: 'Purchase could not be restored',
            message: getRestoreResultModel('failed').message,
            reassurance: 'Your selected flow and settings are still available.',
            primaryAction: 'Try again' as const,
            secondaryAction: null,
          }
        : baseErrorModel
    : null;
  const hasBlockingFlowError = errorModel?.code === 'invalid-flow' || errorModel?.code === 'unsupported-content';
  const primaryActionBase = hasBlockingFlowError
    ? {
        label: 'Review flow',
        supportingText: 'Refresh after checking the affected connections or frame.',
        intent: 'refresh' as const,
        disabled: false,
      }
    : needsPathSelection
      ? {
          label: 'Choose a connected path',
          supportingText: 'Select one connected route before exporting.',
          intent: 'choose-path' as const,
          disabled: false,
        }
      : basePrimaryAction;
  const conversionPrimaryPlan: CheckoutPlan = primaryActionBase.intent === 'upgrade' && freeUsed && showLargeFlowPassOffer
    ? 'large_export'
    : experimentPrimaryPlan;
  const primaryAction = primaryActionBase.intent === 'upgrade' && conversionPrimaryPlan === 'large_export'
    ? {
        ...primaryActionBase,
        label: 'Buy Project Pass',
        supportingText: `${state.largeFlowPassLabel} for seven days of clean HD/4K exports.`,
      }
    : primaryActionBase.intent === 'upgrade'
      ? {
          ...primaryActionBase,
          label: 'Start Studio',
          supportingText: `${PRO_PRICE_MONTHLY_DISPLAY} for recurring client-ready review workflows.`,
        }
      : primaryActionBase;
  const selectedStartName = selectedPath?.startNodeName || null;
  const selectedEndName = selectedPath?.endNodeName || null;
  const resolutionLabel = state.outputWidth && state.outputHeight
    ? `${state.outputWidth} × ${state.outputHeight}`
    : state.settings.resolution;
  const fileSizeLabel = state.fileSizeBytes
    ? state.fileSizeBytes >= 1024 * 1024
      ? `${(state.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.max(1, Math.round(state.fileSizeBytes / 1024))} KB`
    : null;
  const elapsedLabel = elapsedSeconds < 60
    ? `${elapsedSeconds}s`
    : `${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s`;
  const selectedFormatLabel = getFormatLabel(state.settings.format);
  const progressDetail = state.progress.stage.toLowerCase().includes('retrying')
    ? 'Using a safer compatibility profile. Your original settings are preserved.'
    : progressModel.currentStage.id === 'preparing'
      ? 'Collecting the selected connected frames.'
      : progressModel.currentStage.id === 'rendering'
        ? 'Applying supported transitions between frames.'
        : progressModel.currentStage.id === 'encoding'
          ? `Packaging the walkthrough as ${selectedFormatLabel}.`
          : 'Preparing your file for download.';

  const openPathChooser = () => {
    const chooser = document.getElementById('path-chooser') as HTMLDetailsElement | null;
    if (!chooser) return;
    trackUiEvent('path_selection_prompted', {
      pathCount: state.prototypePaths.length,
      frameCount: state.frameCount,
    });
    chooser.open = true;
    chooser.scrollIntoView({ block: 'nearest' });
  };

  const handlePrimaryAction = () => {
    if (primaryAction.intent === 'export') handleExport();
    if (primaryAction.intent === 'upgrade') {
      handleOpenCheckout(
        conversionPrimaryPlan === 'large_export' ? 'large_flow_pass' : freeUsed ? 'free_limit_paywall' : 'upsell_card',
        conversionPrimaryPlan,
      );
    }
    if (primaryAction.intent === 'choose-path') openPathChooser();
    if (primaryAction.intent === 'refresh') handleScanPrototype();
  };

  const handleReviewHelpful = () => {
    setReviewFeedback('helpful');
    trackUiEvent('review_feedback_positive', {
      frameCount: completedExportFrameCount,
      attempt_id: state.activeExportAttemptId,
    });
  };

  const handleReviewDismiss = () => {
    setReviewFeedback('dismissed');
    trackUiEvent('review_feedback_not_yet', {
      frameCount: completedExportFrameCount,
      attempt_id: state.activeExportAttemptId,
    });
  };

  const handleErrorPrimary = () => {
    if (state.entitlementError) return handleRetryEntitlement();
    if (state.checkoutState === 'error') {
      return handleOpenCheckout(
        upgradePlanRef.current === 'large_export' ? 'large_flow_pass' : 'upsell_card',
        upgradePlanRef.current,
      );
    }
    if (state.restoreState === 'error') return handleStartRestorePurchase();
    if (errorModel?.primaryAction === 'Review flow') return handleScanPrototype();
    handleExport();
  };

  const resetForAnotherExport = () => {
    trackUiEvent('export_another_clicked', {
      source: 'success_screen',
      previous_export_id: state.activeExportAttemptId,
    });
    releaseExportRequest();
    setReviewFeedback('unasked');
    setState(prev => ({
      ...prev,
      stage: 'setup',
      videoUrl: null,
      downloadFilename: null,
      shareUrl: null,
      ownerShareUrl: null,
      shareState: 'idle',
      outputWidth: null,
      outputHeight: null,
      deliveryProfile: null,
      fileSizeBytes: null,
      activeExportAttemptId: null,
      exportStartedAt: null,
      downloadStarted: false,
      notice: null,
    }));
  };

  const exportDetails = [
    state.downloadFilename || `ProtoVid export.${state.settings.format}`,
    `Approx. ${estimatedDurationSeconds} sec`,
    `${completedExportFrameCount} ${pluralize(completedExportFrameCount, 'frame')}`,
    resolutionLabel,
    state.isPremium ? 'No watermark' : 'ProtoVid watermark',
    fileSizeLabel,
  ].filter(Boolean).join(' · ');

  const handleCopyExportDetails = async () => {
    trackUiEvent('copy_export_details_clicked', {
      source: 'success_screen',
      export_id: state.activeExportAttemptId,
    });
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(exportDetails);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = exportDetails;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }
      setState(prev => ({ ...prev, notice: 'Export details copied.' }));
    } catch (_error) {
      setState(prev => ({ ...prev, notice: `Could not copy automatically. Your ${selectedFormatLabel} is still ready to download.` }));
    }
  };

  const copyText = async (value: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = value;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  };

  const handleCreateShareLink = async () => {
    if (!state.videoUrl || state.shareState === 'creating') return;
    if (state.settings.format !== 'mp4') {
      setState(prev => ({ ...prev, notice: 'Client review links currently support MP4 exports. Download this file or switch to MP4 to share a review room.' }));
      return;
    }
    const experimentVariant = getShareExperimentVariant(state.anonymousId);

    trackUiEvent('share_clicked', {
      source: 'success_screen',
      resolution: state.settings.resolution,
      frameCount: state.activeExportFrameCount || state.frameCount,
    });
    trackUiEvent('review_invite_experiment_exposed', {
      source: 'success_screen',
      variant: experimentVariant,
    });
    trackUiEvent('client_review_link_clicked', { source: 'success_screen' });

    if (state.shareUrl) {
      try {
        await copyText(state.shareUrl);
        setState(prev => ({ ...prev, notice: 'Share link copied.' }));
        trackUiEvent('share_link_copied', { source: 'success_screen', reused: true, variant: experimentVariant });
      } catch (_error) {
        setState(prev => ({ ...prev, notice: 'Share link ready. Copy it from the browser address bar.' }));
      }
      return;
    }

    setState(prev => ({ ...prev, shareState: 'creating', notice: null }));
    trackUiEvent('share_link_requested', {
      source: 'success_screen',
      resolution: state.settings.resolution,
      frameCount: state.activeExportFrameCount || state.frameCount,
      isPremium: state.isPremium,
      fileSizeBytes: state.fileSizeBytes,
    });

    try {
      const videoResponse = await fetch(state.videoUrl);
      if (!videoResponse.ok) throw new Error('The exported file is no longer available.');
      const video = await videoResponse.blob();
      const response = await fetch(`${BACKEND_URL}/api/shares`, {
        method: 'POST',
        headers: {
          'Content-Type': getFormatMime(state.settings.format),
          'x-user-email': state.userEmail.trim(),
          ...(state.anonymousId ? { 'x-anonymous-id': state.anonymousId } : {}),
          'x-filename': state.downloadFilename || `protovid-export.${state.settings.format}`,
          'x-resolution': state.settings.resolution,
          'x-frame-count': String(state.activeExportFrameCount || state.frameCount),
          ...(selectedStartName ? { 'x-start-frame-name': selectedStartName } : {}),
          ...(selectedEndName ? { 'x-end-frame-name': selectedEndName } : {}),
          'x-estimated-duration-seconds': String(estimatedDurationSeconds),
          'x-share-experiment-variant': experimentVariant,
        },
        body: video,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || typeof data.url !== 'string') {
        throw new Error(data.error || 'Could not create a share link.');
      }

      await copyText(data.url);
      setState(prev => ({ ...prev, shareUrl: data.url, ownerShareUrl: typeof data.ownerUrl === 'string' ? data.ownerUrl : null, shareState: 'ready', notice: 'Approval link copied. It includes the video, decision brief, comments, and status.' }));
      trackUiEvent('share_link_copied', { source: 'success_screen', reused: false, variant: experimentVariant });
      trackUiEvent('review_invite_panel_shown', { source: 'success_screen', variant: experimentVariant });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not create a share link.';
      setState(prev => ({ ...prev, shareState: 'error', notice: `${message} Your ${selectedFormatLabel} is still ready to download.` }));
      trackUiEvent('share_link_failed', { source: 'success_screen', reason: message.slice(0, 120) });
    }
  };

  const handleCopyOwnerShareLink = async () => {
    if (!state.ownerShareUrl) return;
    try {
      await copyText(state.ownerShareUrl);
      setState(prev => ({ ...prev, notice: 'Private owner review link copied. Keep it for managing approval.' }));
    } catch (_error) {
      setState(prev => ({ ...prev, notice: 'Could not copy the owner link automatically.' }));
    }
  };

  const handleCopyReviewLink = async () => {
    if (!state.shareUrl) return;
    try {
      await copyText(state.shareUrl);
      setState(prev => ({ ...prev, notice: 'Review link copied.' }));
      trackUiEvent('review_invite_link_copied', { source: 'invite_panel', variant: getShareExperimentVariant(state.anonymousId) });
    } catch (_error) {
      setState(prev => ({ ...prev, notice: 'Could not copy automatically. Select the link and copy it manually.' }));
    }
  };

  const handleNativeShare = async () => {
    if (!state.shareUrl || !navigator.share) return;
    trackUiEvent('review_invite_native_share_clicked', { source: 'invite_panel', variant: getShareExperimentVariant(state.anonymousId) });
    try {
      await navigator.share({
        title: `Review ${state.downloadFilename || 'ProtoVid walkthrough'}`,
        text: 'Please review this ProtoVid walkthrough and leave timestamped feedback.',
        url: state.shareUrl,
      });
      trackUiEvent('review_invite_native_share_completed', { source: 'invite_panel', variant: getShareExperimentVariant(state.anonymousId) });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setState(prev => ({ ...prev, notice: 'Could not open the device share sheet. The review link is still ready to copy.' }));
      trackUiEvent('review_invite_native_share_failed', { source: 'invite_panel', variant: getShareExperimentVariant(state.anonymousId) });
    }
  };

  const handleEmailInvite = (email: string) => {
    if (!state.shareUrl || !email.includes('@')) return;
    const filename = state.downloadFilename || 'ProtoVid walkthrough';
    const subject = encodeURIComponent(`Review and approve ${filename}`);
    const body = encodeURIComponent(`Hi,\n\nPlease review this ProtoVid walkthrough, leave timestamped feedback, and mark whether it is approved here:\n${state.shareUrl}\n\nThanks!`);
    trackUiEvent('review_invite_email_clicked', { source: 'invite_panel', variant: getShareExperimentVariant(state.anonymousId) });
    window.location.href = `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;
    setState(prev => ({ ...prev, notice: `Email invite prepared for ${email}.` }));
  };

  const handleVoiceCommand = (command: VoiceCommand, transcript: string) => {
    setVoiceTranscript(transcript);
    setVoiceError(null);

    switch (command.type) {
      case 'export':
        handleExport();
        return;
      case 'refresh':
        handleScanPrototype();
        return;
      case 'set-resolution':
        handleResolutionChange(command.resolution);
        setState(prev => ({ ...prev, notice: `Resolution set to ${command.resolution}.` }));
        return;
      case 'download': {
        const downloadLink = document.querySelector('.success-actions a[download]') as HTMLAnchorElement | null;
        if (!downloadLink || state.stage !== 'complete') {
          setState(prev => ({ ...prev, notice: 'Finish an export first, then say “download video”.' }));
          return;
        }
        handleDownloadClick();
        downloadLink.click();
        return;
      }
      case 'share':
        if (state.stage !== 'complete' || !state.videoUrl) {
          setState(prev => ({ ...prev, notice: 'Finish an export first, then say “share it”.' }));
          return;
        }
        void handleCreateShareLink();
        return;
      case 'another-export':
        resetForAnotherExport();
        return;
      case 'choose-path':
        openPathChooser();
        return;
      case 'select-path': {
        const path = state.prototypePaths[command.index];
        if (!path) {
          setState(prev => ({ ...prev, notice: `I could not find path ${command.index + 1}.` }));
          return;
        }
        handlePathChange(path.id);
        return;
      }
      case 'upgrade':
        handleOpenCheckout(
          experimentPrimaryPlan === 'large_export' ? 'large_flow_pass' : freeUsed ? 'free_limit_paywall' : 'upsell_card',
          experimentPrimaryPlan,
        );
        return;
      case 'close':
        handleClosePlugin();
        return;
      case 'help':
        setState(prev => ({
          ...prev,
          notice: 'Try “refresh flow”, “set resolution to 1080p”, “export video”, “download video”, or “share it”.',
        }));
        return;
    }
  };

  voiceCommandHandlerRef.current = handleVoiceCommand;

  const stopVoiceListening = () => {
    const recognition = voiceRecognitionRef.current;
    voiceRecognitionRef.current = null;
    if (recognition) {
      try {
        recognition.stop();
      } catch (_error) {
        // Recognition may already have ended.
      }
    }
    setVoiceStatus('idle');
    setVoiceError(null);
  };

  const startVoiceListening = () => {
    if (voiceStatus === 'listening' || voiceStatus === 'processing') {
      stopVoiceListening();
      return;
    }

    const Recognition = getVoiceRecognitionConstructor();
    if (!Recognition) {
      setVoiceStatus('unsupported');
      setVoiceError('Voice controls are not available in this Figma environment.');
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = navigator.language || 'en-US';
    recognition.onstart = () => {
      setVoiceStatus('listening');
      setVoiceError(null);
    };
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() || '';
      if (!transcript) return;
      setVoiceTranscript(transcript);
      if (/\b(stop listening|cancel listening)\b/i.test(transcript)) {
        stopVoiceListening();
        return;
      }
      const command = parseVoiceCommand(transcript);
      if (!command) {
        setVoiceStatus('error');
        setVoiceError('I didn’t recognize that. Try “export video” or “set resolution to 1080p”.');
        return;
      }
      setVoiceStatus('processing');
      voiceCommandHandlerRef.current(command, transcript);
    };
    recognition.onerror = (event) => {
      const message = event.error === 'not-allowed'
        ? 'Microphone access is blocked. Allow it in Figma, then try again.'
        : event.error === 'no-speech'
          ? 'I didn’t hear a command. Try again.'
          : 'Voice input failed. Try the mic again or use the buttons.';
      setVoiceStatus('error');
      setVoiceError(message);
    };
    recognition.onend = () => {
      if (voiceRecognitionRef.current === recognition) voiceRecognitionRef.current = null;
      setVoiceStatus(current => current === 'error' ? 'error' : 'idle');
    };
    voiceRecognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (_error) {
      voiceRecognitionRef.current = null;
      setVoiceStatus('error');
      setVoiceError('Voice input could not start. Try the mic again.');
    }
  };

  const handleDismissCheckoutEmail = () => {
    trackUiEvent('checkout_email_abandoned', {
      source: upgradeSourceRef.current,
      plan: upgradePlanRef.current,
      pricingVariant: state.pricingVariant,
      offer_experiment_id: state.offerExperimentId,
      offer_experiment_variant: state.offerExperimentVariant,
      primary_offer: state.primaryOffer,
    });
    setNeedEmail(false);
    setEmailIntent('checkout');
  };

  const emailCapturePanel = collectEmail ? (
    <div class="email-capture" role="region" aria-labelledby="email-capture-heading">
      <h3 id="email-capture-heading">
        {emailIntent === 'restore'
          ? 'Restore purchase'
          : emailIntent === 'switch'
            ? 'Use another email'
            : emailIntent === 'save'
              ? 'Save your account email'
            : upgradePlanRef.current === 'large_export'
              ? 'Continue to Project Pass'
              : 'Continue to Studio'}
      </h3>
      <p>
        {emailIntent === 'restore'
          ? 'Enter the email used at checkout. We’ll check for active access.'
          : emailIntent === 'switch'
            ? 'Enter the email you want to use with ProtoVid.'
          : emailIntent === 'save'
            ? 'Save your email to track free exports and unlock faster checkout.'
          : upgradePlanRef.current === 'large_export'
            ? `${state.largeFlowPassLabel} · 7 days of unlimited clean exports, including 1080p and 4K. No subscription. Use your email to unlock and restore access.`
            : `${state.monthlyPriceLabel} · Unlimited clean exports, including 1080p and 4K. Renews monthly; cancel in Account. Use your email to unlock and restore access.`}
      </p>
      <label class="field-label" for="account-email">Email address</label>
      <input
        id="account-email"
        type="email"
        autocomplete="email"
        placeholder="you@example.com"
        value={state.userEmail}
        onInput={(event) => setState(prev => ({ ...prev, userEmail: event.currentTarget.value }))}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || !validEmail) return;
          emailIntent === 'restore'
            ? handleRestorePurchase()
            : emailIntent === 'switch'
              ? handleSwitchAccount()
            : emailIntent === 'save' ? handleSaveAccountEmail() : handleOpenCheckout(upgradeSourceRef.current, upgradePlanRef.current, true);
        }}
      />
      {state.userEmail.trim() && !validEmail && <p role="status">Enter a complete email, such as you@example.com.</p>}
      <button
        class="upgrade-cta"
        type="button"
        disabled={!validEmail || state.restoreState === 'checking' || state.checkoutState === 'opening'}
        onClick={() => emailIntent === 'restore'
          ? handleRestorePurchase()
          : emailIntent === 'switch'
            ? handleSwitchAccount()
          : emailIntent === 'save' ? handleSaveAccountEmail() : handleOpenCheckout(upgradeSourceRef.current, upgradePlanRef.current, true)}
      >
        {state.restoreState === 'checking'
          ? 'Checking purchase…'
          : emailIntent === 'restore'
            ? 'Restore purchase'
            : emailIntent === 'switch'
              ? 'Use this email'
            : emailIntent === 'save'
              ? 'Save email'
            : upgradePlanRef.current === 'large_export'
              ? `Continue — ${state.largeFlowPassLabel}`
              : `Continue — ${state.monthlyPriceLabel}`}
      </button>
      {emailIntent === 'checkout' && (
        <>
          <span class="stripe-note">Review and pay securely on Stripe. No charge at this step.</span>
          <button class="text-button centered" type="button" onClick={handleDismissCheckoutEmail}>Back to plans</button>
        </>
      )}
    </div>
  ) : null;

  const accountMenu = (
    <AccountMenu
      isPro={state.isPremium}
      canManage={(state.isPremium || Boolean(state.entitlement?.billingNotice)) && !isOneTimeAccess}
      onRestore={handleStartRestorePurchase}
      onUseAnotherEmail={handleStartUseAnotherEmail}
      onManage={handleOpenSubscriptionManagement}
    />
  );

  const feedback = (
    <>
      {errorModel && state.stage === 'setup' && state.hasPrototype && (
        <ErrorState
          title={errorModel.title}
          message={errorModel.message}
          reassurance={errorModel.reassurance}
          primaryLabel={state.entitlementError ? 'Try again' : errorModel.primaryAction}
          secondaryLabel={errorModel.secondaryAction}
          onPrimary={handleErrorPrimary}
          onSecondary={handleScanPrototype}
        />
      )}
      {state.notice && (
        <InlineNotice
          tone={
            state.notice.startsWith('Could not copy') || state.restoreState === 'error'
              ? 'warning'
              : state.restoreState === 'success' || state.checkoutState === 'success'
              ? 'success'
              : 'info'
          }
        >
          {state.notice}
        </InlineNotice>
      )}
      {state.checkoutState === 'opening' && <InlineNotice>Opening secure checkout in your browser…</InlineNotice>}
      {state.checkoutState === 'cancelled' && !state.notice && <InlineNotice>Your flow and settings are unchanged.</InlineNotice>}
    </>
  );

  return (
    <div class="app-shell">
      <AppHeader
        onClose={handleClosePlugin}
        voiceStatus={voiceStatus}
        voiceTranscript={voiceTranscript}
        voiceError={voiceError}
        onVoiceToggle={startVoiceListening}
        showUpgradePlan={!state.isPremium}
        upgradePlanLabel={conversionPrimaryPlan === 'large_export' ? 'Buy Project Pass' : 'Start Studio'}
        upgradePlanDisabled={state.checkoutState === 'opening'}
        onUpgradePlan={() => handleOpenCheckout('upsell_card', conversionPrimaryPlan)}
      />

      {state.stage !== 'loading' && state.entitlement?.billingNotice && (
        <section class="billing-notice" aria-label="Subscription billing" role="status">
          <strong>{state.entitlement.billingNotice.title}</strong>
          <p>{state.entitlement.billingNotice.message}</p>
          <button type="button" class="secondary-btn" onClick={handleOpenSubscriptionManagement}>
            {state.entitlement.billingNotice.actionLabel}
          </button>
        </section>
      )}

      {state.stage === 'loading' && (
        <main class="state-screen loading-screen" aria-busy="true" aria-labelledby="loading-heading">
          <div class="brand-loader"><img src="__PROTOVID_ICON__" alt="" /></div>
          <p class="state-eyebrow">1 · Detect</p>
          <h1 id="loading-heading">Finding your flow</h1>
          <p class="state-description" role="status" aria-live="polite">Checking this Figma page for connected frames.</p>
        </main>
      )}

      {state.stage === 'scanning' && (
        <main class="state-screen loading-screen" aria-busy="true" aria-labelledby="scanning-heading">
          <div class="brand-loader"><img src="__PROTOVID_ICON__" alt="" /></div>
          <p class="state-eyebrow">1 · Detect</p>
          <h1 id="scanning-heading">Refreshing your flow</h1>
          <p class="state-description" role="status" aria-live="polite">Following prototype connections from the selected start frame.</p>
        </main>
      )}

      {state.stage === 'checking-payment' && (
        <main class="state-screen checkout-screen" aria-busy="true" aria-labelledby="checkout-heading">
          <div class="state-icon state-icon-progress"><span /></div>
          <p class="state-eyebrow">Account</p>
          <h1 id="checkout-heading">{getCheckoutConfirmCopy(state.pendingCheckoutPlan).heading}</h1>
          <p class="state-description" role="status" aria-live="polite">{getCheckoutConfirmCopy(state.pendingCheckoutPlan).body}</p>
          <InlineNotice>Your selected flow and export setup are preserved.</InlineNotice>
          <button class="secondary-button" type="button" onClick={handleCancelPaymentCheck}>Back to export setup</button>
        </main>
      )}

      {state.stage === 'setup' && !state.hasPrototype && (
        <div class="screen-scroll empty-screen-wrap">
          {errorModel && (state.entitlementError || errorModel.code === 'network' || errorModel.code === 'offline') && (
            <ErrorState
              title={errorModel.title}
              message={errorModel.message}
              reassurance="Your Figma file has not been changed."
              primaryLabel="Try again"
              onPrimary={state.entitlementError ? handleRetryEntitlement : handleScanPrototype}
            />
          )}
          <EmptyState unconnectedFrameCount={state.unconnectedFrameCount} onRefresh={handleScanPrototype} onClose={handleClosePlugin} onOpenGuide={handleOpenSetupGuide} onConnectExistingFrames={() => {
            trackUiEvent('setup_frames_autoconnect_requested', { frameCount: state.unconnectedFrameCount });
            setState(prev => ({ ...prev, stage: 'scanning', error: null }));
            parent.postMessage({ pluginMessage: { type: 'connect-existing-frames' } }, '*');
          }} onCreateExample={(slug, source) => {
            trackUiEvent('setup_example_selected', { source, example: slug });
            setState(prev => ({ ...prev, stage: 'scanning', error: null }));
            parent.postMessage({ pluginMessage: { type: 'create-example-prototype', data: { slug, source } } }, '*');
          }} />
          {emailCapturePanel && <SectionCard title="Account">{emailCapturePanel}</SectionCard>}
          {accountMenu}
        </div>
      )}

      {state.stage === 'setup' && state.hasPrototype && (
        <>
          <div class="screen-scroll setup-scroll">
            <main class="setup-screen">
              <h1 class="sr-only">ProtoVid export setup</h1>
              {feedback}
              <FlowStatus
                frameCount={selectedPathFrameCount}
                estimatedDuration={estimatedDuration}
                allowance={isOneTimeAccess && accessEndLabel ? `Active through ${accessEndLabel}` : allowanceCopy}
                isPro={state.isPremium}
                startName={selectedStartName}
                endName={selectedEndName}
                hasIssue={hasBlockingFlowError}
                onRefresh={handleScanPrototype}
                onChoosePath={hasMultiplePaths ? openPathChooser : undefined}
              />

              {state.frameCount === 1 && (
                <InlineNotice tone="warning">Only one frame is connected. Add another prototype connection for a walkthrough.</InlineNotice>
              )}
              {state.flowAnalysis?.mixedDimensions && (
                <InlineNotice tone="warning">Frame dimensions vary. ProtoVid will fit each frame to the selected output size.</InlineNotice>
              )}
              {state.checkoutState === 'success' && state.isPremium && (
                <InlineNotice tone="success">
                  {isOneTimeAccess
                    ? getPaidAccessActivatedNotice('large_export')
                    : getPaidAccessActivatedNotice('monthly')}
                </InlineNotice>
              )}
              {needsLargePathWarning && (
                <InlineNotice tone="warning">This is a very large flow. A shorter path or 720p will be more reliable.</InlineNotice>
              )}
              {hasAutoSelectedPath && (
                <InlineNotice tone="info">
                  We selected the shortest reliable connected path for you. Review another route below if needed.
                </InlineNotice>
              )}
              {state.pathEnumerationTruncated && hasAutoSelectedPath && (
                <InlineNotice tone="info">
                  This prototype has many routes; the chooser shows the safest candidates found during the scan.
                </InlineNotice>
              )}
              {selectedPath?.truncated && (
                <InlineNotice tone="warning">This path contains a loop. ProtoVid will include one complete cycle.</InlineNotice>
              )}

              {hasMultiplePaths && (
                <details id="path-chooser" class="path-chooser" open={needsPathSelection}>
                  <summary>
                    <span><strong>Connected path</strong><small>{selectedPath?.label || 'Choose a path'}</small></span>
                    <Icon name="chevron" size={15} />
                  </summary>
                  <div class="path-options">
                    {state.prototypePaths.map(path => (
                      <button
                        key={path.id}
                        type="button"
                        class={path.id === state.selectedPathId ? 'is-selected' : ''}
                        aria-pressed={path.id === state.selectedPathId}
                        onClick={() => handlePathChange(path.id)}
                      >
                        <span>{path.startNodeName || 'Start'} → {path.endNodeName || 'End'}</span>
                        <small>{path.frameCount} {pluralize(path.frameCount, 'frame')} · {path.estimatedDuration || path.frameCount * 2} sec</small>
                      </button>
                    ))}
                  </div>
                </details>
              )}

              <SectionCard title="Export setup" eyebrow="2 · Configure">
                <ResolutionSelector
                  options={getResolutionOptions(plan)}
                  value={state.settings.resolution}
                  onChange={handleResolutionChange}
                />
                <FormatSelector
                  value={state.settings.format}
                  onChange={handleFormatChange}
                />
                <ExportSummary summary={summaryCopy} />
                <TrustRow />
              </SectionCard>

              {freeUsed && !collectEmail && (
                <UpgradeChoicePanel
                  frameCount={selectedPathFrameCount}
                  estimatedDuration={estimatedDuration}
                  selectedResolution={state.settings.resolution}
                  projectPassAvailable={showLargeFlowPassOffer}
                  projectPassLabel={LARGE_FLOW_PASS_DISPLAY}
                  monthlyLabel={PRO_PRICE_MONTHLY_DISPLAY}
                  projectPassFirst={freeUsed && showLargeFlowPassOffer ? true : experimentPrimaryPlan === 'large_export'}
                  onProjectPass={() => handleOpenCheckout('free_limit_paywall', 'large_export')}
                  onMonthly={() => handleOpenCheckout('free_limit_paywall', 'monthly')}
                />
              )}

              {emailCapturePanel && <SectionCard title="Account">{emailCapturePanel}</SectionCard>}

              {state.paymentCheckAvailable && state.userEmail && (
                <section class="checkout-recovery" aria-label="Pending checkout">
                  <div><strong>Finish checkout when ready</strong><span>Your flow, resolution, and path are saved.</span></div>
                  <div class="recovery-actions">
                    <button type="button" class="secondary-button" onClick={handleResumeCheckout}>Resume checkout</button>
                    <button type="button" class="text-button" onClick={handleManualPaymentCheck}>Check payment</button>
                  </div>
                </section>
              )}

              {accountMenu}
            </main>
          </div>
          <StickyActionBar action={primaryAction} onAction={handlePrimaryAction} />
        </>
      )}

      {state.stage === 'exporting' && (
        <div class="screen-scroll">
          <ProgressSteps
            model={progressModel}
            elapsed={elapsedLabel}
            frameCount={state.activeExportFrameCount || selectedPathFrameCount}
            resolution={state.settings.resolution}
            formatLabel={selectedFormatLabel}
            detail={progressDetail}
          />
        </div>
      )}

      {state.stage === 'complete' && state.videoUrl && (
        <div class="screen-scroll success-scroll">
          <main class="success-screen" aria-labelledby="success-heading">
            <div class="success-heading-row" role="status" aria-live="polite">
              <span class="notice-icon notice-icon-success"><Icon name="check" size={19} /></span>
              <div>
                <p class="state-eyebrow">4 · Download</p>
                <h1 id="success-heading">Your {selectedFormatLabel} is ready</h1>
              </div>
            </div>
            {state.downloadStarted && <InlineNotice tone="success">Your download has started.</InlineNotice>}
            {state.notice && (
              <InlineNotice tone={state.notice.startsWith('Could not copy') ? 'warning' : 'success'}>
                {state.notice}
              </InlineNotice>
            )}
            <FileSummary data={{
              filename: state.downloadFilename || `protovid-export.${state.settings.format}`,
              duration: `≈ ${estimatedDurationSeconds} sec`,
              frameCount: completedExportFrameCount,
              resolution: resolutionLabel,
              formatLabel: selectedFormatLabel,
              watermark: state.isPremium ? 'None' : 'Included',
              fileSize: fileSizeLabel,
            }} />
            <SuccessActions
              downloadUrl={state.videoUrl}
              filename={state.downloadFilename || `protovid-export.${state.settings.format}`}
              onDownload={handleDownloadClick}
              onAnother={resetForAnotherExport}
              onCopy={handleCopyExportDetails}
              onShare={handleCreateShareLink}
              shareState={state.shareState}
              reviewShareAvailable={state.settings.format === 'mp4'}
            />
            {state.shareUrl && (
              <ShareInvitePanel
                shareUrl={state.shareUrl}
                onCopyLink={handleCopyReviewLink}
                onNativeShare={handleNativeShare}
                onEmailInvite={handleEmailInvite}
                nativeShareAvailable={typeof navigator !== 'undefined' && typeof navigator.share === 'function'}
              />
            )}
            {state.ownerShareUrl && (
              <button class="text-button" type="button" onClick={handleCopyOwnerShareLink}>
                Copy private owner review link
              </button>
            )}
            {state.deliveryProfile === 'fallback' && (
              <InlineNotice tone={state.isPremium && state.settings.resolution !== '720p' ? 'warning' : 'info'}>
                {state.isPremium && state.settings.resolution !== '720p'
                  ? `Your selected ${state.settings.resolution} encoder was unavailable, so this compatibility preview was delivered at ${state.outputWidth && state.outputHeight ? `${state.outputWidth} × ${state.outputHeight}` : 'a lower resolution'}. Try again for the selected quality.`
                  : 'Delivered with a safer compatibility profile. Your selected quality remains unchanged for the next export.'}
              </InlineNotice>
            )}
            {shouldShowReview && reviewFeedback !== 'dismissed' && !collectEmail && (
              <ReviewPrompt
                feedbackState={reviewFeedback === 'helpful' ? 'helpful' : 'unasked'}
                onHelpful={handleReviewHelpful}
                onReview={handleOpenCommunityListing}
                onDismiss={handleReviewDismiss}
              />
            )}
            {emailCapturePanel && <SectionCard title="Account">{emailCapturePanel}</SectionCard>}
            {!state.isPremium && !collectEmail && (
              <UpgradeCard
                monthlyLabel={state.monthlyPriceLabel.replace('/mo', '/month')}
                onMonthly={() => handleOpenCheckout('upsell_card', 'monthly')}
                projectPassLabel={showLargeFlowPassOffer ? state.largeFlowPassLabel : null}
                onProjectPass={showLargeFlowPassOffer
                  ? () => handleOpenCheckout('large_flow_pass', 'large_export')
                  : undefined}
                primaryOffer={experimentPrimaryPlan}
              />
            )}
            {showPostSuccessEmailSave && !collectEmail && (
              <PostSuccessEmailSave
                email={state.userEmail}
                validEmail={validEmail}
                onEmailChange={(value) => setState(prev => ({ ...prev, userEmail: value }))}
                onSave={handleSaveAccountEmail}
                onDismiss={handleDismissPostSuccessEmail}
              />
            )}
            {accountMenu}
          </main>
        </div>
      )}
    </div>
  );
}

// Render app
render(<App />, document.getElementById('app')!);
