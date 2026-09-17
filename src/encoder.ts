// ProtoVid - Client-side video encoder (runs in UI iframe context)
// Primary: WebCodecs API (VideoEncoder) + mp4-muxer -> H.264 MP4 (no server needed)
// Fallback: pure-JS MJPEG AVI, then backend FFmpeg transcode to MP4

import { Muxer as MP4Muxer, ArrayBufferTarget as MP4ArrayBufferTarget, type MuxerOptions as MP4MuxerOptions } from 'mp4-muxer';
import { Muxer as WebMMuxer, ArrayBufferTarget as WebMArrayBufferTarget, type MuxerOptions as WebMMuxerOptions } from 'webm-muxer';
import { BACKEND_MAX_UPLOAD_BYTES, getPayloadPreflight } from './exportPreflight';

const PLUGIN_VERSION = '1.3.21';

// Screen-level transition metadata captured from prototype reactions. Drives the
// synthesized "transition effects" (fade/slide) between frames and the
// best-effort Smart Animate layer overlays.
interface TransitionMeta {
  type: string;
  direction?: string;
  duration: number; // seconds
  easing: string;
  smartAnimateLayers?: SmartAnimateLayerMotion[] | null;
}

interface LayerBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SmartAnimateLayerMotion {
  key: string;
  source: {
    id: string;
    bounds: LayerBounds;
    opacity: number;
    rotation: number;
    imageData?: Uint8Array;
  };
  destination: {
    id: string;
    bounds: LayerBounds;
    opacity: number;
    rotation: number;
    imageData?: Uint8Array;
  };
}

interface FrameInput {
  imageData: Uint8Array;
  width: number;
  height: number;
  exportScale: number;
  layers: Array<{
    id: string;
    name: string;
    type: string;
    keyExact: string;
    keyLoose: string;
    keyLeaf: string;
    bounds: LayerBounds;
    opacity: number;
    rotation: number;
    visible: boolean;
  }>;
  transitionIn?: TransitionMeta | null;
}

interface EncodeSettings {
  format: 'mp4' | 'webm' | 'gif';
}

type ProgressCallback = (percent: number) => void;

interface EncodeOptions {
  forceBackend?: boolean;
  safeMode?: boolean;
  disableTransitions?: boolean;
  maxWidth?: number;
  maxHeight?: number;
  holdSeconds?: number;
  jpegQuality?: number;
  fps?: number;
  onTelemetry?: (event: EncodeTelemetryEvent) => void;
}

interface EncodeUserContext {
  email?: string;
  resolution?: string;
  anonymousId?: string;
  exportId?: string;
  projectId?: string;
  plan?: 'free' | 'pro' | 'export_pass';
  fps?: number;
  watermarkEnabled?: boolean;
  firstExport?: boolean;
}

export interface EncodeTelemetryEvent {
  eventType: 'payload_preflight_started' | 'payload_preflight_completed' | 'payload_preflight_failed' | 'upload_started' | 'upload_completed';
  metadata: Record<string, string | number | boolean | null>;
}

// Output frame rate of the video. Higher than the old 1fps so synthesized
// transition effects render smoothly.
const FPS = 30;
// The backend fallback only reproduces static holds (transitions are disabled
// there), so a low frame rate keeps the uploaded AVI tiny without changing what
// the viewer sees. Each still is repeated FALLBACK_FPS * holdSeconds times.
const FALLBACK_FPS = 1;
const GIF_FPS = 8;
// Vercel serverless functions reject request bodies larger than ~4.5MB, so the
// AVI we upload for transcoding must stay under this. Fail fast (with a
// categorized error) instead of burning a doomed multi-second upload.
// Cap the WebCodecs encode queue so long flows don't accumulate an unbounded
// backlog of VideoFrames and exhaust memory (a common browser_encode failure).
const MAX_ENCODE_QUEUE = 8;
// Each prototype frame is held (static) for this many seconds in the output.
const FRAME_HOLD_SECONDS = 2;
// Cap a transition's duration so a misconfigured prototype can't produce a
// multi-second tween (and balloon frame counts at 4K).
const MAX_TRANSITION_SECONDS = 1;
const BACKEND_URL = 'https://protovid.dasgroupllc.com';
const FALLBACK_PROFILES = [
  {
    name: 'standard',
    maxWidth: 1280,
    maxHeight: 720,
    holdSeconds: FRAME_HOLD_SECONDS,
    jpegQuality: 0.62,
    fps: FALLBACK_FPS,
  },
  {
    name: 'compact',
    maxWidth: 960,
    maxHeight: 540,
    holdSeconds: 1.5,
    jpegQuality: 0.56,
    fps: FALLBACK_FPS,
  },
  {
    name: 'minimum',
    maxWidth: 854,
    maxHeight: 480,
    holdSeconds: 1,
    jpegQuality: 0.5,
    fps: FALLBACK_FPS,
  },
] as const;
const H264_CODEC_CANDIDATES = [
  'avc1.42E01E', // Baseline profile, widely supported in Chromium/WebCodecs
  'avc1.42001f', // Older baseline variant already used by the app
  'avc1.640028', // High profile fallback for browsers that prefer it
] as const;
const WEBM_CODEC_CANDIDATES = [
  { configCodec: 'vp09.00.10.08', muxerCodec: 'V_VP9' },
  { configCodec: 'vp8', muxerCodec: 'V_VP8' },
] as const;

function pickWebCodecsBitrate(width: number, height: number): number {
  const pixels = width * height;
  if (pixels >= 3840 * 2160) return 10_000_000;
  if (pixels >= 1920 * 1080) return 6_000_000;
  return 3_000_000;
}

