// ProtoVid - Main Plugin Code (runs in Figma sandbox)
import examples from '../backend/app/guides/examples/examples.json';
import { FREE_RESOLUTION } from './planConfig';
import {
  ENTITLEMENT_VERIFICATION_ERROR,
  EntitlementResponse,
  normalizeEntitlementResponse,
} from './entitlement';
import {
  buildLayerKeys,
  matchSmartAnimateLayers,
  normalizeLayerName,
  scaleBounds,
  type LayerBounds,
  type LayerSnapshot,
  type SmartAnimateLayerMotion,
} from './smartAnimateMatcher';
import { getRecommendedPathId } from './uiModel';
import { buildExportEventId } from './exportAnalytics';

interface ProtoVidExportSettings {
  resolution: '720p' | '1080p' | '4K';
  format: 'mp4' | 'webm' | 'gif';
  showCursor: boolean;
  licenseKey?: string;
  frameCount?: number;
  // Sent by the UI after a scan when a page has more than one connected
  // prototype route. Keeping the ID and ordered IDs separate lets us reject a
  // stale or tampered selection before any export credit is reserved.
  selectedPathId?: string;
  selectedPathFrameIds?: string[];
}

type AnalyticsMetadata = Record<string, unknown>;

interface SavedExportPreferences {
  settings: Pick<ProtoVidExportSettings, 'resolution' | 'format' | 'showCursor'>;
  selectedPathId?: string;
  selectedPathFrameIds?: string[];
  lastSuccessfulExportAt: string;
  lastSuccessfulExportId: string;
}

interface PendingCheckout {
  email: string;
  url: string;
  plan: 'monthly' | 'large_export';
  sessionId?: string;
  createdAt: string;
  checkoutConfigVersion?: number;
}

interface BillingManagementCapability {
  token: string;
  expiresAt: string;
  // The capability can only ever be reused by the same saved account. This
  // prevents an account switch on a shared Figma installation from opening a
  // prior customer's Stripe portal.
  email: string;
}

// Screen-level transition metadata read from a prototype reaction. Used by the
// encoder to synthesize transition effects (fade/slide) and best-effort
// layer-level motion between frames.
interface TransitionMeta {
  type: string;        // Figma transition type, e.g. DISSOLVE, MOVE_IN, PUSH
  direction?: string;  // LEFT | RIGHT | TOP | BOTTOM for directional transitions
  duration: number;    // seconds
  easing: string;      // Figma easing type, e.g. EASE_OUT
  smartAnimateLayers?: SmartAnimateLayerMotion[] | null;
}

interface PrototypeFrame {
  nodeId: string;
  nodeName: string;
  imageData: Uint8Array;
  width: number;
  height: number;
  exportScale: number;
  layers: LayerSnapshot[];
  // Transition from the previous frame in the emitted sequence into this frame.
  transitionIn?: TransitionMeta | null;
}

interface PrototypeGraph {
  edges: Map<string, Set<string>>;
  allFrameIds: Set<string>;
  transitions: Map<string, Map<string, TransitionMeta>>;
}

type PrototypePathTruncationReason = 'cycle';

interface PrototypePathPreflight {
  frameCount: number;
  estimatedDuration: number;
  maxRecommendedFrames: number;
  // `selected` means that the chosen output quality is reasonable for the
  // path length. Long paths recommend the more reliable 720p fallback, but
  // are never blocked solely due to their size.
  recommendedQuality: 'selected' | '720p';
  status: 'ready' | 'long_path' | 'split_recommended';
  message: string | null;
}

/**
 * Serializable path metadata sent to the UI. `frameIds` are intentionally
 * retained so the UI can render an order preview without needing another
 * plugin round trip; the export handler still reconstructs and validates the
 * path against the current Figma graph.
 */
interface PrototypePathDescriptor {
  id: string;
  frameIds: string[];
  frameCount: number;
  startNodeId: string;
  endNodeId: string;
  startNodeName: string | null;
  endNodeName: string | null;
  label: string;
  estimatedDuration: number;
  preflight: PrototypePathPreflight;
  truncated: boolean;
  truncationReason: PrototypePathTruncationReason | null;
}

interface PrototypePathCatalog {
  paths: PrototypePathDescriptor[];
  pathSelectionRequired: boolean;
  defaultPathId: string | null;
  pathEnumerationTruncated: boolean;
}

interface ResolvedPrototypePath {
  graph: PrototypeGraph;
  catalog: PrototypePathCatalog;
  path: PrototypePathDescriptor;
  selectionSource: 'automatic_single_path' | 'automatic_recommended_path' | 'selected_path_id' | 'selected_frame_ids';
}

// State
let currentSettings: ProtoVidExportSettings = {
  resolution: '720p',
  format: 'mp4',
  showCursor: true
};

import { PLUGIN_VERSION } from './version';
const BACKEND_URL = 'https://protovid.dasgroupllc.com';
const SETUP_GUIDE_URL = `${BACKEND_URL}/guides/first-export`;
const CHECKOUT_SESSION_CONFIG_VERSION = 2;
const EXPORT_FORMATS = ['mp4', 'webm', 'gif'] as const;
// These are diagnostics and enumeration safeguards, not export limits. A
// selected long path remains exportable; the UI can use the preflight message
// to suggest splitting it or choosing 720p before a costly encode fails.
const LONG_PATH_FRAME_THRESHOLD = 25;
const RECOMMENDED_MAX_PATH_FRAMES = 50;
const MAX_ENUMERATED_PROTOTYPE_PATHS = 100;
let exportInProgress = false;
let checkoutInProgress = false;
let currentExportCharged = false;
let currentExportCommitted = false;
let trialExpired = false;
let daysSinceFirstExport: number | null = null;
let anonymousId: string | null = null;
let currentEntitlement: EntitlementResponse | null = null;
let currentExportAttemptId: string | null = null;
let currentExportIsFirst = true;
let sessionAnalyticsTracked = false;

function createAnonymousId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `pv_${Date.now().toString(36)}_${random}`;
}

async function loadAnonymousId(): Promise<string> {
  if (anonymousId) return anonymousId;
  try {
    const stored = await figma.clientStorage.getAsync('anonymousId');
    if (typeof stored === 'string' && stored.startsWith('pv_')) {
      anonymousId = stored;
      return stored;
    }
    anonymousId = createAnonymousId();
    await figma.clientStorage.setAsync('anonymousId', anonymousId);
    return anonymousId;
  } catch (_e) {
    anonymousId = anonymousId || createAnonymousId();
    return anonymousId;
  }
}

