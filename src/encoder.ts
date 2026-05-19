// ProtoVid - Client-side video encoder (runs in UI iframe context)
// Primary: WebCodecs API (VideoEncoder) + mp4-muxer -> H.264 MP4 (no server needed)
// Fallback: pure-JS MJPEG AVI, then backend FFmpeg transcode to MP4

import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
interface FrameInput {
  imageData: Uint8Array;
  width: number;
  height: number;
}

interface EncodeSettings {
  format: 'mp4';
  frameRate: 30 | 60;
}

type ProgressCallback = (percent: number) => void;

// Each prototype frame is held for this many seconds in the output video
const FRAME_HOLD_SECONDS = 2;
const BACKEND_URL = 'https://protovid.dasgroupllc.com';

async function loadPNG(data: Uint8Array): Promise<ImageBitmap> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data as any);
  const blob = new Blob([bytes], { type: 'image/png' });
  return createImageBitmap(blob);
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
  const fontSize = Math.max(16, Math.round(height * 0.028));
  ctx.save();

  const barHeight = fontSize * 2.2;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.fillRect(0, height - barHeight, width, barHeight);

  ctx.font = `600 ${fontSize}px Inter, -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.fillText('Made with love by ProtoVid - protovid.dasgroupllc.com', width / 2, height - barHeight / 2);

  ctx.restore();
}

// ─── Primary path: H.264 MP4 via WebCodecs ───────────────────────────────────

async function encodeMP4WebCodecs(
  frames: FrameInput[],
  onProgress: ProgressCallback,
  addWatermark: boolean
): Promise<Uint8Array> {
  const first = await loadPNG(frames[0].imageData);
  const width = first.width;
  const height = first.height;
  first.close();

  const fps = 1;

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width, height, frameRate: fps },
    fastStart: 'in-memory',
  });

  let encodeError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { encodeError = e; },
  });

  encoder.configure({
    codec: 'avc1.42001f', // H.264 Baseline Profile Level 3.1
    width,
    height,
    bitrate: 2_000_000,
    framerate: fps,
    avc: { format: 'avc' },
  });

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create canvas context');

  let frameIndex = 0;
  for (let i = 0; i < frames.length; i++) {
    if (encodeError) throw encodeError;

    const bmp = await loadPNG(frames[i].imageData);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(bmp, 0, 0, width, height);
    bmp.close();

    if (addWatermark) drawWatermark(ctx, width, height);

    const snapshot = await createImageBitmap(canvas);
    for (let t = 0; t < FRAME_HOLD_SECONDS; t++) {
      const videoFrame = new VideoFrame(snapshot, {
        timestamp: frameIndex * 1_000_000,
        duration: 1_000_000,
      });
      encoder.encode(videoFrame, { keyFrame: frameIndex === 0 });
      videoFrame.close();
      frameIndex++;
    }
    snapshot.close();

    onProgress(20 + ((i + 1) / frames.length) * 75);
  }

  await encoder.flush();
  if (encodeError) throw encodeError;
  muxer.finalize();

  return new Uint8Array(target.buffer);
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
  addWatermark: boolean
): Promise<{ data: Uint8Array; ext: string; mime: string }> {
  const first = await loadPNG(frames[0].imageData);
  const width = first.width;
  const height = first.height;
  first.close();

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create canvas context');

  const fps = 1;
  const jpegFrames: Uint8Array[] = [];

  for (let i = 0; i < frames.length; i++) {
    const bmp = await loadPNG(frames[i].imageData);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(bmp, 0, 0, width, height);
    bmp.close();

    if (addWatermark) drawWatermark(ctx, width, height);

    const jpeg = await canvasToJPEG(canvas, 0.92);
    for (let t = 0; t < FRAME_HOLD_SECONDS; t++) jpegFrames.push(jpeg);

    onProgress(20 + ((i + 1) / frames.length) * 75);
  }

  return {
    data: buildMJPEGAVI(jpegFrames, width, height, fps),
    ext: 'avi',
    mime: 'video/avi',
  };
}

async function transcodeAVIToMP4(data: Uint8Array): Promise<Uint8Array> {
  const response = await fetch(`${BACKEND_URL}/api/encode-video`, {
    method: 'POST',
    headers: { 'Content-Type': 'video/avi' },
    body: data,
  });

  if (!response.ok) {
    let message = 'MP4 conversion failed. Please try again.';
    try {
      const error = await response.json();
      if (error?.error) message = error.error;
    } catch (_e) {
      // Keep the generic error.
    }
    throw new Error(message);
  }

  return new Uint8Array(await response.arrayBuffer());
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Encode prototype frames to video.
 * Tries H.264 MP4 via WebCodecs first; falls back to backend MP4 transcode.
 * @param isPremium - when false, a watermark is burned into the video
 */
export async function encodeVideo(
  frames: FrameInput[],
  settings: EncodeSettings,
  onProgress: ProgressCallback,
  isPremium: boolean = false
): Promise<{ url: string; filename: string }> {
  if (!frames.length) throw new Error('No frames to encode');

  const addWatermark = !isPremium;

  const stamp = Date.now();

  // 1. Try WebCodecs H.264 MP4 first (best compatibility)
  if (typeof VideoEncoder !== 'undefined') {
    try {
      const mp4Data = await encodeMP4WebCodecs(frames, onProgress, addWatermark);
      const blob = new Blob([mp4Data], { type: 'video/mp4' });
      onProgress(100);
      return { url: URL.createObjectURL(blob), filename: `protovid-export-${stamp}.mp4` };
    } catch (_e) {
      // H.264 unavailable — try VP8 next
    }

    // VP8/WebM is intentionally skipped here so the product delivers the MP4
    // format promised in the marketplace listing.
  }

  // 2. Fallback: MJPEG AVI -> backend FFmpeg -> H.264 MP4
  const { data, ext, mime } = await encodeAVIFallback(frames, onProgress, addWatermark);
  if (ext !== 'avi' || mime !== 'video/avi') throw new Error('Video conversion failed');
  onProgress(96);
  const mp4Data = await transcodeAVIToMP4(data);
  const blob = new Blob([mp4Data], { type: 'video/mp4' });
  onProgress(100);
  return { url: URL.createObjectURL(blob), filename: `protovid-export-${stamp}.mp4` };
}