async function pickSupportedH264Config(width: number, height: number): Promise<VideoEncoderConfig> {
  const baseConfig = {
    width,
    height,
    bitrate: pickWebCodecsBitrate(width, height),
    framerate: FPS,
    avc: { format: 'avc' as const },
  };

  for (const codec of H264_CODEC_CANDIDATES) {
    const candidate = { codec, ...baseConfig };
    try {
      if (typeof VideoEncoder.isConfigSupported === 'function') {
        const supported = await VideoEncoder.isConfigSupported(candidate);
        if (supported?.supported) return candidate;
      } else {
        return candidate;
      }
    } catch (_error) {
      // Try the next codec candidate.
    }
  }

  throw new Error('No supported H.264 WebCodecs configuration found');
}

async function pickSupportedWebMConfig(width: number, height: number): Promise<{
  config: VideoEncoderConfig;
  muxerCodec: string;
}> {
  const baseConfig = {
    width,
    height,
    bitrate: pickWebCodecsBitrate(width, height),
    framerate: FPS,
  };

  for (const candidate of WEBM_CODEC_CANDIDATES) {
    const config = { codec: candidate.configCodec, ...baseConfig };
    try {
      if (typeof VideoEncoder.isConfigSupported === 'function') {
        const supported = await VideoEncoder.isConfigSupported(config);
        if (supported?.supported) return { config, muxerCodec: candidate.muxerCodec };
      } else {
        return { config, muxerCodec: candidate.muxerCodec };
      }
    } catch (_error) {
      // Try the next codec candidate.
    }
  }

  throw new Error('No supported WebM WebCodecs configuration found');
}

async function loadPNG(data: Uint8Array): Promise<ImageBitmap> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data as any);

  // Try createImageBitmap first if available
  if (typeof createImageBitmap !== 'undefined') {
    try {
      const blob = new Blob([bytes], { type: 'image/png' });
      return await createImageBitmap(blob);
    } catch (error) {
      // Fall through to canvas-based approach
    }
  }

  // Web-compatible fallback: decode via an <img> element and return a mock
  // ImageBitmap that carries the element for drawing.
  return new Promise((resolve, reject) => {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const base64 = btoa(binary);
    const dataUrl = `data:image/png;base64,${base64}`;

    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.width,
        height: img.height,
        close: () => {},
        _imageElement: img,
        [Symbol.toStringTag]: 'ImageBitmap'
      } as any);
    };
    img.onerror = () => reject(new Error('Failed to decode PNG data'));
    img.src = dataUrl;
  });
}

// Resolve a loadPNG result into something ctx.drawImage accepts.
function resolveDrawable(bmp: any): CanvasImageSource {
  if (typeof ImageBitmap !== 'undefined' && bmp instanceof ImageBitmap) return bmp as any;
  if (bmp && bmp._imageElement) return bmp._imageElement;
  return bmp;
}

function closeDrawable(bmp: any) {
  if (bmp && typeof bmp.close === 'function') bmp.close();
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function canvasToJPEG(canvas: HTMLCanvasElement, quality: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) { reject(new Error('Failed to convert frame to JPEG')); return; }
        blob.arrayBuffer().then(buf => resolve(new Uint8Array(buf)));
      },
      'image/jpeg',
      quality
    );
  });
}