function createExportAttemptId(): string {
  return `exp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function getOpaqueProjectId(): string {
  const figmaWithFileKey = figma as typeof figma & { fileKey?: string };
  return figmaWithFileKey.fileKey || `page:${figma.currentPage.id}`;
}

function getExportPreferencesKey(): string {
  return `exportPreferences:${getOpaqueProjectId()}`;
}

async function loadSavedExportPreferences(): Promise<SavedExportPreferences | null> {
  try {
    const value = await figma.clientStorage.getAsync(getExportPreferencesKey());
    if (!value || typeof value !== 'object') return null;
    const preferences = value as Partial<SavedExportPreferences>;
    if (
      !preferences.settings ||
      !['720p', '1080p', '4K'].includes(preferences.settings.resolution) ||
      !EXPORT_FORMATS.includes(preferences.settings.format as ProtoVidExportSettings['format']) ||
      typeof preferences.settings.showCursor !== 'boolean' ||
      typeof preferences.lastSuccessfulExportAt !== 'string' ||
      typeof preferences.lastSuccessfulExportId !== 'string'
    ) return null;
    return {
      settings: {
        resolution: preferences.settings.resolution as ProtoVidExportSettings['resolution'],
        format: preferences.settings.format as ProtoVidExportSettings['format'],
        showCursor: preferences.settings.showCursor,
      },
      selectedPathId: typeof preferences.selectedPathId === 'string' ? preferences.selectedPathId : undefined,
      selectedPathFrameIds: Array.isArray(preferences.selectedPathFrameIds)
        ? preferences.selectedPathFrameIds.filter((id): id is string => typeof id === 'string')
        : undefined,
      lastSuccessfulExportAt: preferences.lastSuccessfulExportAt,
      lastSuccessfulExportId: preferences.lastSuccessfulExportId,
    };
  } catch (_error) {
    return null;
  }
}

async function saveExportPreferences(exportId: string) {
  try {
    await figma.clientStorage.setAsync(getExportPreferencesKey(), {
      settings: {
        resolution: currentSettings.resolution,
        format: currentSettings.format,
        showCursor: currentSettings.showCursor,
      },
      selectedPathId: currentSettings.selectedPathId,
      selectedPathFrameIds: currentSettings.selectedPathFrameIds,
      lastSuccessfulExportAt: new Date().toISOString(),
      lastSuccessfulExportId: exportId,
    } satisfies SavedExportPreferences);
  } catch (_error) {
    // Preferences improve repeat exports but must never block a completed export.
  }
}

async function trackFirstOpenOnce() {
  try {
    const key = 'hasTrackedFirstOpen';
    if (await figma.clientStorage.getAsync(key)) return;
    await figma.clientStorage.setAsync(key, true);
    await trackEvent('first_open');
  } catch (_error) {
    // Degrade to a session event when client storage is unavailable. Avoid
    // writing a misleading repeated first-open event.
  }
}

async function trackFirstValueOnce(metadata: Record<string, unknown>) {
  try {
    const key = 'hasTrackedFirstValue';
    if (await figma.clientStorage.getAsync(key)) return;
    await figma.clientStorage.setAsync(key, true);
    await trackEvent('first_value_reached', metadata);
  } catch (_error) {
    // `export_completed` remains the canonical terminal event if local
    // storage is unavailable; do not over-count first value.
  }
}

async function trackOnboardingCompletedOnce(metadata: Record<string, unknown>) {
  try {
    const key = 'hasTrackedOnboardingCompleted';
    if (await figma.clientStorage.getAsync(key)) return;
    await figma.clientStorage.setAsync(key, true);
    await trackEvent('onboarding_completed', metadata);
  } catch (_error) {
    // Analytics must never block a successful export.
  }
}

// ---- Email persistence ----
async function loadEmail(): Promise<string | null> {
  try {
    return await figma.clientStorage.getAsync('userEmail') || null;
  } catch (_e) {
    return null;
  }
}

async function saveEmail(email: string) {
  try {
    await figma.clientStorage.setAsync('userEmail', email);
  } catch (e) {
    console.error('Failed to save email:', e);
  }
}

async function loadPendingCheckout(): Promise<PendingCheckout | null> {
  try {
    const value = await figma.clientStorage.getAsync('pendingCheckout');
    if (!value || typeof value !== 'object') return null;
    const checkout = value as PendingCheckout;
    if (!checkout.email || !checkout.url || !checkout.createdAt) return null;
    if (checkout.checkoutConfigVersion !== CHECKOUT_SESSION_CONFIG_VERSION) {
      await figma.clientStorage.deleteAsync('pendingCheckout');
      return null;
    }
    const ageMs = Date.now() - new Date(checkout.createdAt).getTime();
    if (!Number.isFinite(ageMs) || ageMs > 24 * 60 * 60 * 1000) {
      await figma.clientStorage.deleteAsync('pendingCheckout');
      return null;
    }
    return checkout;
  } catch (_e) {
    return null;
  }
}

async function savePendingCheckout(checkout: PendingCheckout) {
  try {
    await figma.clientStorage.setAsync('pendingCheckout', checkout);
  } catch (e) {
    console.error('Failed to save pending checkout:', e);
  }
}

async function clearPendingCheckout() {
  try {
    await figma.clientStorage.deleteAsync('pendingCheckout');
  } catch (_e) {
    // Non-critical.
  }
}

async function loadBillingManagementCapability(): Promise<BillingManagementCapability | null> {
  try {
    const value = await figma.clientStorage.getAsync('billingManagementCapability');
    if (!value || typeof value !== 'object') return null;
    const capability = value as BillingManagementCapability;
    const expiry = new Date(capability.expiresAt).getTime();
    if (
      !capability.token ||
      !capability.expiresAt ||
      !capability.email ||
      !Number.isFinite(expiry) ||
      expiry <= Date.now()
    ) {
      await figma.clientStorage.deleteAsync('billingManagementCapability');
      return null;
    }
    return capability;
  } catch (_error) {
    return null;
  }
}

async function saveBillingManagementCapability(capability: BillingManagementCapability) {
  try {
    await figma.clientStorage.setAsync('billingManagementCapability', capability);
  } catch (error) {
    console.error('Could not save billing management capability:', error);
  }
}

async function clearBillingManagementCapability() {
  try {
    await figma.clientStorage.deleteAsync('billingManagementCapability');
  } catch (_error) {
    // Non-critical cleanup.
  }
}

/**
 * A completed Checkout session is proof that this device initiated the paid
 * purchase. Exchange it for a scoped, expiring management capability; never
 * mint a portal/cancel credential from an email address alone.
 */
async function exchangeCheckoutSessionForManagementToken(sessionId?: string, email?: string): Promise<boolean> {
  const normalizedEmail = email?.toLowerCase().trim();
  if (!sessionId || !normalizedEmail) return false;

  try {
    const response = await fetch(`${BACKEND_URL}/api/billing/management-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    if (!response.ok) return false;

    const data = await response.json();
    if (typeof data.managementToken !== 'string' || typeof data.expiresAt !== 'string') return false;
    await saveBillingManagementCapability({
      token: data.managementToken,
      expiresAt: data.expiresAt,
      email: normalizedEmail,
    });
    return true;
  } catch (error) {
    if (isDevelopment()) console.error('Could not exchange checkout session for management token:', error);
    return false;
  }
}

// ---- Usage tracking ----
let analyticsQueue: Promise<void> = Promise.resolve();

async function trackEvent(eventType: string, metadata?: AnalyticsMetadata) {
  const exportId = currentExportAttemptId;
  const explicitEventId = typeof metadata?.event_id === 'string' ? metadata.event_id : null;
  const retryAttempt = typeof metadata?.retry_attempt === 'number' ? metadata.retry_attempt : null;
  const eventId = explicitEventId || buildExportEventId(exportId, eventType, retryAttempt);
  const enrichedMetadata: AnalyticsMetadata = {
    ...(metadata || {}),
    project_id: getOpaqueProjectId(),
    ...(exportId ? { export_id: exportId } : {}),
    ...(eventId ? { event_id: eventId } : {}),
  };
  analyticsQueue = analyticsQueue.then(async () => {
    try {
      const [anon, email] = await Promise.all([loadAnonymousId(), loadEmail()]);
      const safeMetadata: Record<string, string | number | boolean | null> = {};
      for (const [key, value] of Object.entries({ ...enrichedMetadata, anonymousId: anon })) {
        if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
          safeMetadata[key] = value;
        }
      }
      // The plugin UI is already the proven network surface for pricing and
      // entitlement calls. Deliver analytics through it as well: recent Figma
      // builds completed exports while main-sandbox /api/track calls vanished.
      figma.ui.postMessage({
        type: 'analytics-event',
        data: {
          email,
          eventType,
          pluginVersion: PLUGIN_VERSION,
          metadata: safeMetadata,
        }
      });
    } catch (e) {
      console.error('Tracking error:', e);
    }
  });

  return analyticsQueue;
}

function getFrameCountBucket(frameCount: number): '0' | '1' | '2-3' | '4-10' | '10+' {
  if (frameCount <= 0) return '0';
  if (frameCount === 1) return '1';
  if (frameCount <= 3) return '2-3';
  if (frameCount <= 10) return '4-10';
  return '10+';
}

function isDevelopment(): boolean {
  return BACKEND_URL.includes('localhost') || PLUGIN_VERSION.includes('dev');
}

function getEntitlementRequestBody(email: string | null, userId: string) {
  return email ? { email, userId } : { userId };
}

function logEntitlement(entitlement: EntitlementResponse) {
  if (!isDevelopment()) return;
  console.log('[ProtoVid entitlement]', {
    appVersion: PLUGIN_VERSION,
    environment: 'figma-plugin',
    userId: entitlement.userId,
    billingPeriodKey: entitlement.billingPeriodKey,
    subscriptionStatus: entitlement.subscriptionStatus,
    isPaid: entitlement.isPaid,
    freeTierExperimentId: entitlement.freeTierExperimentId,
    freeExportsLimit: entitlement.freeExportsLimit,
    freeExportsUsed: entitlement.freeExportsUsed,
    freeExportsRemaining: entitlement.freeExportsRemaining,
    watermarkRequired: entitlement.watermarkRequired,
    canExport: entitlement.canExport,
    upgradeRequired: entitlement.upgradeRequired,
    source: 'backend',
  });
}

// ---- Server-side entitlement check ----
async function loadEntitlement(email: string | null): Promise<EntitlementResponse> {
  const userId = await loadAnonymousId();
  const response = await fetch(`${BACKEND_URL}/api/exports/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(getEntitlementRequestBody(email, userId))
  });

  if (!response.ok) {
    throw new Error(ENTITLEMENT_VERIFICATION_ERROR);
  }

  const entitlement = normalizeEntitlementResponse(await response.json());
  if (!entitlement) {
    throw new Error(ENTITLEMENT_VERIFICATION_ERROR);
  }

  currentEntitlement = entitlement;
  logEntitlement(entitlement);
  return entitlement;
}

async function incrementServerExports(email: string | null): Promise<EntitlementResponse> {
  const userId = await loadAnonymousId();
  const response = await fetch(`${BACKEND_URL}/api/exports/increment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(getEntitlementRequestBody(email, userId))
  });

  if (!response.ok) {
    throw new Error(ENTITLEMENT_VERIFICATION_ERROR);
  }

  const entitlement = normalizeEntitlementResponse(await response.json());
  if (!entitlement) {
    throw new Error(ENTITLEMENT_VERIFICATION_ERROR);
  }

  currentEntitlement = entitlement;
  logEntitlement(entitlement);
  return entitlement;
}

async function reserveFreeExport(_email: string | null) {
  currentExportCharged = true;
}

async function rollbackFreeExport() {
  if (!currentExportCharged || currentExportCommitted) return;
  currentExportCharged = false;
}

async function commitFreeExport(email: string | null) {
  if (currentExportCommitted) return;
  const entitlement = await incrementServerExports(email);
  currentExportCommitted = true;
  figma.ui.postMessage({
    type: 'export-count-updated',
    data: { entitlement }
  });
}

// Initialize plugin
figma.showUI(__html__, { width: 400, height: 720, themeColors: true });

// Warm the stable actor identity. Session events are emitted after the UI's
// init message so its analytics listener is ready to receive them.
loadAnonymousId();

// Top-level frames the designer already drew but has not wired into a prototype.
// These are the raw material for a one-click "connect and export" so a first
// export uses the user's real screens instead of a throwaway canned example.
function getUnconnectedTopLevelFrames(): FrameNode[] {
  return figma.currentPage.children
    .filter((node): node is FrameNode => node.type === 'FRAME')
    .filter(frame => !Array.isArray(frame.reactions) || frame.reactions.length === 0)
    .sort((a, b) => (a.x - b.x) || (a.y - b.y));
}

