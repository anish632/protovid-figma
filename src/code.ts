// ProtoVid - Main Plugin Code (runs in Figma sandbox)

interface ExportSettings {
  resolution: '720p' | '1080p' | '4K';
  frameRate: 30 | 60;
  format: 'mp4';
  showCursor: boolean;
  licenseKey?: string;
}

interface PrototypeFrame {
  nodeId: string;
  nodeName: string;
  imageData: Uint8Array;
  width: number;
  height: number;
}

// State
let currentSettings: ExportSettings = {
  resolution: '720p',
  frameRate: 30,
  format: 'mp4',
  showCursor: true
};

let exportCount = 0;
const FREE_TIER_LIMIT = 1;
let freeTierLimit = FREE_TIER_LIMIT;
const PLUGIN_VERSION = '1.0.0';
const BACKEND_URL = 'https://protovid.dasgroupllc.com';
let exportInProgress = false;
let currentExportCharged = false;
let currentExportCommitted = false;

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

// ---- Usage tracking ----
async function trackEvent(eventType: string, metadata?: any) {
  try {
    const email = await loadEmail();
    await fetch(`${BACKEND_URL}/api/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        eventType,
        pluginVersion: PLUGIN_VERSION,
        metadata
      })
    });
  } catch (e) {
    console.error('Tracking error:', e);
  }
}

// ---- Server-side export check ----
async function checkServerExports(email: string): Promise<{ canExport: boolean; exportsThisMonth: number; limit: number; isPremium: boolean } | null> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/exports/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (_e) {
    return null;
  }
}

async function incrementServerExports(email: string) {
  try {
    await fetch(`${BACKEND_URL}/api/exports/increment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
  } catch (_e) {
    // Fail silently
  }
}

async function reserveFreeExport(_email: string | null) {
  currentExportCharged = true;
  exportCount++;
  await saveExportCount(exportCount);
  figma.ui.postMessage({
    type: 'export-count-updated',
    data: { exportCount }
  });
}

async function rollbackFreeExport() {
  if (!currentExportCharged || currentExportCommitted) return;
  currentExportCharged = false;
  exportCount = Math.max(0, exportCount - 1);
  await saveExportCount(exportCount);
  figma.ui.postMessage({
    type: 'export-count-updated',
    data: { exportCount }
  });
}

async function commitFreeExport(email: string | null) {
  if (currentExportCommitted) return;
  if (email) {
    await incrementServerExports(email);
  }
  currentExportCommitted = true;
}

// Persist export count across plugin sessions using clientStorage
async function loadExportCount(): Promise<number> {
  try {
    const count = await figma.clientStorage.getAsync('exportCount');
    return typeof count === 'number' ? count : 0;
  } catch (_e) {
    return 0;
  }
}

async function saveExportCount(count: number) {
  try {
    await figma.clientStorage.setAsync('exportCount', count);
  } catch (e) {
    console.error('Failed to save export count:', e);
  }
}

// Initialize plugin
figma.showUI(__html__, { width: 400, height: 720, themeColors: true });

// Track plugin load
trackEvent('plugin_load');
trackEvent('first_open');

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

      case 'export-video':
        await handleExportVideo(msg.data);
        break;

      case 'validate-license':
        await handleValidateLicense(msg.data.licenseKey);
        break;

      case 'cancel':
        figma.closePlugin();
        break;

      case 'encoding-complete':
        await handleEncodingComplete(msg.data?.isPremium ?? false);
        break;

      case 'encoding-failed':
        await rollbackFreeExport();
        exportInProgress = false;
        trackEvent('export_failed', { reason: 'encoding_error' });
        break;

      case 'open-checkout':
        await handleOpenCheckout(msg.data.email, msg.data.plan);
        break;

      case 'open-billing-portal':
        await handleOpenBillingPortal();
        break;

      case 'open-community-listing':
        await handleOpenCommunityListing();
        break;

      case 'save-email':
        await handleSaveEmail(msg.data.email);
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
    }
    figma.ui.postMessage({
      type: 'error',
      data: { message: error instanceof Error ? error.message : String(error) }
    });
  }
};

// Handle email save from email gate
async function handleSaveEmail(email: string) {
  const normalized = email.toLowerCase().trim();
  await saveEmail(normalized);
  trackEvent('email_captured', { email: normalized });
  trackEvent('onboarding_completed');

  // Check server-side export status
  const serverStatus = await checkServerExports(normalized);
  if (serverStatus) {
    exportCount = serverStatus.isPremium ? 0 : Math.max(exportCount, serverStatus.exportsThisMonth);
    freeTierLimit = serverStatus.limit;
    await saveExportCount(exportCount);
  }

  figma.ui.postMessage({
    type: 'email-saved',
    data: {
      email: normalized,
      exportCount,
      freeLimit: freeTierLimit,
      isPremium: serverStatus?.isPremium ?? false
    }
  });
}

