// ProtoVid - Main Plugin Code (runs in Figma sandbox)

interface ExportSettings {
  resolution: '720p' | '1080p' | '4K';
  frameRate: 30 | 60;
  format: 'mp4' | 'gif';
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
      
      default:
        console.log('Unknown message type:', msg.type);
    }
  } catch (error) {
    figma.ui.postMessage({
      type: 'error',
      data: { message: error.message }
    });
  }
};

// Initialize plugin state
async function handleInit() {
  const prototypeNodes = figma.currentPage.children.filter(
    node => node.type === 'FRAME' && hasPrototypeInteractions(node)
  );

  figma.ui.postMessage({
    type: 'init-complete',
    data: {
      hasPrototype: prototypeNodes.length > 0,
      frameCount: prototypeNodes.length,
      exportCount,
      freeLimit: FREE_TIER_LIMIT
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

    if (settings.format === 'gif') {
      figma.ui.postMessage({
        type: 'error',
        data: { message: 'GIF export requires Premium. Please upgrade.' }
      });
      return;
    }
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

  const capturedFrames = await capturePrototypeFrames(startFrame, settings);

  figma.ui.postMessage({
    type: 'progress',
    data: { stage: 'encoding', percent: 60 }
  });

  // Send to backend for video encoding
  const videoData = await encodeVideo(capturedFrames, settings, isPremium);

  figma.ui.postMessage({
    type: 'progress',
    data: { stage: 'finalizing', percent: 90 }
  });

  // Increment export count for free tier
  if (!isPremium) {
    exportCount++;
  }

  figma.ui.postMessage({
    type: 'export-complete',
    data: {
      videoUrl: videoData.url,
      videoBlob: videoData.blob,
      filename: `protovid-export-${Date.now()}.${settings.format}`,
      exportCount,
      isPremium
    }
  });
}

// Validate Lemon Squeezy license key
async function handleValidateLicense(licenseKey: string) {
  const isValid = await validateLicense(licenseKey);
  
  figma.ui.postMessage({
    type: 'license-validated',
    data: { isValid, licenseKey }
  });
}

async function validateLicense(licenseKey?: string): Promise<boolean> {
  if (!licenseKey) return false;

  try {
    // TODO: Call backend API to validate with Lemon Squeezy
    // For now, accept placeholder keys for development
    if (licenseKey.startsWith('DEV_') || licenseKey.startsWith('PREMIUM_')) {
      return true;
    }

    // In production, this would call your API:
    // const response = await fetch('https://your-api.vercel.app/api/validate-license', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ licenseKey })
    // });
    // return response.ok;

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

    try {
      // Export frame as PNG
      const imageData = await frame.exportAsync({
        format: 'PNG',
        constraint: { type: 'SCALE', value: calculateScale(frame, targetRes) }
      });

      frames.push({
        nodeId: frame.id,
        nodeName: frame.name,
        imageData,
        width: Math.round(frame.width * calculateScale(frame, targetRes)),
        height: Math.round(frame.height * calculateScale(frame, targetRes))
      });

      // Find next frames in prototype flow
      const nextFrames = getPrototypeDestinations(frame);
      queue.push(...nextFrames);

      // Update progress
      figma.ui.postMessage({
        type: 'progress',
        data: { 
          stage: 'capturing', 
          percent: 20 + (frames.length * 40 / Math.max(visited.size, 10))
        }
      });

    } catch (error) {
      console.error(`Failed to export frame ${frame.name}:`, error);
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

// Encode frames into video
async function encodeVideo(
  frames: PrototypeFrame[],
  settings: ExportSettings,
  isPremium: boolean
): Promise<{ url: string; blob: Uint8Array }> {
  try {
    // In production, send frames to backend API for FFmpeg encoding
    // For now, return mock data structure
    
    // Convert frames to base64 for transmission
    const framesData = frames.map(f => ({
      nodeId: f.nodeId,
      nodeName: f.nodeName,
      imageBase64: uint8ArrayToBase64(f.imageData),
      width: f.width,
      height: f.height
    }));

    // TODO: Call backend API
    // const response = await fetch('https://your-api.vercel.app/api/encode-video', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     frames: framesData,
    //     settings,
    //     isPremium
    //   })
    // });
    // const result = await response.json();
    // return result;

    // Mock response for development
    return {
      url: 'https://example.com/video.mp4',
      blob: new Uint8Array([])
    };
  } catch (error) {
    throw new Error(`Video encoding failed: ${error.message}`);
  }
}

// Helper: Check if node has prototype interactions
function hasPrototypeInteractions(node: SceneNode): boolean {
  if ('reactions' in node && node.reactions && node.reactions.length > 0) {
    return node.reactions.some(reaction => 
      reaction.action && reaction.action.type === 'NODE'
    );
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
function getPrototypeDestinations(frame: FrameNode): FrameNode[] {
  const destinations: FrameNode[] = [];
  
  function findDestinations(node: SceneNode) {
    if ('reactions' in node && node.reactions) {
      for (const reaction of node.reactions) {
        if (reaction.action && reaction.action.type === 'NODE') {
          const destNode = figma.getNodeById(reaction.action.destinationId!);
          if (destNode && destNode.type === 'FRAME') {
            destinations.push(destNode as FrameNode);
          }
        }
      }
    }
    
    if ('children' in node) {
      node.children.forEach(findDestinations);
    }
  }
  
  findDestinations(frame);
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

// Helper: Convert Uint8Array to base64
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