// Wire the designer's existing frames left-to-right so a disconnected page can
// reach a first export without teaching Figma prototyping. Re-scans afterwards
// so the normal connected-path flow takes over.
async function handleConnectExistingFrames() {
  const frames = getUnconnectedTopLevelFrames();
  if (frames.length < 2) {
    trackEvent('setup_autoconnect_skipped', { frameCount: frames.length });
    await handleScanPrototype();
    return;
  }
  for (let index = 0; index < frames.length - 1; index++) {
    await frames[index].setReactionsAsync([{
      trigger: { type: 'ON_CLICK' },
      actions: [{ type: 'NODE', destinationId: frames[index + 1].id, navigation: 'NAVIGATE',
        transition: { type: 'DISSOLVE', duration: 0.3, easing: { type: 'EASE_IN_AND_OUT' } }, preserveScrollPosition: false }],
    }]);
  }
  figma.currentPage.selection = [frames[0]];
  figma.viewport.scrollAndZoomIntoView(frames);
  trackEvent('setup_frames_autoconnected', { frameCount: frames.length });
  await handleScanPrototype();
}

// Explicitly requested from the empty state; keep the user's existing page intact.
async function handleCreateExamplePrototype(slug?: string, source = 'example_picker') {
  const example = examples.find(item => item.slug === slug) || examples[0];
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
  const page = figma.createPage();
  page.name = `ProtoVid — ${example.project}`;
  await figma.setCurrentPageAsync(page);
  const frames = example.frames.map((screen, index) => {
    const frame = figma.createFrame();
    frame.name = screen.name;
    frame.resize(1280, 720);
    frame.x = index * 1400;
    frame.fills = [{ type: 'SOLID', color: { r: 0.05, g: 0.09, b: 0.08 } }];
    const title = figma.createText();
    title.fontName = { family: 'Inter', style: 'Regular' };
    title.characters = screen.title;
    title.fontSize = 48;
    title.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.96, b: 0.92 } }];
    frame.appendChild(title);
    title.x = 64; title.y = 168;
    const body = figma.createText();
    body.fontName = { family: 'Inter', style: 'Regular' };
    body.characters = screen.body;
    body.fontSize = 28;
    body.fills = [{ type: 'SOLID', color: { r: 0.65, g: 0.8, b: 0.7 } }];
    frame.appendChild(body);
    body.x = 64; body.y = 252;
    const button = figma.createRectangle();
    button.name = screen.button; button.resize(360, 64); button.cornerRadius = 8;
    button.fills = [{ type: 'SOLID', color: { r: 0.25, g: 0.8, b: 0.5 } }];
    frame.appendChild(button); button.x = 64; button.y = 520;
    const caption = figma.createText();
    caption.fontName = { family: 'Inter', style: 'Regular' };
    caption.characters = screen.button; caption.fontSize = 24;
    frame.appendChild(caption); caption.x = 84; caption.y = 536;
    return frame;
  });
  for (let index = 0; index < frames.length - 1; index++) {
    await frames[index].setReactionsAsync([{
      trigger: { type: 'ON_CLICK' },
      actions: [{ type: 'NODE', destinationId: frames[index + 1].id, navigation: 'NAVIGATE',
        transition: { type: 'DISSOLVE', duration: 0.3, easing: { type: 'EASE_IN_AND_OUT' } }, preserveScrollPosition: false }],
    }]);
  }
  page.selection = [frames[0]];
  figma.viewport.scrollAndZoomIntoView(frames);
  trackEvent('setup_example_created', { source, example: example.slug, frameCount: frames.length });
  await handleScanPrototype();
}

// Message handler
figma.ui.onmessage = async (msg: { type: string; data?: any }) => {
  try {
    switch (msg.type) {
      case 'init':
        await handleInit();
        break;

      case 'scan-prototype':
        await handleScanPrototype();
        break;

      case 'create-example-prototype':
        await handleCreateExamplePrototype(msg.data?.slug, msg.data?.source);
        break;

      case 'connect-existing-frames':
        await handleConnectExistingFrames();
        break;

      case 'open-setup-guide':
        trackEvent('setup_guide_opened', { source: 'empty_state' });
        figma.openExternal(SETUP_GUIDE_URL);
        break;

      case 'export-video':
        await handleExportVideo(msg.data as ProtoVidExportSettings);
        break;

      case 'validate-license':
        await handleValidateLicense(msg.data.licenseKey);
        break;

      case 'cancel':
        figma.closePlugin();
        break;

      case 'encoding-complete':
        await handleEncodingComplete(
          msg.data?.isPremium ?? false,
          msg.data?.usedSafeRetry === true,
          msg.data || {}
        );
        break;

      case 'encoding-failed':
        await rollbackFreeExport();
        exportInProgress = false;
        trackEvent('export_failed', {
          attempt_id: msg.data?.exportAttemptId || currentExportAttemptId,
          reason: msg.data?.source === 'backend-transcode' ? 'backend_transcode_failed' :
                  msg.data?.source === 'browser-encode' ? 'browser_encode_failed' :
                  'unknown',
          source: msg.data?.source || 'unknown',
          frameCount: msg.data?.frameCount,
          backend_error_type: msg.data?.backendErrorType || null,
          input_size_mb: msg.data?.inputSizeMB || null,
          backend_frame_count: msg.data?.backendFrameCount || null,
          backend_resolution: msg.data?.backendResolution || null,
          // Safe retry context
          first_error_source: msg.data?.firstErrorSource || null,
          safe_retry_used: msg.data?.safeRetryUsed || null
        });
        currentExportAttemptId = null;
        break;

      case 'open-checkout':
        await handleOpenCheckout(msg.data.email, msg.data.plan, {
          pricingVariant: msg.data.pricingVariant,
          priceLabel: msg.data.priceLabel,
          amountCents: msg.data.amountCents,
          source: msg.data.source,
          offerExperimentId: msg.data.offerExperimentId,
          offerExperimentVariant: msg.data.offerExperimentVariant,
          primaryOffer: msg.data.primaryOffer,
          frameCount: msg.data.frameCount
        });
        break;

      case 'resume-checkout':
        await handleResumeCheckout(msg.data?.url, msg.data?.email, msg.data?.plan);
        break;

      case 'open-billing-portal':
        await handleOpenBillingPortal();
        break;

      case 'open-community-listing':
        await handleOpenCommunityListing();
        break;

      case 'save-email':
        await handleSaveEmail(msg.data.email, msg.data.source);
        break;

      case 'track-event':
        await trackEvent(msg.data.eventType, msg.data.metadata);
        break;

      default:
        console.log('Unknown message type:', msg.type);
    }
  } catch (error) {
    if (msg.type === 'export-video') {
      await rollbackFreeExport();
      exportInProgress = false;
      currentExportCharged = false;
      currentExportCommitted = false;
      currentExportAttemptId = null;
    }
    figma.ui.postMessage({
      type: 'error',
      data: { message: error instanceof Error ? error.message : String(error) }
    });
  }
};

// Handle email save from email gate
async function handleSaveEmail(email: string, source = 'account') {
  const normalized = email.toLowerCase().trim();
  const previousEmail = (await loadEmail())?.toLowerCase().trim();
  const pendingCheckout = await loadPendingCheckout();
  const pendingCheckoutMatchesAccount = pendingCheckout?.email.toLowerCase().trim() === normalized;

  if (previousEmail && previousEmail !== normalized) {
    await clearBillingManagementCapability();
  }
  if (pendingCheckout && !pendingCheckoutMatchesAccount) {
    await clearPendingCheckout();
  }

  await saveEmail(normalized);
  if (previousEmail !== normalized) {
    trackEvent('email_captured', { source });
  }
  if (!previousEmail && source !== 'post_export_success') {
    await trackOnboardingCompletedOnce({ source: 'email_captured' });
  }

  const entitlement = await loadEntitlement(normalized);
  if (entitlement.isPaid && pendingCheckoutMatchesAccount) {
    await exchangeCheckoutSessionForManagementToken(pendingCheckout?.sessionId, normalized);
    await clearPendingCheckout();
  }

  figma.ui.postMessage({
    type: 'email-saved',
    data: {
      email: normalized,
      entitlement,
      trialExpired: false,
      daysSinceFirstExport
    }
  });
}