// Initialize plugin state
async function handleInit() {
  exportCount = await loadExportCount();
  const savedEmail = await loadEmail();

  // Build graph to count ALL prototype-connected frames
  const { allFrameIds } = await buildPrototypeGraph();
  const hasPrototype = allFrameIds.size > 0;

  if (!savedEmail) {
    trackEvent('onboarding_started', {
      hasPrototype,
      frameCount: allFrameIds.size
    });
  }
  if (hasPrototype) {
    trackEvent('prototype_detected', { frameCount: allFrameIds.size });
    trackEvent('first_action_completed', {
      action: 'prototype_detected',
      frameCount: allFrameIds.size
    });
  }

  // If we have an email, check server for export count and premium status
  let serverPremium = false;
  if (savedEmail) {
    const serverStatus = await checkServerExports(savedEmail);
    if (serverStatus) {
      exportCount = serverStatus.isPremium ? 0 : Math.max(exportCount, serverStatus.exportsThisMonth);
      freeTierLimit = serverStatus.limit;
      await saveExportCount(exportCount);
      serverPremium = serverStatus.isPremium;
    }
  }

  figma.ui.postMessage({
    type: 'init-complete',
    data: {
      hasPrototype,
      frameCount: allFrameIds.size,
      exportCount,
      freeLimit: freeTierLimit,
      savedEmail,
      isPremium: serverPremium
    }
  });
}

// Scan for prototype flows
async function handleScanPrototype() {
  const { allFrameIds } = await buildPrototypeGraph();

  const frames: any[] = [];
  for (const id of allFrameIds) {
    const node = await figma.getNodeByIdAsync(id);
    if (node && isExportableFrame(node)) {
      frames.push({
        id: node.id,
        name: node.name,
        width: (node as FrameNode).width,
        height: (node as FrameNode).height,
      });
    }
  }

  const flow = analyzePrototypeFlow(frames);

  figma.ui.postMessage({
    type: 'scan-complete',
    data: { frames, flow }
  });
}

// Main export function
async function handleExportVideo(settings: ExportSettings) {
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
  const finishWithoutEncoding = () => {
    exportInProgress = false;
    currentExportCharged = false;
    currentExportCommitted = false;
  };

  const email = await loadEmail();

  // Track export attempt
  trackEvent('export_started', {
    resolution: settings.resolution,
    frameRate: settings.frameRate,
    hasLicense: !!email
  });
  trackEvent('export', {
    resolution: settings.resolution,
    frameRate: settings.frameRate,
    hasLicense: !!email
  });

  let serverStatus: { canExport: boolean; exportsThisMonth: number; limit: number; isPremium: boolean } | null = null;
  if (email) {
    serverStatus = await checkServerExports(email);
    if (serverStatus) {
      exportCount = serverStatus.isPremium ? 0 : Math.max(exportCount, serverStatus.exportsThisMonth);
      freeTierLimit = serverStatus.limit;
      await saveExportCount(exportCount);
    }
  }

  // Export status is authoritative for the paywall. License validation is only
  // a fallback for paid users if the export-status endpoint is unavailable.
  const isPremium = serverStatus?.isPremium ?? (email ? await validateLicense(email) : false);

  if (!isPremium) {
    // Server-side check first, fall back to clientStorage
    const canExport = serverStatus?.canExport ?? exportCount < freeTierLimit;

    if (!canExport) {
      trackEvent('export_blocked', {
        reason: 'free_limit',
        exportCount,
        freeLimit: freeTierLimit
      });
      trackEvent('paywall_viewed', {
        trigger: 'free_limit_reached',
        exportCount,
        freeLimit: freeTierLimit
      });
      figma.ui.postMessage({
        type: 'error',
        data: { message: 'Free export used this month. Your next free export resets on the 1st of next month.' }
      });
      figma.ui.postMessage({
        type: 'export-count-updated',
        data: { exportCount }
      });
      finishWithoutEncoding();
      return;
    }

    if (settings.resolution !== '720p') {
      trackEvent('export_blocked', {
        reason: 'premium_resolution',
        resolution: settings.resolution
      });
      figma.ui.postMessage({
        type: 'error',
        data: { message: 'HD/4K export requires Premium. Please upgrade or select 720p.' }
      });
      finishWithoutEncoding();
      return;
    }

    if (settings.frameRate !== 30) {
      trackEvent('export_blocked', {
        reason: 'premium_framerate',
        frameRate: settings.frameRate
      });
      figma.ui.postMessage({
        type: 'error',
        data: { message: 'This frame-rate setting is not available yet. Please export with the default settings.' }
      });
      finishWithoutEncoding();
      return;
    }
  }

  figma.ui.postMessage({
    type: 'progress',
    data: { stage: 'analyzing', percent: 5 }
  });

  // Find starting frame
  const startFrame = await findPrototypeStartFrame();
  if (!startFrame) {
    figma.ui.postMessage({
      type: 'error',
      data: { message: 'No prototype start frame found. Please set up prototype flows first.' }
    });
    finishWithoutEncoding();
    return;
  }

  // Capture prototype frames
  figma.ui.postMessage({
    type: 'progress',
    data: { stage: 'capturing', percent: 20 }
  });

  const capturedFrames = await capturePrototypeFrames(startFrame, settings);

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
      settings,
      isPremium
    }
  });
}