function drawWatermark(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const fontSize = Math.max(14, Math.round(height * 0.022));
  ctx.save();

  const barHeight = fontSize * 2.4;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.fillRect(0, height - barHeight, width, barHeight);

  ctx.font = `600 ${fontSize}px Inter, -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';

  const text = 'Made with love by ProtoVid - protovid.dasgroupllc.com';
  const textWidth = ctx.measureText(text).width;

  if (textWidth > width * 0.9) {
    ctx.fillText('Made with love by ProtoVid', width / 2, height - barHeight / 2);
  } else {
    ctx.fillText(text, width / 2, height - barHeight / 2);
  }

  ctx.restore();
}

// ─── Transition effects ──────────────────────────────────────────────────────

interface TransitionPlan {
  kind: 'crossfade' | 'slide' | 'cut' | 'smart-animate';
  push: boolean;       // both frames move (PUSH) vs incoming slides over a static one
  direction: string;   // LEFT | RIGHT | TOP | BOTTOM
  frames: number;      // number of tween frames to emit
  easing: string;
  smartAnimateLayers?: SmartAnimateLayerMotion[] | null;
}

// Map a captured transition to a concrete tween plan. Smart Animate uses a
// crossfade baseline plus layer overlays when capture data is available.
// Unknown types default to crossfade; INSTANT is a hard cut.
function planTransition(trans: TransitionMeta | null | undefined): TransitionPlan {
  const none: TransitionPlan = { kind: 'cut', push: false, direction: 'LEFT', frames: 0, easing: 'LINEAR' };
  if (!trans || !trans.type) return none;

  let kind: TransitionPlan['kind'];
  switch (trans.type) {
    case 'DISSOLVE':
    case 'SCROLL_ANIMATE':
      kind = 'crossfade';
      break;
    case 'SMART_ANIMATE':
      kind = trans.smartAnimateLayers && trans.smartAnimateLayers.length > 0 ? 'smart-animate' : 'crossfade';
      break;
    case 'MOVE_IN':
    case 'MOVE_OUT':
    case 'PUSH':
    case 'SLIDE_IN':
    case 'SLIDE_OUT':
      kind = 'slide';
      break;
    case 'INSTANT':
      return none;
    default:
      kind = 'crossfade';
  }

  const dur = Math.min(Math.max(trans.duration || 0.3, 0), MAX_TRANSITION_SECONDS);
  const frames = Math.round(dur * FPS);
  if (frames <= 0) return none;

  return {
    kind,
    push: trans.type === 'PUSH',
    direction: trans.direction || 'LEFT',
    frames,
    easing: trans.easing || 'EASE_OUT',
    smartAnimateLayers: trans.smartAnimateLayers || null,
  };
}

// Eased progress in [0,1] for a linear input in [0,1].
function applyEasing(t: number, easing: string): number {
  switch (easing) {
    case 'LINEAR':
      return t;
    case 'EASE_IN':
      return t * t;
    case 'EASE_OUT':
      return t * (2 - t);
    case 'EASE_IN_AND_OUT':
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    case 'EASE_IN_BACK': {
      const c1 = 1.70158;
      return (c1 + 1) * t * t * t - c1 * t * t;
    }
    case 'EASE_OUT_BACK': {
      const c1 = 1.70158;
      return 1 + (c1 + 1) * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }
    default:
      return t * (2 - t); // ease-out feel for GENTLE/QUICK/BOUNCY/custom/etc.
  }
}

function drawStill(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  originalWidth: number,
  originalHeight: number,
  img: CanvasImageSource
) {
  ctx.clearRect(0, 0, width, height);
  ctx.globalAlpha = 1;
  ctx.drawImage(img, (width - originalWidth) / 2, (height - originalHeight) / 2, originalWidth, originalHeight);
}

function drawTransitionFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  originalWidth: number,
  originalHeight: number,
  prevImg: CanvasImageSource,
  curImg: CanvasImageSource,
  plan: TransitionPlan,
  e: number
) {
  const ox = (width - originalWidth) / 2;
  const oy = (height - originalHeight) / 2;
  ctx.clearRect(0, 0, width, height);
  ctx.globalAlpha = 1;

  if (plan.kind === 'crossfade' || plan.kind === 'smart-animate') {
    ctx.drawImage(prevImg, ox, oy, originalWidth, originalHeight);
    ctx.globalAlpha = e;
    ctx.drawImage(curImg, ox, oy, originalWidth, originalHeight);
    ctx.globalAlpha = 1;
    return;
  }

  // slide: incoming frame enters from the edge implied by direction
  let ux = 0, uy = 0;
  switch (plan.direction) {
    case 'RIGHT': ux = -1; break;
    case 'LEFT': ux = 1; break;
    case 'TOP': uy = 1; break;
    case 'BOTTOM': uy = -1; break;
    default: ux = 1;
  }

  if (plan.push) {
    ctx.drawImage(prevImg, ox - ux * width * e, oy - uy * height * e, originalWidth, originalHeight);
  } else {
    ctx.drawImage(prevImg, ox, oy, originalWidth, originalHeight);
  }
  ctx.drawImage(curImg, ox + ux * width * (1 - e), oy + uy * height * (1 - e), originalWidth, originalHeight);
}

function drawAsset(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  bounds: LayerBounds,
  opacity: number,
  rotation: number
) {
  if (bounds.width <= 0 || bounds.height <= 0 || opacity <= 0) return;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  if (rotation) ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(image, -bounds.width / 2, -bounds.height / 2, bounds.width, bounds.height);
  ctx.restore();
}

async function getDecodedAsset(
  data: Uint8Array | undefined,
  cache: WeakMap<Uint8Array, Promise<any>>
): Promise<any | null> {
  if (!data) return null;
  let entry = cache.get(data);
  if (!entry) {
    entry = loadPNG(data);
    cache.set(data, entry);
  }
  return await entry;
}

// ─── Shared timeline walker ──────────────────────────────────────────────────

// Frames are processed one at a time, keeping only the previous and current
// decoded images in memory (never the full tween sequence). `emit(canvas, n)`
// is called by each sink to commit the current canvas n times — holds reuse a
// single composed canvas so they cost nothing extra to repeat.
async function renderTimeline(
  frames: FrameInput[],
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  originalWidth: number,
  originalHeight: number,
  addWatermark: boolean,
  onProgress: ProgressCallback,
  emit: (canvas: HTMLCanvasElement, repeat: number) => Promise<void>,
  options: EncodeOptions = {}
): Promise<void> {
  const holdSeconds = options.holdSeconds ?? FRAME_HOLD_SECONDS;
  const fps = options.fps ?? FPS;
  const holdFrames = Math.max(1, Math.round(holdSeconds * fps));
  let prev: any = null;
  const bitmapCache = new WeakMap<Uint8Array, Promise<any>>();

  for (let i = 0; i < frames.length; i++) {
    const cur = await loadPNG(frames[i].imageData);
    const curImg = resolveDrawable(cur);

    if (prev && i > 0) {
      const plan = options.disableTransitions
        ? planTransition(null)
        : planTransition(frames[i].transitionIn);
      if (plan.frames > 0) {
        const prevImg = resolveDrawable(prev);
        for (let f = 1; f <= plan.frames; f++) {
          const linearT = f / (plan.frames + 1);
          const e = applyEasing(linearT, plan.easing);
          drawTransitionFrame(ctx, width, height, originalWidth, originalHeight, prevImg, curImg, plan, e);

          if (plan.kind === 'smart-animate' && plan.smartAnimateLayers && plan.smartAnimateLayers.length > 0) {
            for (const layer of plan.smartAnimateLayers) {
              const sourceBmp = await getDecodedAsset(layer.source.imageData, bitmapCache);
              const destBmp = await getDecodedAsset(layer.destination.imageData, bitmapCache);
              if (sourceBmp) {
                drawAsset(
                  ctx,
                  resolveDrawable(sourceBmp),
                  layer.source.bounds,
                  (1 - e) * Math.max(layer.source.opacity, 0),
                  layer.source.rotation
                );
              }
              if (destBmp) {
                drawAsset(
                  ctx,
                  resolveDrawable(destBmp),
                  layer.destination.bounds,
                  e * Math.max(layer.destination.opacity, 0),
                  layer.destination.rotation
                );
              }
            }
          }

          if (addWatermark) drawWatermark(ctx, width, height);
          await emit(canvas, 1);
        }
      }
    }

    drawStill(ctx, width, height, originalWidth, originalHeight, curImg);
    if (addWatermark) drawWatermark(ctx, width, height);
    await emit(canvas, holdFrames);

    if (prev) closeDrawable(prev);
    prev = cur;
    onProgress(20 + ((i + 1) / frames.length) * 70);
  }

  if (prev) closeDrawable(prev);
}

// ─── Primary path: H.264 MP4 via WebCodecs ───────────────────────────────────

// Ensure dimensions are even for H.264 compatibility
function padDimensions(width: number, height: number): { width: number; height: number } {
  return {
    width: width + (width % 2),
    height: height + (height % 2)
  };
}

function fitDimensions(
  width: number,
  height: number,
  maxWidth?: number,
  maxHeight?: number
): { width: number; height: number } {
  if (!maxWidth && !maxHeight) return { width, height };

  const widthScale = maxWidth ? maxWidth / width : 1;
  const heightScale = maxHeight ? maxHeight / height : 1;
  const scale = Math.min(1, widthScale, heightScale);

  return {
    width: Math.max(2, Math.round(width * scale)),
    height: Math.max(2, Math.round(height * scale)),
  };
}

async function getFirstFrameDimensions(frames: FrameInput[]): Promise<{ width: number; height: number }> {
  const first = await loadPNG(frames[0].imageData);
  const width = first.width;
  const height = first.height;
  closeDrawable(first);
  return { width, height };
}

function createCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create canvas context');
  return { canvas, ctx };
}

async function encodeMP4WebCodecs(
  frames: FrameInput[],
  onProgress: ProgressCallback,
  addWatermark: boolean,
  options: EncodeOptions = {}
): Promise<{ data: Uint8Array; width: number; height: number }> {
  const firstDimensions = await getFirstFrameDimensions(frames);
  const targetDimensions = fitDimensions(
    firstDimensions.width,
    firstDimensions.height,
    options.maxWidth,
    options.maxHeight
  );
  const { width, height } = padDimensions(targetDimensions.width, targetDimensions.height);
  const supportedConfig = await pickSupportedH264Config(width, height);

  const target = new MP4ArrayBufferTarget();
  const muxerOptions: MP4MuxerOptions<MP4ArrayBufferTarget> & {
    metadata: Record<string, string>;
  } = {
    target,
    video: { codec: 'avc', width, height, frameRate: FPS },
    fastStart: 'in-memory',
    metadata: {
      title: 'Figma Prototype Video',
      description: 'Created with ProtoVid - Figma prototype video exporter',
      generator: 'ProtoVid v1.2.1 (https://protovid.dasgroupllc.com)',
      comment: 'Professional prototype videos for client presentations'
    }
  };
  const muxer = new MP4Muxer(muxerOptions);

  let encodeError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { encodeError = e; },
  });

  encoder.configure(supportedConfig);

  const { canvas, ctx } = createCanvas(width, height);

  let frameIndex = 0;
  const usPerFrame = 1_000_000 / FPS;
  // A keyframe roughly every 2s keeps the MP4 seekable.
  const keyframeInterval = FPS * 2;

  const emit = async (cnv: HTMLCanvasElement, repeat: number) => {
    if (encodeError) throw encodeError;

    // Backpressure: let the encoder drain before queuing more frames so long
    // flows don't build an unbounded VideoFrame backlog and run out of memory.
    while (encoder.encodeQueueSize > MAX_ENCODE_QUEUE) {
      await sleep(4);
      if (encodeError) throw encodeError;
    }

    let snapshot: ImageBitmap | HTMLCanvasElement;
    try {
      snapshot = await createImageBitmap(cnv);
    } catch (_e) {
      snapshot = cnv;
    }

    for (let r = 0; r < repeat; r++) {
      const videoFrame = new VideoFrame(snapshot, {
        timestamp: Math.round(frameIndex * usPerFrame),
        duration: Math.round(usPerFrame),
      });
      encoder.encode(videoFrame, { keyFrame: frameIndex % keyframeInterval === 0 });
      videoFrame.close();
      frameIndex++;
    }

    if (snapshot !== cnv && typeof (snapshot as ImageBitmap).close === 'function') {
      (snapshot as ImageBitmap).close();
    }
  };

  await renderTimeline(
    frames,
    ctx,
    canvas,
    width,
    height,
    targetDimensions.width,
    targetDimensions.height,
    addWatermark,
    onProgress,
    emit,
    options
  );

  await encoder.flush();
  if (encodeError) throw encodeError;
  muxer.finalize();

  return { data: new Uint8Array(target.buffer), width, height };
}

async function encodeWebMWebCodecs(
  frames: FrameInput[],
  onProgress: ProgressCallback,
  addWatermark: boolean,
  options: EncodeOptions = {}
): Promise<{ data: Uint8Array; width: number; height: number }> {
  const firstDimensions = await getFirstFrameDimensions(frames);
  const targetDimensions = fitDimensions(
    firstDimensions.width,
    firstDimensions.height,
    options.maxWidth,
    options.maxHeight
  );
  const { width, height } = padDimensions(targetDimensions.width, targetDimensions.height);
  const supported = await pickSupportedWebMConfig(width, height);

  const target = new WebMArrayBufferTarget();
  const muxerOptions: WebMMuxerOptions<WebMArrayBufferTarget> = {
    target,
    video: { codec: supported.muxerCodec, width, height, frameRate: FPS },
    firstTimestampBehavior: 'strict',
  };
  const muxer = new WebMMuxer(muxerOptions);

  let encodeError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { encodeError = e; },
  });

  encoder.configure(supported.config);

  const { canvas, ctx } = createCanvas(width, height);
  let frameIndex = 0;
  const usPerFrame = 1_000_000 / FPS;
  const keyframeInterval = FPS * 2;

  const emit = async (cnv: HTMLCanvasElement, repeat: number) => {
    if (encodeError) throw encodeError;
    while (encoder.encodeQueueSize > MAX_ENCODE_QUEUE) {
      await sleep(4);
      if (encodeError) throw encodeError;
    }

    let snapshot: ImageBitmap | HTMLCanvasElement;
    try {
      snapshot = await createImageBitmap(cnv);
    } catch (_e) {
      snapshot = cnv;
    }

    for (let r = 0; r < repeat; r++) {
      const videoFrame = new VideoFrame(snapshot, {
        timestamp: Math.round(frameIndex * usPerFrame),
        duration: Math.round(usPerFrame),
      });
      encoder.encode(videoFrame, { keyFrame: frameIndex % keyframeInterval === 0 });
      videoFrame.close();
      frameIndex++;
    }

    if (snapshot !== cnv && typeof (snapshot as ImageBitmap).close === 'function') {
      (snapshot as ImageBitmap).close();
    }
  };

  await renderTimeline(
    frames,
    ctx,
    canvas,
    width,
    height,
    targetDimensions.width,
    targetDimensions.height,
    addWatermark,
    onProgress,
    emit,
    options
  );

  await encoder.flush();
  if (encodeError) throw encodeError;
  muxer.finalize();

  return { data: new Uint8Array(target.buffer), width, height };
}

// ─── Fallback path: MJPEG AVI (pure JS, no browser APIs needed) ──────────────

function buildMJPEGAVI(
  jpegFrames: Uint8Array[],
  width: number,
  height: number,
  fps: number
): Uint8Array {
  const numFrames = jpegFrames.length;
  const maxChunk = Math.max(...jpegFrames.map(f => f.length));
  const padded = jpegFrames.map(f => f.length + (f.length % 2));

  const AVIH = 56, STRH = 56, STRF = 40;
  const strl = 4 + (8 + STRH) + (8 + STRF);
  const hdrl = 4 + (8 + AVIH) + (8 + strl);

  let moviPayload = 0;
  for (let i = 0; i < numFrames; i++) moviPayload += 8 + padded[i];
  const movi = 4 + moviPayload;
  const idx1 = numFrames * 16;
  const riff = 4 + (8 + hdrl) + (8 + movi) + (8 + idx1);
  const total = 8 + riff;

  const buf = new ArrayBuffer(total);
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);
  let p = 0;

  const cc  = (s: string) => { for (let i = 0; i < 4; i++) dv.setUint8(p++, s.charCodeAt(i)); };
  const u32 = (v: number) => { dv.setUint32(p, v, true); p += 4; };
  const u16 = (v: number) => { dv.setUint16(p, v, true); p += 2; };
  const i32 = (v: number) => { dv.setInt32(p, v, true); p += 4; };
  const i16 = (v: number) => { dv.setInt16(p, v, true); p += 2; };

  const usPerFrame = Math.round(1_000_000 / fps);

  cc('RIFF'); u32(riff); cc('AVI ');
  cc('LIST'); u32(hdrl); cc('hdrl');
  cc('avih'); u32(AVIH);
  u32(usPerFrame); u32(maxChunk * fps); u32(0); u32(0x10);
  u32(numFrames); u32(0); u32(1); u32(maxChunk); u32(width); u32(height);
  u32(0); u32(0); u32(0); u32(0);

  cc('LIST'); u32(strl); cc('strl');
  cc('strh'); u32(STRH);
  cc('vids'); cc('MJPG'); u32(0); u16(0); u16(0); u32(0);
  u32(1); u32(fps); u32(0); u32(numFrames); u32(maxChunk);
  i32(-1); u32(0); i16(0); i16(0); i16(width); i16(height);

  cc('strf'); u32(STRF);
  u32(40); i32(width); i32(height); u16(1); u16(24); cc('MJPG');
  u32(width * height * 3); i32(0); i32(0); u32(0); u32(0);

  cc('LIST'); u32(movi); cc('movi');

  const offsets: number[] = [];
  let off = 4;
  for (let i = 0; i < numFrames; i++) {
    offsets.push(off);
    cc('00dc'); u32(jpegFrames[i].length);
    u8.set(jpegFrames[i], p); p += jpegFrames[i].length;
    if (jpegFrames[i].length % 2) dv.setUint8(p++, 0);
    off += 8 + padded[i];
  }

  cc('idx1'); u32(idx1);
  for (let i = 0; i < numFrames; i++) {
    cc('00dc'); u32(0x10); u32(offsets[i]); u32(jpegFrames[i].length);
  }

  return u8;
}

async function encodeAVIFallback(
  frames: FrameInput[],
  onProgress: ProgressCallback,
  addWatermark: boolean,
  options: EncodeOptions = {}
): Promise<{ data: Uint8Array; ext: string; mime: string; width: number; height: number }> {
  const firstDimensions = await getFirstFrameDimensions(frames);
  const targetDimensions = fitDimensions(
    firstDimensions.width,
    firstDimensions.height,
    options.maxWidth,
    options.maxHeight
  );
  const { width, height } = padDimensions(targetDimensions.width, targetDimensions.height);

  const { canvas, ctx } = createCanvas(width, height);
  const jpegFrames: Uint8Array[] = [];

  // Holds reuse a single JPEG reference, so repeating a static frame does not
  // duplicate its bytes in memory until the AVI buffer is assembled.
  const emit = async (cnv: HTMLCanvasElement, repeat: number) => {
    const jpeg = await canvasToJPEG(cnv, options.jpegQuality ?? 0.9);
    for (let r = 0; r < repeat; r++) jpegFrames.push(jpeg);
  };

  await renderTimeline(
    frames,
    ctx,
    canvas,
    width,
    height,
    targetDimensions.width,
    targetDimensions.height,
    addWatermark,
    onProgress,
    emit,
    options
  );

  return {
    data: buildMJPEGAVI(jpegFrames, width, height, options.fps ?? FPS),
    ext: 'avi',
    mime: 'video/avi',
    width,
    height,
  };
}

function pushString(out: number[], value: string) {
  for (let i = 0; i < value.length; i++) out.push(value.charCodeAt(i) & 0xff);
}

function pushU16(out: number[], value: number) {
  out.push(value & 0xff, (value >> 8) & 0xff);
}

function writeGifSubBlocks(out: number[], bytes: number[]) {
  for (let i = 0; i < bytes.length; i += 255) {
    const block = bytes.slice(i, i + 255);
    out.push(block.length, ...block);
  }
  out.push(0);
}

function encodeGifLzw(indices: Uint8Array, minCodeSize: number): number[] {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  const output: number[] = [];
  let dictionary = new Map<string, number>();
  let codeSize = minCodeSize + 1;
  let nextCode = endCode + 1;
  let bitBuffer = 0;
  let bitCount = 0;

  const resetDictionary = () => {
    dictionary = new Map<string, number>();
    for (let i = 0; i < clearCode; i++) dictionary.set(String(i), i);
    codeSize = minCodeSize + 1;
    nextCode = endCode + 1;
  };

  const writeCode = (code: number) => {
    bitBuffer |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      output.push(bitBuffer & 0xff);
      bitBuffer >>= 8;
      bitCount -= 8;
    }
  };

  resetDictionary();
  writeCode(clearCode);
  let prefix = String(indices[0]);
  for (let i = 1; i < indices.length; i++) {
    const current = String(indices[i]);
    const combo = `${prefix},${current}`;
    if (dictionary.has(combo)) {
      prefix = combo;
      continue;
    }

    writeCode(dictionary.get(prefix) ?? Number(prefix));

    if (nextCode < 4096) {
      dictionary.set(combo, nextCode++);
      if (nextCode === (1 << codeSize) && codeSize < 12) codeSize++;
    } else {
      writeCode(clearCode);
      resetDictionary();
    }

    prefix = current;
  }
  writeCode(dictionary.get(prefix) ?? Number(prefix));
  writeCode(endCode);

  if (bitCount > 0) output.push(bitBuffer & 0xff);
  return output;
}

function canvasToGifIndices(canvas: HTMLCanvasElement, width: number, height: number): Uint8Array {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to read GIF frame');
  const data = ctx.getImageData(0, 0, width, height).data;
  const indices = new Uint8Array(width * height);
  for (let source = 0, target = 0; source < data.length; source += 4, target++) {
    const r = data[source] >> 6;
    const g = data[source + 1] >> 6;
    const b = data[source + 2] >> 6;
    indices[target] = (r << 4) | (g << 2) | b;
  }
  return indices;
}

function buildGif(frames: Uint8Array[], width: number, height: number, delayCs: number): Uint8Array {
  const out: number[] = [];
  pushString(out, 'GIF89a');
  pushU16(out, width);
  pushU16(out, height);
  out.push(0xf5, 0, 0);

  for (let r = 0; r < 4; r++) {
    for (let g = 0; g < 4; g++) {
      for (let b = 0; b < 4; b++) {
        out.push(r * 85, g * 85, b * 85);
      }
    }
  }

  pushString(out, '!\xff\x0bNETSCAPE2.0\x03\x01');
  pushU16(out, 0);
  out.push(0);

  for (const frame of frames) {
    out.push(0x21, 0xf9, 0x04, 0x04);
    pushU16(out, delayCs);
    out.push(0, 0);
    out.push(0x2c);
    pushU16(out, 0);
    pushU16(out, 0);
    pushU16(out, width);
    pushU16(out, height);
    out.push(0);
    out.push(6);
    writeGifSubBlocks(out, encodeGifLzw(frame, 6));
  }

  out.push(0x3b);
  return new Uint8Array(out);
}

async function encodeGIF(
  frames: FrameInput[],
  onProgress: ProgressCallback,
  addWatermark: boolean,
  options: EncodeOptions = {}
): Promise<{ data: Uint8Array; width: number; height: number }> {
  const firstDimensions = await getFirstFrameDimensions(frames);
  const maxWidth = Math.min(options.maxWidth ?? 720, 720);
  const maxHeight = Math.min(options.maxHeight ?? 720, 720);
  const targetDimensions = fitDimensions(firstDimensions.width, firstDimensions.height, maxWidth, maxHeight);
  const { width, height } = targetDimensions;
  const { canvas, ctx } = createCanvas(width, height);
  const gifFrames: Uint8Array[] = [];
  const fps = options.fps ?? GIF_FPS;

  const emit = async (cnv: HTMLCanvasElement, repeat: number) => {
    const indices = canvasToGifIndices(cnv, width, height);
    const compactRepeat = Math.max(1, Math.ceil(repeat / Math.max(1, Math.round(FPS / fps))));
    for (let r = 0; r < compactRepeat; r++) gifFrames.push(indices);
  };

  await renderTimeline(
    frames,
    ctx,
    canvas,
    width,
    height,
    targetDimensions.width,
    targetDimensions.height,
    addWatermark,
    onProgress,
    emit,
    { ...options, fps }
  );

  const delayCs = Math.max(2, Math.round(100 / fps));
  return { data: buildGif(gifFrames, width, height, delayCs), width, height };
}

async function transcodeAVIToMP4(
  data: Uint8Array,
  resolution?: string,
  frameCount?: number,
  anonymousId?: string,
  exportId?: string,
  projectId?: string,
  options: EncodeOptions = {},
): Promise<{ data: Uint8Array; uploadDurationMs: number | null; transcodeDurationMs: number | null }> {
  const headers: Record<string, string> = {
    'Content-Type': 'video/avi'
  };

  // Preserve compatibility headers used by the backend for routing and usage
  // tracking, but do not send the user email from the client encoder.
  if (resolution) headers['x-resolution'] = resolution;
  if (frameCount) headers['x-frame-count'] = frameCount.toString();
  if (anonymousId) headers['x-anonymous-id'] = anonymousId;
  if (exportId) headers['x-export-id'] = exportId;
  if (projectId) headers['x-project-id'] = projectId;
  headers['x-plugin-version'] = PLUGIN_VERSION;

  const body = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let response: Response;
    const uploadStartedAt = Date.now();
    options.onTelemetry?.({
      eventType: 'upload_started',
      metadata: {
        export_id: exportId || null,
        payload_bytes: data.byteLength,
        retry_attempt: attempt,
      },
    });
    try {
      response = await fetch(`${BACKEND_URL}/api/encode-video`, {
        method: 'POST',
        headers,
        body,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Network request failed';
      if (attempt < maxAttempts) {
        await sleep(500);
        continue;
      }
      throw new Error(`BACKEND_TRANSCODE: ${message}`);
    }

    if (response.ok) {
      const result = new Uint8Array(await response.arrayBuffer());
      options.onTelemetry?.({
        eventType: 'upload_completed',
        metadata: {
          export_id: exportId || null,
          payload_bytes: data.byteLength,
          upload_duration_ms: Date.now() - uploadStartedAt,
          transcode_duration_ms: Number(response.headers.get('x-processing-time')) || null,
          retry_attempt: attempt,
        },
      });
      return {
        data: result,
        uploadDurationMs: Date.now() - uploadStartedAt,
        transcodeDurationMs: Number(response.headers.get('x-processing-time')) || null,
      };
    }

    let message = 'MP4 conversion failed. Please try again.';
    let backendErrorCode: string | null = null;
    let inputSizeMB: number | null = null;
    let backendFrameCount: number | null = null;
    let backendResolution: string | null = null;

    try {
      const error = await response.json();
      if (error?.error) message = error.error;
      if (error?.code) backendErrorCode = String(error.code);
      if (error?.inputSizeMB !== undefined) inputSizeMB = error.inputSizeMB;
      if (error?.frameCount !== undefined) backendFrameCount = error.frameCount;
      if (error?.resolution) backendResolution = error.resolution;
    } catch (_e) {
      message = `Server returned HTTP ${response.status}`;
    }

    const retryable = response.status >= 500 || response.status === 429 || response.status === 408;
    if (attempt < maxAttempts && retryable) {
      await sleep(750);
      continue;
    }

    // Include context in the error message for better diagnostics
    const contextParts = [
      `msg:${message}`,
      backendErrorCode ? `code:${backendErrorCode}` : null,
      inputSizeMB ? `size:${inputSizeMB}mb` : null,
      backendFrameCount ? `frames:${backendFrameCount}` : null,
      backendResolution ? `res:${backendResolution}` : null
    ].filter(Boolean);

    throw new Error(`BACKEND_TRANSCODE: ${contextParts.join('|')}`);
  }

  throw new Error('BACKEND_TRANSCODE: MP4 conversion failed after retry');
}

async function buildFallbackUpload(
  frames: FrameInput[],
  onProgress: ProgressCallback,
  addWatermark: boolean,
  effectiveOptions: EncodeOptions,
  userContext?: EncodeUserContext
): Promise<{ data: Uint8Array; ext: string; mime: string; width: number; height: number; profileName: string }> {
  let largestRejected: { sizeMB: string; profileName: string } | null = null;
  effectiveOptions.onTelemetry?.({
    eventType: 'payload_preflight_started',
    metadata: {
      export_id: userContext?.exportId || null,
      frame_count: frames.length,
      max_payload_bytes: BACKEND_MAX_UPLOAD_BYTES,
      resolution: userContext?.resolution || null,
    },
  });

  for (const profile of FALLBACK_PROFILES) {
    const fallbackOptions: EncodeOptions = {
      ...effectiveOptions,
      disableTransitions: true,
      maxWidth: Math.min(effectiveOptions.maxWidth ?? profile.maxWidth, profile.maxWidth),
      maxHeight: Math.min(effectiveOptions.maxHeight ?? profile.maxHeight, profile.maxHeight),
      holdSeconds: Math.min(effectiveOptions.holdSeconds ?? profile.holdSeconds, profile.holdSeconds),
      jpegQuality: Math.min(effectiveOptions.jpegQuality ?? profile.jpegQuality, profile.jpegQuality),
      fps: Math.min(effectiveOptions.fps ?? profile.fps, profile.fps),
    };
    const result = await encodeAVIFallback(frames, onProgress, addWatermark, fallbackOptions);
    if (result.ext !== 'avi' || result.mime !== 'video/avi') {
      throw new Error('Video conversion failed');
    }
    const preflight = getPayloadPreflight(result.data.byteLength, BACKEND_MAX_UPLOAD_BYTES);
    if (preflight.status !== 'too_large') {
      effectiveOptions.onTelemetry?.({
        eventType: 'payload_preflight_completed',
        metadata: {
          export_id: userContext?.exportId || null,
          payload_bytes: preflight.payloadBytes,
          max_payload_bytes: preflight.maxBytes,
          profile: profile.name,
          status: preflight.status,
        },
      });
      return { ...result, profileName: profile.name };
    }

    largestRejected = {
      sizeMB: (result.data.byteLength / (1024 * 1024)).toFixed(1),
      profileName: profile.name,
    };
    onProgress(Math.min(95, 88 + FALLBACK_PROFILES.indexOf(profile) * 3));
  }

  const sizeMB = largestRejected?.sizeMB || 'unknown';
  const profileName = largestRejected?.profileName || 'unknown';
  const largestBytes = largestRejected ? Math.round(Number(largestRejected.sizeMB) * 1024 * 1024) : null;
  effectiveOptions.onTelemetry?.({
    eventType: 'payload_preflight_failed',
    metadata: {
      export_id: userContext?.exportId || null,
      payload_bytes: largestBytes,
      max_payload_bytes: BACKEND_MAX_UPLOAD_BYTES,
      failure_reason: 'payload_too_large',
      profile: profileName,
    },
  });
  throw new Error(
    `BACKEND_TRANSCODE: msg:AVI payload too large to upload [payload_too_large]` +
    `|size:${sizeMB}mb|frames:${frames.length}|res:${userContext?.resolution ?? 'unknown'}|profile:${profileName}|hint:optimize_before_render`
  );
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Encode prototype frames to video.
 * Tries H.264 MP4 via WebCodecs first; falls back to backend MP4 transcode.
 * Synthesized screen transition effects (fade/slide) are inserted between
 * frames based on each frame's captured prototype transition.
 * @param isPremium - when false, a watermark is burned into the video
 * @param userContext - optional user information for usage monitoring
 */
export async function encodeVideo(
  frames: FrameInput[],
  settings: EncodeSettings,
  onProgress: ProgressCallback,
  isPremium: boolean = false,
  userContext?: EncodeUserContext,
  options: EncodeOptions = {}
): Promise<{
  url: string;
  filename: string;
  width: number;
  height: number;
  deliveryProfile: 'requested' | 'fallback';
  fileSizeBytes: number;
  payloadBytes?: number | null;
  uploadDurationMs?: number | null;
  transcodeDurationMs?: number | null;
}> {
  if (!frames.length) throw new Error('No frames to encode');

  const addWatermark = !isPremium;
  const stamp = Date.now();
  const effectiveOptions: EncodeOptions = options.safeMode
    ? {
        forceBackend: true,
        disableTransitions: true,
        maxWidth: 1280,
        maxHeight: 720,
        holdSeconds: 1,
        jpegQuality: 0.82,
        ...options,
      }
    : options;

  if (settings.format === 'gif') {
    const gif = await encodeGIF(frames, onProgress, addWatermark, {
      ...effectiveOptions,
      disableTransitions: effectiveOptions.disableTransitions,
      maxWidth: Math.min(effectiveOptions.maxWidth ?? 720, 720),
      maxHeight: Math.min(effectiveOptions.maxHeight ?? 720, 720),
      fps: Math.min(effectiveOptions.fps ?? GIF_FPS, GIF_FPS),
    });
    const blob = new Blob([gif.data as unknown as BlobPart], { type: 'image/gif' });
    onProgress(100);
    return {
      url: URL.createObjectURL(blob),
      filename: `protovid-export-${stamp}.gif`,
      width: gif.width,
      height: gif.height,
      deliveryProfile: effectiveOptions.maxWidth || effectiveOptions.maxHeight ? 'fallback' : 'requested',
      fileSizeBytes: blob.size,
      payloadBytes: null,
      uploadDurationMs: null,
      transcodeDurationMs: null,
    };
  }

  if (settings.format === 'webm') {
    if (typeof VideoEncoder === 'undefined') {
      throw new Error('WebM export requires WebCodecs support in this browser');
    }
    const webm = await encodeWebMWebCodecs(frames, onProgress, addWatermark, effectiveOptions);
    const blob = new Blob([webm.data as unknown as BlobPart], { type: 'video/webm' });
    onProgress(100);
    return {
      url: URL.createObjectURL(blob),
      filename: `protovid-export-${stamp}.webm`,
      width: webm.width,
      height: webm.height,
      deliveryProfile: effectiveOptions.maxWidth || effectiveOptions.maxHeight ? 'fallback' : 'requested',
      fileSizeBytes: blob.size,
      payloadBytes: null,
      uploadDurationMs: null,
      transcodeDurationMs: null,
    };
  }

  // 1. Try WebCodecs H.264 MP4 first (best compatibility)
  if (!effectiveOptions.forceBackend && typeof VideoEncoder !== 'undefined') {
    try {
      const mp4 = await encodeMP4WebCodecs(frames, onProgress, addWatermark, effectiveOptions);
      const blob = new Blob([mp4.data as unknown as BlobPart], { type: 'video/mp4' });
      onProgress(100);
      return {
        url: URL.createObjectURL(blob),
        filename: `protovid-export-${stamp}.mp4`,
        width: mp4.width,
        height: mp4.height,
      deliveryProfile: effectiveOptions.maxWidth || effectiveOptions.maxHeight ? 'fallback' : 'requested',
      fileSizeBytes: blob.size,
        payloadBytes: null,
        uploadDurationMs: null,
        transcodeDurationMs: null,
      };
    } catch (_e) {
      // H.264 unavailable — fall back to backend transcode.
    }
  }

  // 2. Fallback: MJPEG AVI -> backend FFmpeg -> H.264 MP4.
  // The backend has a hard upload cap, so the fallback is always encoded lean:
  // no transitions, 720p-capped, low frame rate. This is what the majority of
  // failing exports funnel into (users whose browser lacks H.264 WebCodecs),
  // so keeping the AVI small is the difference between success and a rejected
  // upload — the output is a static slideshow either way.
  const fallback = await buildFallbackUpload(
    frames,
    onProgress,
    addWatermark,
    effectiveOptions,
    userContext
  );

  onProgress(96);
  const transcode = await transcodeAVIToMP4(
    fallback.data,
    userContext?.resolution,
    frames.length,
    userContext?.anonymousId,
    userContext?.exportId,
    userContext?.projectId,
    effectiveOptions,
  );
  const blob = new Blob([transcode.data as unknown as BlobPart], { type: 'video/mp4' });
  onProgress(100);
  return {
    url: URL.createObjectURL(blob),
    filename: `protovid-export-${stamp}.mp4`,
    width: fallback.width,
    height: fallback.height,
    deliveryProfile: 'fallback',
    fileSizeBytes: blob.size,
    payloadBytes: fallback.data.byteLength,
    uploadDurationMs: transcode.uploadDurationMs,
    transcodeDurationMs: transcode.transcodeDurationMs,
  };
}