// Initialize plugin state
async function handleInit() {
  await loadAnonymousId();
  if (!sessionAnalyticsTracked) {
    sessionAnalyticsTracked = true;
    await trackEvent('plugin_load');
    await trackEvent('plugin_opened');
    await trackEvent('session_opened');
    await trackFirstOpenOnce();
  }
  const savedExportPreferences = await loadSavedExportPreferences();
  const savedEmail = await loadEmail();
  const pendingCheckout = await loadPendingCheckout();
  const pendingCheckoutMatchesSavedAccount = Boolean(
    savedEmail && pendingCheckout?.email.toLowerCase().trim() === savedEmail.toLowerCase().trim()
  );
  if (pendingCheckout && savedEmail && !pendingCheckoutMatchesSavedAccount) {
    await clearPendingCheckout();
  }

  // Build a catalog up front so a branching page can be presented as explicit
  // valid routes rather than an arbitrary breadth-first frame sequence.
  const graph = await buildPrototypeGraph();
  const startFrameIds = await getPrototypePathStartFrameIds(graph);
  const unlabelledCatalog = await buildPrototypePathCatalog(graph, new Map<string, string>(), startFrameIds);
  const detectedFrameIds = getCatalogFrameIds(graph, unlabelledCatalog);
  const { frames: detectedFrames, frameNames } = await collectPrototypeFrameSummaries(detectedFrameIds);
  const pathCatalog = await buildPrototypePathCatalog(graph, frameNames, startFrameIds);
  const detectedFrameCount = detectedFrames.length;
  const hasPrototype = detectedFrameCount > 0;
  const hasTransitions = Array.from(graph.transitions.values()).some(destinations => destinations.size > 0);
  const flow = analyzePrototypeFlow(detectedFrames, hasTransitions, pathCatalog);

  if (!savedEmail) {
    trackEvent('onboarding_started', {
      hasPrototype,
      frameCount: detectedFrameCount,
      pathCount: pathCatalog.paths.length
    });
  }
  if (hasPrototype) {
    trackEvent('prototype_detected', {
      frameCount: detectedFrameCount,
      pathCount: pathCatalog.paths.length,
      pathSelectionRequired: pathCatalog.pathSelectionRequired,
    });
    trackEvent('prototype_frames_detected', {
      frame_count_bucket: getFrameCountBucket(detectedFrameCount)
    });
    trackEvent('first_action_completed', {
      action: 'prototype_detected',
      frameCount: detectedFrameCount
    });
    trackEvent('export_setup_viewed', {
      frameCount: detectedFrameCount,
      pathCount: pathCatalog.paths.length,
      pathSelectionRequired: pathCatalog.pathSelectionRequired,
      freeLimit: currentEntitlement?.freeExportsLimit ?? null
    });
    trackEvent('export_settings_viewed', {
      frameCount: detectedFrameCount,
      source: 'initial_detection',
    });

    // Usage-based upsell triggers
    if (detectedFrameCount >= 10) {
      trackEvent('power_user_detected', {
        frameCount: detectedFrameCount,
        complexity: 'high'
      });
    } else if (detectedFrameCount >= 5) {
      trackEvent('moderate_user_detected', {
        frameCount: detectedFrameCount,
        complexity: 'medium'
      });
    }
  }

  let entitlement: EntitlementResponse | null = null;
  let entitlementError = false;
  try {
    entitlement = await loadEntitlement(savedEmail);
    if (entitlement?.isPaid && pendingCheckoutMatchesSavedAccount) {
      await exchangeCheckoutSessionForManagementToken(pendingCheckout?.sessionId, savedEmail || undefined);
      await clearPendingCheckout();
    }
  } catch (error) {
    entitlementError = true;
    if (isDevelopment()) {
      console.error('Entitlement check failed:', error);
    }
  }

  figma.ui.postMessage({
    type: 'init-complete',
    data: {
      hasPrototype,
      frameCount: detectedFrameCount,
      unconnectedFrameCount: hasPrototype ? 0 : getUnconnectedTopLevelFrames().length,
      paths: pathCatalog.paths,
      pathSelectionRequired: pathCatalog.pathSelectionRequired,
      defaultPathId: pathCatalog.defaultPathId,
      pathEnumerationTruncated: pathCatalog.pathEnumerationTruncated,
      flow,
      anonymousId: await loadAnonymousId(),
      savedEmail,
      savedExportPreferences,
      projectId: getOpaqueProjectId(),
      pendingCheckout: entitlement?.isPaid || (savedEmail && !pendingCheckoutMatchesSavedAccount) ? null : pendingCheckout,
      entitlement,
      entitlementError,
      trialExpired: false,
      daysSinceFirstExport
    }
  });
}

// Scan for prototype flows
async function handleScanPrototype() {
  const graph = await buildPrototypeGraph();
  const startFrameIds = await getPrototypePathStartFrameIds(graph);
  const unlabelledCatalog = await buildPrototypePathCatalog(
    graph,
    new Map<string, string>(),
    startFrameIds
  );
  const { frames, frameNames } = await collectPrototypeFrameSummaries(
    getCatalogFrameIds(graph, unlabelledCatalog)
  );
  const pathCatalog = await buildPrototypePathCatalog(graph, frameNames, startFrameIds);

  const hasTransitions = Array.from(graph.transitions.values()).some(dests => dests.size > 0);
  const flow = analyzePrototypeFlow(frames, hasTransitions, pathCatalog);
  if (frames.length > 0) {
    trackEvent('prototype_detected', {
      frameCount: frames.length,
      pathCount: pathCatalog.paths.length,
      pathSelectionRequired: pathCatalog.pathSelectionRequired,
      source: 'manual_scan'
    });
    trackEvent('prototype_frames_detected', {
      frame_count_bucket: getFrameCountBucket(frames.length),
      source: 'manual_scan'
    });
    trackEvent('export_setup_viewed', {
      frameCount: frames.length,
      pathCount: pathCatalog.paths.length,
      pathSelectionRequired: pathCatalog.pathSelectionRequired,
      source: 'manual_scan',
      freeLimit: currentEntitlement?.freeExportsLimit ?? null
    });
    trackEvent('export_settings_viewed', {
      frameCount: frames.length,
      source: 'manual_scan',
    });

    // Usage-based upsell triggers for manual scan
    if (frames.length >= 10) {
      trackEvent('power_user_detected', {
        frameCount: frames.length,
        complexity: 'high',
        source: 'manual_scan'
      });
    } else if (frames.length >= 5) {
      trackEvent('moderate_user_detected', {
        frameCount: frames.length,
        complexity: 'medium',
        source: 'manual_scan'
      });
    }
  }

  figma.ui.postMessage({
    type: 'scan-complete',
    data: {
      frames,
      flow,
      unconnectedFrameCount: frames.length > 0 ? 0 : getUnconnectedTopLevelFrames().length,
      paths: pathCatalog.paths,
      pathSelectionRequired: pathCatalog.pathSelectionRequired,
      defaultPathId: pathCatalog.defaultPathId,
      pathEnumerationTruncated: pathCatalog.pathEnumerationTruncated,
    }
  });
}

// Main export function
async function handleExportVideo(settings: ProtoVidExportSettings) {
  if (exportInProgress) {
    figma.ui.postMessage({
      type: 'error',
      data: { message: 'An export is already in progress. Please wait for it to finish.' }
    });
    return;
  }

  exportInProgress = true;
  currentExportCharged = false;
  currentExportCommitted = false;
  currentSettings = settings;
  const exportAttemptId = createExportAttemptId();
  currentExportAttemptId = exportAttemptId;
  currentExportIsFirst = !(await loadSavedExportPreferences());
  figma.ui.postMessage({
    type: 'export-context',
    data: { exportId: exportAttemptId, firstExport: currentExportIsFirst },
  });
  const finishWithoutEncoding = () => {
    exportInProgress = false;
    currentExportCharged = false;
    currentExportCommitted = false;
    currentExportAttemptId = null;
  };

  figma.ui.postMessage({
    type: 'progress',
    data: { stage: 'analyzing', percent: 5 }
  });

  // Rebuild the graph at export time. A scan may be stale if the designer has
  // edited reactions while the plugin was open, and the UI is never trusted to
  // provide an arbitrary frame order.
  const pathResolution = await resolvePrototypePathForExport(settings);
  if (!('path' in pathResolution)) {
    const { catalog, errorMessage, requiresSelection } = pathResolution;
    trackEvent('export_blocked', {
      reason: requiresSelection ? 'path_selection_required' : 'prototype_path_unavailable',
      pathCount: catalog.paths.length,
      pathEnumerationTruncated: catalog.pathEnumerationTruncated,
    });
    if (requiresSelection) {
      figma.ui.postMessage({
        type: 'path-selection-required',
        data: {
          message: errorMessage,
          paths: catalog.paths,
          pathSelectionRequired: true,
          defaultPathId: catalog.defaultPathId,
          pathEnumerationTruncated: catalog.pathEnumerationTruncated,
        }
      });
    }
    figma.ui.postMessage({ type: 'error', data: { message: errorMessage } });
    finishWithoutEncoding();
    return;
  }

  const { graph, path: selectedPath, selectionSource } = pathResolution;
  const exportSettings: ProtoVidExportSettings = {
    ...settings,
    selectedPathId: selectedPath.id,
    selectedPathFrameIds: [...selectedPath.frameIds],
    // The actual export path, not the all-graph count shown before a branch is
    // chosen, is the number that should drive progress and analytics.
    frameCount: selectedPath.frameCount,
  };
  currentSettings = exportSettings;
  trackEvent('prototype_path_selected', {
    attempt_id: exportAttemptId,
    export_id: exportAttemptId,
    pathFrameCount: selectedPath.frameCount,
    selectionSource,
    source: 'export_validation',
    preflightStatus: selectedPath.preflight.status,
  });

  const email = await loadEmail();

  // Track export attempt
  trackEvent('export_started', {
    attempt_id: exportAttemptId,
    export_id: exportAttemptId,
    project_id: getOpaqueProjectId(),
    resolution: exportSettings.resolution,
    hasLicense: !!email,
    frameCount: selectedPath.frameCount,
    pathFrameCount: selectedPath.frameCount,
    selectionSource,
    first_export: currentExportIsFirst,
    freeLimit: currentEntitlement?.freeExportsLimit ?? null,
    free_tier_experiment_id: currentEntitlement?.freeTierExperimentId ?? null,
  });
  trackEvent('export', {
    attempt_id: exportAttemptId,
    export_id: exportAttemptId,
    resolution: exportSettings.resolution,
    hasLicense: !!email,
    frameCount: selectedPath.frameCount,
    pathFrameCount: selectedPath.frameCount,
    selectionSource,
  });

  let entitlement: EntitlementResponse;
  try {
    entitlement = await loadEntitlement(email);
  } catch (error) {
    if (isDevelopment()) {
      console.error('Entitlement check failed:', error);
    }
    figma.ui.postMessage({
      type: 'entitlement-error',
      data: { message: ENTITLEMENT_VERIFICATION_ERROR }
    });
    finishWithoutEncoding();
    return;
  }

  const isPremium = entitlement.isPaid;

  if (!isPremium) {
    if (!entitlement.canExport) {
      const reason = 'free_limit';
      trackEvent('export_blocked', {
        reason,
        exportCount: entitlement.freeExportsUsed,
        freeLimit: entitlement.freeExportsLimit,
        free_tier_experiment_id: entitlement.freeTierExperimentId ?? null,
        daysSinceFirstExport
      });
      trackEvent('paywall_viewed', {
        reason: 'free_limit_hit',
        trigger: 'free_limit_reached',
        exportCount: entitlement.freeExportsUsed,
        freeLimit: entitlement.freeExportsLimit,
        free_tier_experiment_id: entitlement.freeTierExperimentId ?? null,
        daysSinceFirstExport
      });
      figma.ui.postMessage({
        type: 'free-limit-reached',
        data: {
          entitlement,
          trialExpired: false,
          daysSinceFirstExport,
          message: 'Free exports used this month. Upgrade to keep exporting videos today.'
        }
      });
      finishWithoutEncoding();
      return;
    }

    if (exportSettings.resolution !== FREE_RESOLUTION) {
      trackEvent('export_blocked', {
        reason: 'premium_resolution',
        resolution: exportSettings.resolution,
        pathFrameCount: selectedPath.frameCount,
      });
      figma.ui.postMessage({
        type: 'error',
        data: { message: 'HD/4K export requires Studio or Project Pass. Please upgrade or select 720p.' }
      });
      finishWithoutEncoding();
      return;
    }
  }

  // Capture only the validated, ordered path. The old breadth-first traversal
  // could emit sibling frames beside one another even when no prototype edge
  // connected them.
  figma.ui.postMessage({
    type: 'progress',
    data: { stage: 'capturing', percent: 20 }
  });

  let capturedFrames: PrototypeFrame[];
  try {
    capturedFrames = await capturePrototypeFrames(selectedPath.frameIds, exportSettings, graph);
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : 'Unable to capture the selected prototype path. Please try again.';
    trackEvent('export_failed', {
      attempt_id: currentExportAttemptId,
      reason: 'frame_capture_failed',
      pathFrameCount: selectedPath.frameCount,
    });
    figma.ui.postMessage({ type: 'error', data: { message } });
    finishWithoutEncoding();
    return;
  }

  if (capturedFrames.length === 0) {
    figma.ui.postMessage({
      type: 'error',
      data: { message: 'No frames could be captured. Check that your prototype frames have visible content.' }
    });
    finishWithoutEncoding();
    return;
  }

  if (!isPremium && !currentExportCharged) {
    await reserveFreeExport(email);
  }

  // Send captured frames to UI for client-side video encoding
  figma.ui.postMessage({
    type: 'encode-frames',
      data: {
        frames: capturedFrames,
        settings: exportSettings,
        isPremium,
        selectedPath,
        exportAttemptId,
        anonymousId: await loadAnonymousId(),
      }
  });
}

