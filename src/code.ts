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

  const prototypeNodes = figma.currentPage.children.filter(
    node => node.type === 'FRAME' && hasPrototypeInteractions(node)
  );

  figma.ui.postMessage({
    type: 'init-complete',
    data: {
      hasPrototype: prototypeNodes.length > 0,
      frameCount: prototypeNodes.length,
      exportCount,
      freeLimit: FREE_TIER_LIMIT,
      savedLicenseKey: savedKey
    }
  });
}

// Scan for prototype flows
async function handleScanPrototype() {
  const frames: any[] = [];
  
  // Find all frames with prototype interactions
  for (const node of figma.currentPage.children) {
    if (node.type === 'FRAME' && hasPrototypeInteractions(node)) {
      frames.push({
        id: node.id,
        name: node.name,
        width: node.width,
        height: node.height,
        hasInteractions: true
      });
    }
  }

  // Analyze prototype flow
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
  const startFrame = findPrototypeStartFrame();
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

  console.log('Start frame:', startFrame.name, startFrame.id);
  const capturedFrames = await capturePrototypeFrames(startFrame, settings);
  console.log('Captured frames:', capturedFrames.length, capturedFrames.map(f => f.nodeName));

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

// Capture frames from prototype flow
async function capturePrototypeFrames(
  startFrame: FrameNode,
  settings: ExportSettings
): Promise<PrototypeFrame[]> {
  const frames: PrototypeFrame[] = [];
  const visited = new Set<string>();
  const queue: FrameNode[] = [startFrame];

  const resolutionMap = {
    '720p': { width: 1280, height: 720 },
    '1080p': { width: 1920, height: 1080 },
    '4K': { width: 3840, height: 2160 }
  };

  const targetRes = resolutionMap[settings.resolution];

  while (queue.length > 0) {
    const frame = queue.shift()!;
    
    if (visited.has(frame.id)) continue;
    visited.add(frame.id);

    // Always discover next frames, regardless of export success
    const nextFrames = await getPrototypeDestinations(frame);
    queue.push(...nextFrames);

    try {
      // Export frame as PNG — cap scale to avoid huge exports
      const scale = Math.min(calculateScale(frame, targetRes), 4);
      console.log('Exporting frame:', frame.name, 'scale:', scale, 'size:', frame.width, 'x', frame.height);
      
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

      // Update progress
      figma.ui.postMessage({
        type: 'progress',
        data: { 
          stage: 'capturing', 
          percent: Math.min(60, 20 + (frames.length * 40 / Math.max(visited.size, 10)))
        }
      });

    } catch (_e) {
      console.error('Failed to export frame ' + frame.name + ':', _e);
    }
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
    return node.reactions.some((reaction: any) => {
      if (reaction.actions && Array.isArray(reaction.actions)) {
        return reaction.actions.some((a: any) => a && a.type === 'NODE');
      }
      return reaction.action && reaction.action.type === 'NODE';
    });
  }
  
  if ('children' in node) {
    return node.children.some(child => hasPrototypeInteractions(child));
  }
  
  return false;
}

// Helper: Find prototype start frame (first frame or marked start)
function findPrototypeStartFrame(): FrameNode | null {
  for (const node of figma.currentPage.children) {
    if (node.type === 'FRAME' && hasPrototypeInteractions(node)) {
      return node as FrameNode;
    }
  }
  return null;
}

// Helper: Get prototype destination frames
async function getPrototypeDestinations(frame: FrameNode): Promise<FrameNode[]> {
  const destinations: FrameNode[] = [];
  const seen = new Set<string>();
  
  async function addDestination(destinationId: string | null | undefined) {
    if (!destinationId || seen.has(destinationId)) return;
    seen.add(destinationId);
    const destNode = await figma.getNodeByIdAsync(destinationId);
    if (destNode && destNode.type === 'FRAME') {
      destinations.push(destNode as FrameNode);
    }
  }
  
  async function findDestinations(node: SceneNode) {
    if ('reactions' in node && node.reactions) {
      console.log('Node', node.name, 'has', node.reactions.length, 'reactions:', JSON.stringify(node.reactions.map((r: any) => ({ action: r.action?.type, actions: r.actions?.map((a: any) => a?.type), destinationId: r.action?.destinationId }))));
      for (const reaction of node.reactions) {
        // New API: reaction.actions (array)
        if ('actions' in reaction && Array.isArray((reaction as any).actions)) {
          for (const action of (reaction as any).actions) {
            if (action && action.type === 'NODE') {
              await addDestination(action.destinationId);
            }
          }
        }
        // Old API: reaction.action (singular)
        if (reaction.action && reaction.action.type === 'NODE') {
          await addDestination((reaction.action as any).destinationId);
        }
      }
    }
    
    if ('children' in node) {
      for (const child of node.children) {
        await findDestinations(child);
      }
    }
  }
  
  await findDestinations(frame);
  return destinations;
}

// Helper: Analyze prototype flow
function analyzePrototypeFlow(frames: any[]) {
  return {
    totalFrames: frames.length,
    estimatedDuration: frames.length * 2, // 2 seconds per frame estimate
    hasAnimations: true // TODO: detect actual animations
  };
}

