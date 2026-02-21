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

let exportCount = 0; // Track free tier usage
const FREE_TIER_LIMIT = 3;

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

// Persist license key
async function loadLicenseKey(): Promise<string | null> {
  try {
    return await figma.clientStorage.getAsync('licenseKey') || null;
  } catch (_e) {
    return null;
  }
}

async function saveLicenseKey(key: string) {
  try {
    await figma.clientStorage.setAsync('licenseKey', key);
  } catch (e) {
    console.error('Failed to save license key:', e);
  }
}

// Initialize plugin
figma.showUI(__html__, { width: 400, height: 600, themeColors: true });

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

      default:
        console.log('Unknown message type:', msg.type);
    }
  } catch (error) {
    figma.ui.postMessage({
      type: 'error',
      data: { message: error instanceof Error ? error.message : String(error) }
    });
  }
};

// Initialize plugin state
async function handleInit() {
  // Load persisted state
  exportCount = await loadExportCount();
  const savedKey = await loadLicenseKey();

  // Build graph to count ALL prototype-connected frames (sources + destinations)
  const { allFrameIds } = await buildPrototypeGraph();

  figma.ui.postMessage({
    type: 'init-complete',
    data: {
      hasPrototype: allFrameIds.size > 0,
      frameCount: allFrameIds.size,
      exportCount,
      freeLimit: FREE_TIER_LIMIT,
      savedLicenseKey: savedKey
    }
  });
}

// Scan for prototype flows
async function handleScanPrototype() {
  const allFrameIds = new Set<string>();
  
  // First pass: find frames with interactions and their destinations
  for (const node of figma.currentPage.children) {
    if (isExportableFrame(node) && hasPrototypeInteractions(node as SceneNode)) {
      allFrameIds.add(node.id);
      const dests = await getPrototypeDestinations(node as FrameNode);
      for (const dest of dests) {
        allFrameIds.add(dest.id);
      }
    }
  }

  // Build frame list from all discovered IDs
  const frames: any[] = [];
  for (const id of allFrameIds) {
    const node = await figma.getNodeByIdAsync(id);
    if (node && isExportableFrame(node)) {
      frames.push({
        id: node.id,
        name: node.name,
        width: (node as FrameNode).width,
        height: (node as FrameNode).height,
        hasInteractions: true
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
  currentSettings = settings;

  // Check license for premium features
  const isPremium = await validateLicense(settings.licenseKey);
  
  if (!isPremium) {
    // Free tier restrictions
    if (exportCount >= FREE_TIER_LIMIT) {
      figma.ui.postMessage({
        type: 'error',
        data: { message: 'Free tier limit reached. Upgrade to Premium for unlimited exports.' }
      });
      return;
    }
    
    if (settings.resolution !== '720p') {
      figma.ui.postMessage({
        type: 'error',
        data: { message: 'HD/4K export requires Premium. Please upgrade or select 720p.' }
      });
      return;
    }

    // Format is always MP4
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
    return;
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
  // Export count is incremented when UI sends 'encoding-complete' back
}

// Validate Lemon Squeezy license key
async function handleValidateLicense(licenseKey: string) {
  const isValid = await validateLicense(licenseKey);
  
  if (isValid) {
    await saveLicenseKey(licenseKey);
  }

  figma.ui.postMessage({
    type: 'license-validated',
    data: { isValid, licenseKey }
  });
}

async function validateLicense(licenseKey?: string): Promise<boolean> {
  if (!licenseKey) return false;

  try {
    const response = await fetch('https://backend-one-nu-28.vercel.app/api/validate-license', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey })
    });
    if (response.ok) {
      const data = await response.json();
      return data.valid === true;
    }

    return false;
  } catch (error) {
    console.error('License validation error:', error);
    return false;
  }
}

// Helper: Check if a node type can be exported as a prototype frame
function isExportableFrame(node: BaseNode): boolean {
  return node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'COMPONENT_SET';
}

// Helper: Extract destination node IDs from a reaction (handles both current and deprecated APIs)
function extractDestinationIds(reaction: any): string[] {
  const ids: string[] = [];
  // Current API: reaction.actions (array)
  if (Array.isArray(reaction.actions)) {
    for (const action of reaction.actions) {
      if (action && action.type === 'NODE' && action.destinationId) {
        ids.push(action.destinationId);
      }
    }
  }
  // Deprecated API: reaction.action (singular)
  if (reaction.action && reaction.action.type === 'NODE' && reaction.action.destinationId) {
    ids.push(reaction.action.destinationId);
  }
  return ids;
}

// Build a global map of prototype connections by walking ALL nodes on the page.
// Uses getNodeByIdAsync (required for dynamic-page documentAccess).
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

  // Add source frames (those with outgoing edges) to allFrameIds
  for (const sourceId of edges.keys()) {
    allFrameIds.add(sourceId);
  }

  return { edges, allFrameIds };
}

// Capture frames from prototype flow using global graph
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

  // BFS through prototype graph
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

  // Fallback: capture any prototype-connected frames missed by BFS
  for (const frameId of allFrameIds) {
    if (visited.has(frameId)) continue;
    visited.add(frameId);
    await exportFrame(frameId);
  }

  return frames;
}

// Calculate scale factor for target resolution
function calculateScale(frame: FrameNode, targetRes: { width: number; height: number }): number {
  const scaleX = targetRes.width / frame.width;
  const scaleY = targetRes.height / frame.height;
  return Math.min(scaleX, scaleY);
}

// Handle encoding completion from UI
async function handleEncodingComplete(isPremium: boolean) {
  if (!isPremium) {
    exportCount++;
    await saveExportCount(exportCount);
  }
  figma.ui.postMessage({
    type: 'export-count-updated',
    data: { exportCount }
  });
}

// Helper: Check if node has prototype interactions
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

// Helper: Find prototype start frame using flowStartingPoints with fallback
async function findPrototypeStartFrame(): Promise<FrameNode | null> {
  // Try flowStartingPoints API first
  const flows = figma.currentPage.flowStartingPoints;
  if (flows && flows.length > 0) {
    for (const flow of flows) {
      const node = await figma.getNodeByIdAsync(flow.nodeId);
      if (node && isExportableFrame(node)) {
        return node as FrameNode;
      }
    }
  }

  // Fallback: first top-level frame with prototype interactions
  for (const node of figma.currentPage.children) {
    if (isExportableFrame(node) && hasPrototypeInteractions(node as SceneNode)) {
      return node as FrameNode;
    }
  }
  return null;
}

// Helper: Analyze prototype flow
function analyzePrototypeFlow(frames: any[]) {
  return {
    totalFrames: frames.length,
    estimatedDuration: frames.length * 2, // 2 seconds per frame estimate
    hasAnimations: true // TODO: detect actual animations
  };
}