// Validate license (email-based — checks Stripe subscription)
async function handleValidateLicense(licenseKey: string) {
  const isValid = await validateLicense(licenseKey);
  trackEvent('license_validate', { isValid });
  const entitlement = isValid
    ? await loadEntitlement(licenseKey.toLowerCase().trim()).catch(() => currentEntitlement)
    : currentEntitlement;

  if (entitlement?.isPaid || isValid) {
    const savedEmail = await loadEmail();
    const pendingCheckout = await loadPendingCheckout();
    const pendingCheckoutMatchesSavedAccount = Boolean(
      savedEmail && pendingCheckout?.email.toLowerCase().trim() === savedEmail.toLowerCase().trim()
    );
    if (pendingCheckout && !pendingCheckoutMatchesSavedAccount) {
      await clearPendingCheckout();
    } else if (pendingCheckoutMatchesSavedAccount) {
      await exchangeCheckoutSessionForManagementToken(pendingCheckout?.sessionId, savedEmail || undefined);
      await clearPendingCheckout();
    }
  }

  figma.ui.postMessage({
    type: 'license-validated',
    data: { isValid, licenseKey, entitlement }
  });
}

async function handleOpenCheckout(email: string, plan?: string, pricingMetadata: Record<string, unknown> = {}) {
  if (checkoutInProgress) return;
  checkoutInProgress = true;
  try {
    const selectedPlan = plan === 'large_export' ? 'large_export' : 'monthly';
    const normalizedEmail = email.toLowerCase().trim();
    const previousEmail = (await loadEmail())?.toLowerCase().trim();
    if (previousEmail && previousEmail !== normalizedEmail) {
      await clearBillingManagementCapability();
      await clearPendingCheckout();
    }
    trackEvent('checkout_start', { plan: selectedPlan, ...pricingMetadata });
    trackEvent('checkout_started', { plan: selectedPlan, ...pricingMetadata });

    await saveEmail(normalizedEmail);
    if (previousEmail !== normalizedEmail) {
      trackEvent('email_captured', { source: 'checkout' });
      if (!previousEmail) await trackOnboardingCompletedOnce({ source: 'checkout' });
    }

    const anonymousIdForCheckout = await loadAnonymousId();
    const response = await fetch(`${BACKEND_URL}/api/billing/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: normalizedEmail,
        plan: selectedPlan,
        anonymousId: anonymousIdForCheckout,
        offerExperimentId: pricingMetadata.offerExperimentId,
        offerExperimentVariant: pricingMetadata.offerExperimentVariant,
        primaryOffer: pricingMetadata.primaryOffer,
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.url) {
        const sessionId = typeof data.sessionId === 'string' ? data.sessionId : undefined;
        await savePendingCheckout({
          email: normalizedEmail,
          url: data.url,
          plan: selectedPlan,
          sessionId,
          createdAt: new Date().toISOString(),
          checkoutConfigVersion: CHECKOUT_SESSION_CONFIG_VERSION,
        });
        const checkoutMetadata = {
          plan: selectedPlan,
          pricingVariant: data.pricingVariant || pricingMetadata.pricingVariant,
          priceLabel: data.priceLabel || pricingMetadata.priceLabel,
          amountCents: data.amountCents || pricingMetadata.amountCents,
          stripe_checkout_session_id: sessionId || null,
          offerType: data.offerType || null,
          source: pricingMetadata.source || null,
          offer_experiment_id: pricingMetadata.offerExperimentId || null,
          offer_experiment_variant: pricingMetadata.offerExperimentVariant || null,
          primary_offer: pricingMetadata.primaryOffer || null,
          frameCount: pricingMetadata.frameCount || null
        };
        trackEvent('checkout_open_attempted', checkoutMetadata);
        try {
          figma.openExternal(data.url);
          trackEvent('checkout_opened', checkoutMetadata);
        } catch (error) {
          trackEvent('checkout_open_failed', {
            ...checkoutMetadata,
            reason: error instanceof Error ? error.message.slice(0, 120) : 'open_external_failed',
          });
          throw error;
        }
        figma.notify('Opening checkout... We\'ll detect your payment automatically.');
        figma.ui.postMessage({
          type: 'checkout-opened',
          data: {
            email: normalizedEmail,
            url: data.url,
            plan: selectedPlan,
            sessionId,
          }
        });
      } else {
        trackEvent('checkout_error', {
          plan: selectedPlan,
          reason: 'missing_url'
        });
        figma.notify('Failed to create checkout session. Please try again.');
        figma.ui.postMessage({
          type: 'error',
          data: { message: 'Checkout could not be opened. Please try again.' }
        });
      }
    } else {
      const error = await response.json();
      if (response.status === 409 && error.code === 'active_entitlement') {
        const entitlement = await loadEntitlement(email.toLowerCase().trim()).catch(() => currentEntitlement);
        if (entitlement?.isPaid) {
          await clearPendingCheckout();
          figma.ui.postMessage({
            type: 'license-validated',
            data: { isValid: true, licenseKey: email, entitlement }
          });
          figma.notify('Your existing Studio access has been restored.');
          return;
        }
      }
      trackEvent('checkout_error', {
        plan: selectedPlan,
        status: response.status,
        reason: response.status === 409 ? 'active_entitlement' : 'checkout_request_failed'
      });
      figma.notify(error.error || 'Failed to open checkout. Please try again.');
      figma.ui.postMessage({
        type: 'error',
        data: { message: error.error || 'Failed to open checkout. Please try again.' }
      });
    }
  } catch (error) {
    console.error('Checkout error:', error);
    trackEvent('checkout_error', {
      plan: plan || 'monthly',
      reason: 'network_error'
    });
    figma.notify('Network error. Please check your connection and try again.');
    figma.ui.postMessage({
      type: 'error',
      data: { message: 'Network error. Please check your connection and try again.' }
    });
  } finally {
    checkoutInProgress = false;
  }
}

async function handleResumeCheckout(url?: string, email?: string, plan?: string) {
  const pending = await loadPendingCheckout();
  const checkoutUrl = url || pending?.url;
  if (!checkoutUrl) {
    figma.notify('No checkout session found. Start checkout again.');
    return;
  }

  trackEvent('checkout_recovered', {
    plan: plan || pending?.plan || 'monthly',
    email: email || pending?.email || null,
    stripe_checkout_session_id: pending?.sessionId || null,
  });
  figma.openExternal(checkoutUrl);
  trackEvent('checkout_opened', {
    plan: plan || pending?.plan || 'monthly',
    source: 'resume_checkout',
    stripe_checkout_session_id: pending?.sessionId || null,
  });
  figma.notify('Reopening checkout. ProtoVid will keep checking payment status.');
}

async function handleOpenBillingPortal() {
  try {
    const email = await loadEmail();
    const capability = await loadBillingManagementCapability();
    if (email && capability?.email.toLowerCase().trim() === email.toLowerCase().trim()) {
      const response = await fetch(`${BACKEND_URL}/api/billing/portal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ managementToken: capability.token })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.url) {
          figma.openExternal(data.url);
          return;
        }
      } else if (response.status === 403) {
        await clearBillingManagementCapability();
      }
    } else if (capability) {
      await clearBillingManagementCapability();
    }

    // Stripe's hosted login page verifies mailbox ownership and works for
    // purchases made on any device without support or manual provisioning.
    figma.openExternal(`${BACKEND_URL}/account`);
    figma.notify('Opening secure Stripe billing management.');
  } catch (error) {
    console.error('Portal error:', error);
    figma.notify('Network error. Please try again.');
  }
}

async function handleOpenCommunityListing() {
  trackEvent('review_prompt_clicked');
  trackEvent('viral_growth_action', {
    action: 'community_listing_opened',
    source: 'review_prompt'
  });
  figma.openExternal('https://www.figma.com/community/plugin/1606994616321079154');
}