// Validate license (email-based — checks Stripe subscription)
async function handleValidateLicense(licenseKey: string) {
  const isValid = await validateLicense(licenseKey);
  trackEvent('license_validate', { isValid });
  if (isValid) {
    trackEvent('payment_confirmed');
  }

  figma.ui.postMessage({
    type: 'license-validated',
    data: { isValid, licenseKey }
  });
}

async function handleOpenCheckout(email: string, plan?: string) {
  try {
    const selectedPlan = plan || 'monthly';
    trackEvent('checkout_start', { email, plan: selectedPlan });

    await saveEmail(email.toLowerCase().trim());

    const response = await fetch(`${BACKEND_URL}/api/billing/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, plan: selectedPlan })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.url) {
        trackEvent('checkout_opened', { plan: selectedPlan });
        figma.openExternal(data.url);
        figma.notify('Opening checkout... We\'ll detect your payment automatically.');
        figma.ui.postMessage({
          type: 'checkout-opened',
          data: { email: email.toLowerCase().trim() }
        });
      } else {
        trackEvent('checkout_error', {
          plan: selectedPlan,
          reason: 'missing_url'
        });
        figma.notify('Failed to create checkout session. Please try again.');
      }
    } else {
      const error = await response.json();
      trackEvent('checkout_error', {
        plan: selectedPlan,
        status: response.status,
        reason: error.error || 'checkout_request_failed'
      });
      figma.notify(error.error || 'Failed to open checkout. Please try again.');
    }
  } catch (error) {
    console.error('Checkout error:', error);
    trackEvent('checkout_error', {
      plan: plan || 'monthly',
      reason: error instanceof Error ? error.message : 'network_error'
    });
    figma.notify('Network error. Please check your connection and try again.');
  }
}

async function handleOpenBillingPortal() {
  try {
    const email = await loadEmail();
    if (!email) {
      figma.notify('No account found. Please contact support.');
      return;
    }

    const response = await fetch(`${BACKEND_URL}/api/billing/portal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.url) {
        figma.openExternal(data.url);
      }
    } else {
      figma.notify('Failed to open billing portal. Please try again.');
    }
  } catch (error) {
    console.error('Portal error:', error);
    figma.notify('Network error. Please try again.');
  }
}

