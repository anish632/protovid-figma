// ProtoVid - Client-side video encoder (runs in UI iframe context)
// Uses gifenc for GIF and h264-mp4-encoder (WASM) for MP4.

import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import HME from 'h264-mp4-encoder';

interface FrameInput {
  imageData: Uint8Array;
  width: number;
  height: number;
}

interface EncodeSettings {
  format: 'mp4' | 'gif';
  frameRate: 30 | 60;
}

type ProgressCallback = (percent: number) => void;

// Each prototype frame is held for this many seconds in the output video
const FRAME_HOLD_SECONDS = 2;

async function loadPNG(data: Uint8Array): Promise<ImageBitmap> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data as any);
  const blob = new Blob([bytes], { type: 'image/png' });
  return createImageBitmap(blob);
}

function getCanvas(width: number, height: number): { canvas: HTMLCanvasElement | OffscreenCanvas; ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D } {
  try {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (ctx) return { canvas, ctx };
  } catch {}
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  return { canvas, ctx };
}

/**
 * Encode prototype frames as H.264 MP4 video using WASM encoder.
 */
async function encodeMP4(
  frames: FrameInput[],
  _settings: EncodeSettings,
  onProgress: ProgressCallback
): Promise<Uint8Array> {
  const first = await loadPNG(frames[0].imageData);
  // h264-mp4-encoder requires dimensions divisible by 2
  const width = first.width % 2 === 0 ? first.width : first.width - 1;
  const height = first.height % 2 === 0 ? first.height : first.height - 1;
  first.close();

  const encoder = await HME.createH264MP4Encoder();
  encoder.width = width;
  encoder.height = height;
  // 1 fps with each frame repeated FRAME_HOLD_SECONDS times = 2 second hold
  encoder.frameRate = 1;
  encoder.quantizationParameter = 20; // good quality
  encoder.initialize();

  const { canvas, ctx } = getCanvas(width, height);

  for (let i = 0; i < frames.length; i++) {
    const bmp = await loadPNG(frames[i].imageData);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(bmp, 0, 0, width, height);
    bmp.close();

    const imgData = ctx.getImageData(0, 0, width, height);

    // Add each frame FRAME_HOLD_SECONDS times (at 1fps = 2 seconds per frame)
    for (let t = 0; t < FRAME_HOLD_SECONDS; t++) {
      encoder.addFrameRgba(imgData.data as unknown as ArrayLike<number>);
    }

    onProgress(60 + ((i + 1) / frames.length) * 30);
  }

  encoder.finalize();
  const output = encoder.dup();
  encoder.delete();

  return output;
}

/**
 * Encode prototype frames as animated GIF.
 */
async function encodeGIF(
  frames: FrameInput[],
  _settings: EncodeSettings,
  onProgress: ProgressCallback
): Promise<Uint8Array> {
  const first = await loadPNG(frames[0].imageData);
  const width = first.width;
  const height = first.height;
  first.close();

  const gif = GIFEncoder();
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create canvas context');

  const delay = FRAME_HOLD_SECONDS * 100;

  for (let i = 0; i < frames.length; i++) {
    const bmp = await loadPNG(frames[i].imageData);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(bmp, 0, 0, width, height);
    bmp.close();

    const imgData = ctx.getImageData(0, 0, width, height);
    const palette = quantize(imgData.data, 256);
    const indexed = applyPalette(imgData.data, palette);

    gif.writeFrame(indexed, width, height, { palette, delay });
    onProgress(60 + ((i + 1) / frames.length) * 30);
  }

  gif.finish();
  return gif.bytesView();
}

/**
 * Main entry point — encode frames to the requested format.
 */
export async function encodeVideo(
  frames: FrameInput[],
  settings: EncodeSettings,
  onProgress: ProgressCallback
): Promise<{ url: string; filename: string }> {
  if (!frames.length) {
    throw new Error('No frames to encode');
  }

  let data: Uint8Array;
  let mime: string;
  let ext: string;

  if (settings.format === 'gif') {
    data = await encodeGIF(frames, settings, onProgress);
    mime = 'image/gif';
    ext = 'gif';
  } else {
    data = await encodeMP4(frames, settings, onProgress);
    mime = 'video/mp4';
    ext = 'mp4';
  }

  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const filename = `protovid-export-${Date.now()}.${ext}`;

  return { url, filename };
}