async function validateLicense(licenseKey?: string): Promise<boolean> {
  if (!licenseKey) return false;

  try {
    const response = await fetch(`${BACKEND_URL}/api/validate-license`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey })
    });
    if (response.ok) {
      const data = await response.json();
      return data.valid === true && data.tier === 'pro';
    }
    return false;
  } catch (error) {
    console.error('License validation error:', error);
    return false;
  }
}

// Handle encoding completion from UI
async function handleEncodingComplete(
  isPremium: boolean,
  usedSafeRetry: boolean = false,
  output: {
    exportAttemptId?: string;
    exportId?: string;
    outputWidth?: number;
    outputHeight?: number;
    deliveryProfile?: 'requested' | 'fallback';
    frameCount?: number;
    payloadBytes?: number | null;
    uploadDurationMs?: number | null;
    transcodeDurationMs?: number | null;
    exportDurationMs?: number | null;
  } = {}
) {
  try {
    if (!isPremium) {
      const email = await loadEmail();
      if (!currentExportCharged) {
        await reserveFreeExport(email);
      }
      await commitFreeExport(email);
    }
  } catch (error) {
    if (isDevelopment()) {
      console.error('Export allowance update failed:', error);
    }
    figma.ui.postMessage({
      type: 'entitlement-error',
      data: { message: ENTITLEMENT_VERIFICATION_ERROR }
    });
  } finally {
    exportInProgress = false;
  }
  const exportId = output.exportId || output.exportAttemptId || currentExportAttemptId;
  const exportMetadata = {
    export_id: exportId,
    attempt_id: exportId,
    project_id: getOpaqueProjectId(),
    resolution: currentSettings.resolution,
    isPremium,
    frameCount: output.frameCount ?? currentSettings.frameCount ?? null,
    usedSafeRetry,
    output_width: output.outputWidth ?? null,
    output_height: output.outputHeight ?? null,
    delivery_profile: output.deliveryProfile ?? null,
    payload_bytes: output.payloadBytes ?? null,
    upload_duration_ms: output.uploadDurationMs ?? null,
    transcode_duration_ms: output.transcodeDurationMs ?? null,
    export_duration_ms: output.exportDurationMs ?? null,
    first_export: currentExportIsFirst,
  };
  await trackFirstValueOnce(exportMetadata);
  await trackOnboardingCompletedOnce({
    source: 'first_export',
    frameCount: exportMetadata.frameCount,
    resolution: exportMetadata.resolution,
  });
  trackEvent('export_ready', exportMetadata);
  trackEvent('export_completed', exportMetadata);
  // Retain these legacy event names for existing dashboards while the canonical
  // `export_completed` event remains the source of truth going forward.
  trackEvent('export_success', exportMetadata);
  trackEvent('export_succeeded', exportMetadata);
  if (!isPremium && (currentEntitlement?.freeExportsUsed ?? 0) >= 1) {
    trackEvent('review_prompt_shown', {
      trigger: 'success_or_later',
      ...exportMetadata,
    });
  }

  // Post-export engagement and upsell triggers
  if (!isPremium) {
    trackEvent('export_success_upsell_opportunity', {
      ...exportMetadata,
      resolution: currentSettings.resolution,
      frameCount: exportMetadata.frameCount ?? 0,
      trigger: 'post_export'
    });

    // Contextual upgrade messaging based on usage
    const frameCount = exportMetadata.frameCount ?? 0;
    if (frameCount >= 10) {
      trackEvent('power_user_post_export', {
        frameCount,
        message: 'complex_prototype_hd_upsell'
      });
    } else if (frameCount >= 5) {
      trackEvent('moderate_user_post_export', {
        frameCount,
        message: 'multi_frame_quality_upsell'
      });
    }
  }
  if (typeof exportId === 'string' && exportId.length > 0) {
    await saveExportPreferences(exportId);
  }
  figma.ui.postMessage({
    type: 'export-count-updated',
    data: { entitlement: currentEntitlement }
  });
  currentExportAttemptId = null;
}

// Helper: Check if a node type can be exported as a prototype frame
function isExportableFrame(node: BaseNode): boolean {
  return node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'COMPONENT_SET';
}

// Helper: Extract navigation targets (destination + transition) from a reaction
function extractNavigations(reaction: any): Array<{ destinationId: string; transition: any }> {
  const navs: Array<{ destinationId: string; transition: any }> = [];
  const collect = (action: any) => {
    if (action && action.type === 'NODE' && action.destinationId) {
      navs.push({ destinationId: action.destinationId, transition: action.transition || null });
    }
  };
  if (Array.isArray(reaction.actions)) {
    for (const action of reaction.actions) collect(action);
  }
  collect(reaction.action);
  return navs;
}

// Helper: Extract destination node IDs from a reaction
function extractDestinationIds(reaction: any): string[] {
  return extractNavigations(reaction).map(nav => nav.destinationId);
}

// Helper: Normalize a Figma transition into the minimal, serializable shape the
// encoder needs. Returns null when no usable transition is present.
function normalizeTransition(transition: any): TransitionMeta | null {
  if (!transition || typeof transition.type !== 'string') return null;
  return {
    type: transition.type,
    direction: typeof transition.direction === 'string' ? transition.direction : undefined,
    duration: typeof transition.duration === 'number' ? transition.duration : 0.3,
    easing: transition.easing && typeof transition.easing.type === 'string'
      ? transition.easing.type
      : 'EASE_OUT',
  };
}

function getNodeBounds(node: SceneNode): LayerBounds | null {
  const bbox = (node as any).absoluteBoundingBox;
  if (bbox && typeof bbox.x === 'number' && typeof bbox.y === 'number' &&
      typeof bbox.width === 'number' && typeof bbox.height === 'number' &&
      bbox.width > 0 && bbox.height > 0) {
    return { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height };
  }

  if (typeof (node as any).x === 'number' && typeof (node as any).y === 'number' &&
      typeof (node as any).width === 'number' && typeof (node as any).height === 'number' &&
      (node as any).width > 0 && (node as any).height > 0) {
    return {
      x: (node as any).x,
      y: (node as any).y,
      width: (node as any).width,
      height: (node as any).height,
    };
  }

  return null;
}
function snapshotSmartAnimateLayers(
  node: SceneNode,
  ancestry: Array<{ type: string; name: string; index: number }> = [],
  siblingIndex = 0,
  out: LayerSnapshot[] = []
): LayerSnapshot[] {
  if (!('visible' in node) || !node.visible) return out;

  const normalizedName = normalizeLayerName(node.name || node.type);
  const segment = { type: node.type, name: normalizedName, index: siblingIndex };
  const path = [...ancestry, segment];

  const children = 'children' in node ? ((node as any).children as SceneNode[]) : [];
  if (children && children.length > 0) {
    const siblingCounts = new Map<string, number>();
    for (const child of children) {
      const childName = normalizeLayerName(child.name || child.type);
      const childType = child.type;
      const siblingKey = `${childType}:${childName}`;
      const siblingIndex = siblingCounts.get(siblingKey) || 0;
      siblingCounts.set(siblingKey, siblingIndex + 1);
      snapshotSmartAnimateLayers(child, path, siblingIndex, out);
    }
    return out;
  }

  const bounds = getNodeBounds(node);
  if (!bounds) return out;

  const keys = buildLayerKeys(path);
  out.push({
    id: node.id,
    name: node.name,
    type: node.type,
    keyExact: keys.exact,
    keyLoose: keys.loose,
    keyLeaf: keys.leaf,
    keyParentExact: keys.parentExact,
    keyParentLoose: keys.parentLoose,
    depth: keys.depth,
    bounds,
    opacity: typeof (node as any).opacity === 'number' ? (node as any).opacity : 1,
    rotation: typeof (node as any).rotation === 'number' ? (node as any).rotation : 0,
    visible: true,
  });

  return out;
}

async function exportNodeImage(nodeId: string, scale: number): Promise<Uint8Array | null> {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node || !('exportAsync' in node)) return null;

  try {
    return await (node as any).exportAsync({
      format: 'PNG' as const,
      constraint: { type: 'SCALE' as const, value: scale }
    });
  } catch (_e) {
    return null;
  }
}

async function buildSmartAnimateMotion(
  sourceFrame: PrototypeFrame,
  destinationFrame: PrototypeFrame
): Promise<SmartAnimateLayerMotion[]> {
  const source = matchSmartAnimateLayers(sourceFrame.layers, destinationFrame.layers);
  const motions: SmartAnimateLayerMotion[] = [];

  for (const pair of source.matched) {
    const [sourceImageData, destinationImageData] = await Promise.all([
      exportNodeImage(pair.source.id, sourceFrame.exportScale),
      exportNodeImage(pair.destination.id, destinationFrame.exportScale),
    ]);

    if (!sourceImageData || !destinationImageData) continue;

    motions.push({
      key: pair.source.keyLeaf || pair.source.keyExact,
      source: {
        id: pair.source.id,
        bounds: scaleBounds(pair.source.bounds, sourceFrame.exportScale),
        opacity: pair.source.opacity,
        rotation: pair.source.rotation,
        imageData: sourceImageData,
      },
      destination: {
        id: pair.destination.id,
        bounds: scaleBounds(pair.destination.bounds, destinationFrame.exportScale),
        opacity: pair.destination.opacity,
        rotation: pair.destination.rotation,
        imageData: destinationImageData,
      },
    });
  }

  for (const snapshot of source.sourceOnly) {
    const sourceImageData = await exportNodeImage(snapshot.id, sourceFrame.exportScale);
    if (!sourceImageData) continue;
    motions.push({
      key: snapshot.keyLeaf || snapshot.keyExact,
      source: {
        id: snapshot.id,
        bounds: scaleBounds(snapshot.bounds, sourceFrame.exportScale),
        opacity: snapshot.opacity,
        rotation: snapshot.rotation,
        imageData: sourceImageData,
      },
      destination: {
        id: '',
        bounds: scaleBounds(snapshot.bounds, sourceFrame.exportScale),
        opacity: 0,
        rotation: snapshot.rotation,
      },
    });
  }

  for (const snapshot of source.destinationOnly) {
    const destinationImageData = await exportNodeImage(snapshot.id, destinationFrame.exportScale);
    if (!destinationImageData) continue;
    motions.push({
      key: snapshot.keyLeaf || snapshot.keyExact,
      source: {
        id: '',
        bounds: scaleBounds(snapshot.bounds, destinationFrame.exportScale),
        opacity: 0,
        rotation: snapshot.rotation,
      },
      destination: {
        id: snapshot.id,
        bounds: scaleBounds(snapshot.bounds, destinationFrame.exportScale),
        opacity: snapshot.opacity,
        rotation: snapshot.rotation,
        imageData: destinationImageData,
      },
    });
  }

  return motions;
}