async function handleOpenCommunityListing() {
  trackEvent('review_prompt_clicked');
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
async function handleEncodingComplete(isPremium: boolean) {
  if (!isPremium) {
    const email = await loadEmail();
    if (!currentExportCharged) {
      await reserveFreeExport(email);
    }
    await commitFreeExport(email);
  }
  exportInProgress = false;
  trackEvent('first_value_reached', {
    resolution: currentSettings.resolution,
    frameRate: currentSettings.frameRate,
    isPremium
  });
  trackEvent('export_completed', {
    resolution: currentSettings.resolution,
    frameRate: currentSettings.frameRate,
    isPremium
  });
  trackEvent('export_success', {
    resolution: currentSettings.resolution,
    frameRate: currentSettings.frameRate,
    isPremium
  });
  trackEvent('review_prompt_shown', {
    trigger: 'export_completed'
  });
  figma.ui.postMessage({
    type: 'export-count-updated',
    data: { exportCount }
  });
}

// Helper: Check if a node type can be exported as a prototype frame
function isExportableFrame(node: BaseNode): boolean {
  return node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'COMPONENT_SET';
}

// Helper: Extract destination node IDs from a reaction
function extractDestinationIds(reaction: any): string[] {
  const ids: string[] = [];
  if (Array.isArray(reaction.actions)) {
    for (const action of reaction.actions) {
      if (action && action.type === 'NODE' && action.destinationId) {
        ids.push(action.destinationId);
      }
    }
  }
  if (reaction.action && reaction.action.type === 'NODE' && reaction.action.destinationId) {
    ids.push(reaction.action.destinationId);
  }
  return ids;
}

// Build prototype graph
async function buildPrototypeGraph(): Promise<{
  edges: Map<string, Set<string>>;
  allFrameIds: Set<string>;
}> {
  const edges = new Map<string, Set<string>>();
  const allFrameIds = new Set<string>();

  async function walkNode(node: SceneNode, sourceFrameId: string) {
    if ('reactions' in node && node.reactions && node.reactions.length > 0) {
      for (const reaction of node.reactions) {
        for (const destId of extractDestinationIds(reaction)) {
          const destNode = await figma.getNodeByIdAsync(destId);
          if (destNode && isExportableFrame(destNode)) {
            if (!edges.has(sourceFrameId)) edges.set(sourceFrameId, new Set());
            edges.get(sourceFrameId)!.add(destId);
            allFrameIds.add(destId);
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

  return { edges, allFrameIds };
}

// Capture frames from prototype flow
async function capturePrototypeFrames(
  startFrame: FrameNode,
  settings: ExportSettings
): Promise<PrototypeFrame[]> {
  const { edges, allFrameIds } = await buildPrototypeGraph();
  const frames: PrototypeFrame[] = [];
  const visited = new Set<string>();
  const queue: string[] = [startFrame.id];

  const resolutionMap = {
    '720p': { width: 1280, height: 720 },
    '1080p': { width: 1920, height: 1080 },
    '4K': { width: 3840, height: 2160 }
  };
  const targetRes = resolutionMap[settings.resolution];
  const totalFrames = Math.max(allFrameIds.size, 1);

  async function exportFrame(frameId: string) {
    const node = await figma.getNodeByIdAsync(frameId);
    if (!node || !isExportableFrame(node)) return;
    const frame = node as FrameNode;

    try {
      const scale = Math.min(calculateScale(frame, targetRes), 4);
      const imageData = await frame.exportAsync({
        format: 'PNG',
        constraint: { type: 'SCALE', value: scale }
      });

      frames.push({
        nodeId: frame.id,
        nodeName: frame.name,
        imageData,
        width: Math.round(frame.width * scale),
        height: Math.round(frame.height * scale)
      });

      figma.ui.postMessage({
        type: 'progress',
        data: {
          stage: 'capturing',
          percent: Math.min(60, 20 + (frames.length * 40 / totalFrames))
        }
      });
    } catch (_e) {
      console.error('Failed to export frame ' + frame.name + ':', _e);
    }
  }

  while (queue.length > 0) {
    const frameId = queue.shift()!;
    if (visited.has(frameId)) continue;
    visited.add(frameId);

    const destinations = edges.get(frameId);
    if (destinations) {
      for (const destId of destinations) {
        if (!visited.has(destId)) queue.push(destId);
      }
    }

    await exportFrame(frameId);
  }

  for (const frameId of allFrameIds) {
    if (visited.has(frameId)) continue;
    visited.add(frameId);
    await exportFrame(frameId);
  }

  return frames;
}

function calculateScale(frame: FrameNode, targetRes: { width: number; height: number }): number {
  const scaleX = targetRes.width / frame.width;
  const scaleY = targetRes.height / frame.height;
  return Math.min(scaleX, scaleY);
}

function hasPrototypeInteractions(node: SceneNode): boolean {
  if ('reactions' in node && node.reactions && node.reactions.length > 0) {
    for (const reaction of node.reactions) {
      if (extractDestinationIds(reaction).length > 0) return true;
    }
  }
  if ('children' in node) {
    return (node as any).children.some((child: SceneNode) => hasPrototypeInteractions(child));
  }
  return false;
}

async function findPrototypeStartFrame(): Promise<FrameNode | null> {
  const flows = figma.currentPage.flowStartingPoints;
  if (flows && flows.length > 0) {
    for (const flow of flows) {
      const node = await figma.getNodeByIdAsync(flow.nodeId);
      if (node && isExportableFrame(node)) {
        return node as FrameNode;
      }
    }
  }

  for (const node of figma.currentPage.children) {
    if (isExportableFrame(node) && hasPrototypeInteractions(node as SceneNode)) {
      return node as FrameNode;
    }
  }
  return null;
}

function analyzePrototypeFlow(frames: any[]) {
  return {
    totalFrames: frames.length,
    estimatedDuration: frames.length * 2,
    hasAnimations: true
  };
}