async function enrichSmartAnimateTransitions(frames: PrototypeFrame[]) {
  for (let i = 1; i < frames.length; i++) {
    const transition = frames[i].transitionIn;
    if (!transition || transition.type !== 'SMART_ANIMATE') continue;

    const motions = await buildSmartAnimateMotion(frames[i - 1], frames[i]);
    if (motions.length > 0) {
      transition.smartAnimateLayers = motions;
    }
  }
}

interface EnumeratedPrototypePath {
  frameIds: string[];
  truncated: boolean;
  truncationReason: PrototypePathTruncationReason | null;
}

interface PrototypePathEnumeration {
  paths: EnumeratedPrototypePath[];
  pathEnumerationTruncated: boolean;
}

interface PrototypePathResolutionFailure {
  errorMessage: string;
  catalog: PrototypePathCatalog;
  requiresSelection: boolean;
}

function uniqueFrameIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }
  return unique;
}

function frameSequencesMatch(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

// The full escaped sequence is deliberate: it is stable across scans, has no
// collision risk, and lets a stale UI selection be detected without trusting
// client-provided frame order.
function createPrototypePathId(frameIds: string[]): string {
  return `path:${frameIds.map(id => encodeURIComponent(id)).join('>')}`;
}

function getPrototypePathPreflight(frameCount: number): PrototypePathPreflight {
  const estimatedDuration = frameCount * 2;
  if (frameCount >= RECOMMENDED_MAX_PATH_FRAMES) {
    return {
      frameCount,
      estimatedDuration,
      maxRecommendedFrames: RECOMMENDED_MAX_PATH_FRAMES,
      recommendedQuality: '720p',
      status: 'split_recommended',
      message: `This path has ${frameCount} frames. For a more reliable export, split it into shorter paths or use 720p.`,
    };
  }

  if (frameCount >= LONG_PATH_FRAME_THRESHOLD) {
    return {
      frameCount,
      estimatedDuration,
      maxRecommendedFrames: RECOMMENDED_MAX_PATH_FRAMES,
      recommendedQuality: '720p',
      status: 'long_path',
      message: `This path has ${frameCount} frames. 720p is recommended for the most reliable delivery.`,
    };
  }

  return {
    frameCount,
    estimatedDuration,
    maxRecommendedFrames: RECOMMENDED_MAX_PATH_FRAMES,
    recommendedQuality: 'selected',
    status: 'ready',
    message: null,
  };
}

function getPrototypePathLabel(
  startNodeName: string | null,
  endNodeName: string | null,
  frameCount: number,
  index: number
): string {
  const start = startNodeName || 'Start';
  const end = endNodeName || 'End';
  return `Path ${index + 1}: ${start} → ${end} · ${frameCount} ${frameCount === 1 ? 'frame' : 'frames'}`;
}

function enumeratePrototypePaths(
  graph: PrototypeGraph,
  startFrameIds: string[]
): PrototypePathEnumeration {
  const paths: EnumeratedPrototypePath[] = [];
  let pathLimitReached = false;

  const addPath = (path: EnumeratedPrototypePath): boolean => {
    if (paths.length >= MAX_ENUMERATED_PROTOTYPE_PATHS) {
      pathLimitReached = true;
      return false;
    }
    paths.push(path);
    return true;
  };

  const visit = (frameId: string, frameIds: string[], ancestors: Set<string>) => {
    if (paths.length >= MAX_ENUMERATED_PROTOTYPE_PATHS) {
      pathLimitReached = true;
      return;
    }

    const destinations = Array.from(graph.edges.get(frameId) || []);
    if (destinations.length === 0) {
      addPath({ frameIds, truncated: false, truncationReason: null });
      return;
    }

    for (const destinationId of destinations) {
      if (ancestors.has(destinationId)) {
        // Include the closing edge exactly once. That keeps the emitted
        // sequence valid (A → B → A), while never walking a prototype loop
        // indefinitely.
        addPath({
          frameIds: [...frameIds, destinationId],
          truncated: true,
          truncationReason: 'cycle',
        });
        continue;
      }

      const nextAncestors = new Set(ancestors);
      nextAncestors.add(destinationId);
      visit(destinationId, [...frameIds, destinationId], nextAncestors);
    }
  };

  for (const startFrameId of uniqueFrameIds(startFrameIds)) {
    if (paths.length >= MAX_ENUMERATED_PROTOTYPE_PATHS) {
      pathLimitReached = true;
      break;
    }
    visit(startFrameId, [startFrameId], new Set([startFrameId]));
  }

  return {
    paths,
    // A cycle is represented by a finite, valid path and does not mean the
    // catalog is incomplete. Only the branching-path safeguard does.
    pathEnumerationTruncated: pathLimitReached,
  };
}

function getRootPrototypeFrameIds(graph: PrototypeGraph): string[] {
  const incoming = new Set<string>();
  for (const destinations of graph.edges.values()) {
    for (const destinationId of destinations) incoming.add(destinationId);
  }
  return Array.from(graph.allFrameIds).filter(frameId => !incoming.has(frameId));
}

async function getConfiguredPrototypeStartFrameIds(): Promise<string[]> {
  const starts: string[] = [];
  const flowStartingPoints = figma.currentPage.flowStartingPoints || [];
  for (const flow of flowStartingPoints) {
    const node = await figma.getNodeByIdAsync(flow.nodeId);
    if (node && isExportableFrame(node)) starts.push(node.id);
  }
  return uniqueFrameIds(starts);
}

async function getPrototypePathStartFrameIds(graph: PrototypeGraph): Promise<string[]> {
  const configuredStarts = await getConfiguredPrototypeStartFrameIds();
  const rootStarts = getRootPrototypeFrameIds(graph);
  const candidates = uniqueFrameIds([...configuredStarts, ...rootStarts]);
  if (candidates.length > 0) return candidates;

  // A graph made entirely of back-links has no root. Any connected frame is a
  // valid finite starting point; the cycle guard above keeps its preview safe.
  return uniqueFrameIds([...graph.edges.keys(), ...graph.allFrameIds]);
}

function createPrototypePathDescriptor(
  enumeratedPath: EnumeratedPrototypePath,
  index: number,
  frameNames: Map<string, string>
): PrototypePathDescriptor {
  const { frameIds } = enumeratedPath;
  const startNodeId = frameIds[0];
  const endNodeId = frameIds[frameIds.length - 1];
  const startNodeName = frameNames.get(startNodeId) || null;
  const endNodeName = frameNames.get(endNodeId) || null;
  const frameCount = frameIds.length;
  return {
    id: createPrototypePathId(frameIds),
    frameIds: [...frameIds],
    frameCount,
    startNodeId,
    endNodeId,
    startNodeName,
    endNodeName,
    label: getPrototypePathLabel(startNodeName, endNodeName, frameCount, index),
    estimatedDuration: frameCount * 2,
    preflight: getPrototypePathPreflight(frameCount),
    truncated: enumeratedPath.truncated,
    truncationReason: enumeratedPath.truncationReason,
  };
}

async function buildPrototypePathCatalog(
  graph: PrototypeGraph,
  frameNames: Map<string, string> = new Map<string, string>(),
  startFrameIds?: string[]
): Promise<PrototypePathCatalog> {
  const starts = startFrameIds ?? await getPrototypePathStartFrameIds(graph);
  const enumeration = enumeratePrototypePaths(graph, starts);
  const paths = enumeration.paths.map((path, index) =>
    createPrototypePathDescriptor(path, index, frameNames)
  );

  return {
    paths,
    pathSelectionRequired: paths.length > 1,
    // Even when enumeration reaches the safety cap, every emitted candidate
    // has already been validated as a connected route. Pick the shortest
    // reliable candidate so large branching prototypes can reach first value
    // without forcing a manual route decision. Keep the truncation flag so the
    // UI can explain that alternatives may not all be listed.
    defaultPathId: getRecommendedPathId(paths.map(path => ({
      id: path.id,
      frameCount: path.frameCount,
      preflightStatus: path.preflight.status,
      truncated: path.truncated,
    }))),
    pathEnumerationTruncated: enumeration.pathEnumerationTruncated,
  };
}

function getCatalogFrameIds(graph: PrototypeGraph, catalog: PrototypePathCatalog): string[] {
  const frameIds = new Set<string>(graph.allFrameIds);
  for (const path of catalog.paths) {
    for (const frameId of path.frameIds) frameIds.add(frameId);
  }
  return Array.from(frameIds);
}

async function collectPrototypeFrameSummaries(frameIds: string[]): Promise<{
  frames: Array<{ id: string; name: string; width: number; height: number }>;
  frameNames: Map<string, string>;
}> {
  const frames: Array<{ id: string; name: string; width: number; height: number }> = [];
  const frameNames = new Map<string, string>();
  for (const id of uniqueFrameIds(frameIds)) {
    const node = await figma.getNodeByIdAsync(id);
    if (!node || !isExportableFrame(node)) continue;
    const frame = node as FrameNode;
    frames.push({
      id: frame.id,
      name: frame.name,
      width: frame.width,
      height: frame.height,
    });
    frameNames.set(frame.id, frame.name);
  }
  return { frames, frameNames };
}

function hasValidAdjacentPrototypeFrames(frameIds: string[], graph: PrototypeGraph): boolean {
  if (frameIds.length === 0) return false;
  for (let index = 1; index < frameIds.length; index++) {
    if (!graph.edges.get(frameIds[index - 1])?.has(frameIds[index])) return false;
  }
  return true;
}

function getSelectedPathFrameIds(settings: ProtoVidExportSettings): string[] | null | undefined {
  if (settings.selectedPathFrameIds === undefined) return undefined;
  if (!Array.isArray(settings.selectedPathFrameIds) || settings.selectedPathFrameIds.length === 0) {
    return null;
  }
  const frameIds = settings.selectedPathFrameIds;
  return frameIds.every(frameId => typeof frameId === 'string' && frameId.length > 0)
    ? [...frameIds]
    : null;
}

async function resolvePrototypePathForExport(
  settings: ProtoVidExportSettings
): Promise<ResolvedPrototypePath | PrototypePathResolutionFailure> {
  const graph = await buildPrototypeGraph();
  const catalog = await buildPrototypePathCatalog(graph);
  if (catalog.paths.length === 0) {
    return {
      errorMessage: 'No connected prototype path found. Set up prototype connections, then scan again.',
      catalog,
      requiresSelection: false,
    };
  }

  const selectedPathId = typeof settings.selectedPathId === 'string'
    ? settings.selectedPathId.trim()
    : '';
  if (settings.selectedPathId !== undefined && !selectedPathId) {
    return {
      errorMessage: 'The selected prototype path is invalid. Scan again and choose a path.',
      catalog,
      requiresSelection: true,
    };
  }

  const selectedFrameIds = getSelectedPathFrameIds(settings);
  if (selectedFrameIds === null) {
    return {
      errorMessage: 'The selected prototype path is invalid. Scan again and choose a path.',
      catalog,
      requiresSelection: true,
    };
  }

  if (selectedPathId) {
    const path = catalog.paths.find(candidate => candidate.id === selectedPathId);
    if (!path || !hasValidAdjacentPrototypeFrames(path.frameIds, graph)) {
      return {
        errorMessage: 'This prototype path changed since it was scanned. Scan again and choose a current path.',
        catalog,
        requiresSelection: true,
      };
    }
    if (selectedFrameIds && !frameSequencesMatch(path.frameIds, selectedFrameIds)) {
      return {
        errorMessage: 'The selected prototype path no longer matches its frame order. Scan again and choose a path.',
        catalog,
        requiresSelection: true,
      };
    }
    return { graph, catalog, path, selectionSource: 'selected_path_id' };
  }

  if (selectedFrameIds) {
    const path = catalog.paths.find(candidate => frameSequencesMatch(candidate.frameIds, selectedFrameIds));
    if (!path || !hasValidAdjacentPrototypeFrames(path.frameIds, graph)) {
      return {
        errorMessage: 'The selected frame order is no longer a connected prototype path. Scan again and choose a path.',
        catalog,
        requiresSelection: true,
      };
    }
    return { graph, catalog, path, selectionSource: 'selected_frame_ids' };
  }

  if (!catalog.defaultPathId) {
    return {
      errorMessage: catalog.pathEnumerationTruncated
        ? 'This prototype has many possible paths. Scan again and choose the exact path to export.'
        : 'This prototype branches into multiple paths. Scan again and choose the path to export.',
      catalog,
      requiresSelection: true,
    };
  }

  const path = catalog.paths.find(candidate => candidate.id === catalog.defaultPathId);
  if (!path) {
    return {
      errorMessage: 'No recommended prototype path is available. Scan again and choose a path.',
      catalog,
      requiresSelection: true,
    };
  }
  if (!hasValidAdjacentPrototypeFrames(path.frameIds, graph)) {
    return {
      errorMessage: 'The detected prototype path is no longer connected. Scan again and choose a path.',
      catalog,
      requiresSelection: true,
    };
  }
  return {
    graph,
    catalog,
    path,
    selectionSource: catalog.pathSelectionRequired ? 'automatic_recommended_path' : 'automatic_single_path',
  };
}

// Build prototype graph
async function buildPrototypeGraph(): Promise<PrototypeGraph> {
  const edges = new Map<string, Set<string>>();
  const allFrameIds = new Set<string>();
  // sourceFrameId -> destFrameId -> transition
  const transitions = new Map<string, Map<string, TransitionMeta>>();

  async function walkNode(node: SceneNode, sourceFrameId: string) {
    if ('reactions' in node && node.reactions && node.reactions.length > 0) {
      for (const reaction of node.reactions) {
        for (const nav of extractNavigations(reaction)) {
          const destNode = await figma.getNodeByIdAsync(nav.destinationId);
          if (destNode && isExportableFrame(destNode)) {
            if (!edges.has(sourceFrameId)) edges.set(sourceFrameId, new Set());
            edges.get(sourceFrameId)!.add(nav.destinationId);
            allFrameIds.add(nav.destinationId);

            const meta = normalizeTransition(nav.transition);
            if (meta) {
              if (!transitions.has(sourceFrameId)) transitions.set(sourceFrameId, new Map());
              transitions.get(sourceFrameId)!.set(nav.destinationId, meta);
            }
          }
        }
      }
    }
    if ('children' in node) {
      for (const child of (node as any).children) {
        await walkNode(child, sourceFrameId);
      }
    }
  }

  for (const topNode of figma.currentPage.children) {
    if (isExportableFrame(topNode)) {
      await walkNode(topNode as SceneNode, topNode.id);
    }
  }

  for (const sourceId of edges.keys()) {
    allFrameIds.add(sourceId);
  }

  return { edges, allFrameIds, transitions };
}

// Capture exactly one validated path. If one frame cannot be exported, abort
// rather than skipping it: skipping would make the frames on either side look
// adjacent even though no prototype interaction connects them.
async function capturePrototypeFrames(
  frameIds: string[],
  settings: ProtoVidExportSettings,
  graph: PrototypeGraph
): Promise<PrototypeFrame[]> {
  if (!hasValidAdjacentPrototypeFrames(frameIds, graph)) {
    throw new Error('The selected frame order is not a connected prototype path. Scan again and choose a path.');
  }

  const frames: PrototypeFrame[] = [];

  const resolutionMap = {
    '720p': { width: 1280, height: 720 },
    '1080p': { width: 1920, height: 1080 },
    '4K': { width: 3840, height: 2160 }
  };
  const targetRes = resolutionMap[settings.resolution];
  const totalFrames = Math.max(frameIds.length, 1);

  for (let index = 0; index < frameIds.length; index++) {
    const frameId = frameIds[index];
    const node = await figma.getNodeByIdAsync(frameId);
    if (!node || !isExportableFrame(node)) {
      throw new Error('One of the selected frames no longer exists. Scan again and choose a current path.');
    }
    const frame = node as FrameNode;

    try {
      const scale = Math.min(calculateScale(frame, targetRes), 4);
      const imageData = await frame.exportAsync({
        format: 'PNG' as const,
        constraint: { type: 'SCALE' as const, value: scale }
      });
      const layers = snapshotSmartAnimateLayers(frame);

      const previousFrameId = index > 0 ? frameIds[index - 1] : null;
      if (previousFrameId && !graph.edges.get(previousFrameId)?.has(frame.id)) {
        throw new Error('The selected frame order is no longer connected. Scan again and choose a path.');
      }
      const transitionIn = previousFrameId
        ? (graph.transitions.get(previousFrameId)?.get(frame.id) ?? null)
        : null;

      frames.push({
        nodeId: frame.id,
        nodeName: frame.name,
        imageData,
        width: Math.round(frame.width * scale),
        height: Math.round(frame.height * scale),
        exportScale: scale,
        layers,
        transitionIn
      });

      figma.ui.postMessage({
        type: 'progress',
        data: {
          stage: 'capturing',
          percent: Math.min(60, 20 + (frames.length * 40 / totalFrames))
        }
      });
    } catch (error) {
      console.error('Failed to export frame ' + frame.name + ':', error);
      const detail = error instanceof Error && error.message
        ? ` ${error.message}`
        : '';
      throw new Error(`Could not capture "${frame.name}" from the selected path.${detail}`);
    }
  }

  figma.ui.postMessage({
    type: 'progress',
    data: { stage: 'rendering', percent: 25 }
  });
  await enrichSmartAnimateTransitions(frames);
  figma.ui.postMessage({
    type: 'progress',
    data: { stage: 'rendering', percent: 55 }
  });
  return frames;
}

function calculateScale(frame: FrameNode, targetRes: { width: number; height: number }): number {
  const scaleX = targetRes.width / frame.width;
  const scaleY = targetRes.height / frame.height;
  return Math.min(scaleX, scaleY);
}

function analyzePrototypeFlow(
  frames: Array<{ id: string; width?: number; height?: number }>,
  hasTransitions: boolean,
  pathCatalog: PrototypePathCatalog
) {
  const maxPathFrameCount = pathCatalog.paths.reduce(
    (max, path) => Math.max(max, path.frameCount),
    0
  );
  const dimensionSignatures = new Set(
    frames
      .filter(frame => typeof frame.width === 'number' && typeof frame.height === 'number')
      .map(frame => `${Math.round(frame.width!)}x${Math.round(frame.height!)}`)
  );
  return {
    totalFrames: frames.length,
    estimatedDuration: frames.length * 2,
    hasTransitions,
    pathCount: pathCatalog.paths.length,
    pathSelectionRequired: pathCatalog.pathSelectionRequired,
    defaultPathId: pathCatalog.defaultPathId,
    maxPathFrameCount,
    pathEnumerationTruncated: pathCatalog.pathEnumerationTruncated,
    mixedDimensions: dimensionSignatures.size > 1,
  };
}
