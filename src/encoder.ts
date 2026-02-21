// ProtoVid - Client-side video encoder (runs in UI iframe context)

import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

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

function makeEven(n: number): number {
  return n % 2 === 0 ? n : n + 1;
}

async function encodeMP4(
  frames: FrameInput[],
  settings: EncodeSettings,
  onProgress: ProgressCallback
): Promise<Uint8Array> {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
    throw new Error(
      'WebCodecs API not available in this environment. Try updating Figma or use GIF format instead.'
    );
  }
  if (typeof OffscreenCanvas === 'undefined') {
    throw new Error(
      'OffscreenCanvas not available. Try updating Figma or use GIF format instead.'
    );
  }

  const first = await loadPNG(frames[0].imageData);
  // H.264 requires even dimensions
  const width = makeEven(first.width);
  const height = makeEven(first.height);
  first.close();

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width, height },
    fastStart: 'in-memory',
  });

  let encError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { encError = e; },
  });

  encoder.configure({
    codec: 'avc1.42001f', // H.264 Baseline Profile Level 3.1
    width,
    height,
    bitrate: 5_000_000,
    framerate: settings.frameRate,
  });

  const holdUs = FRAME_HOLD_SECONDS * 1_000_000; // microseconds per prototype frame
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;

  for (let i = 0; i < frames.length; i++) {
    if (encError) throw encError;

    const bmp = await loadPNG(frames[i].imageData);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(bmp, 0, 0, width, height);
    bmp.close();

    const vf = new VideoFrame(canvas, {
      timestamp: i * holdUs,
      duration: holdUs,
    });
    encoder.encode(vf, { keyFrame: true });
    vf.close();

    onProgress(60 + ((i + 1) / frames.length) * 30);
  }

  await encoder.flush();
  encoder.close();
  if (encError) throw encError;

  muxer.finalize();
  return new Uint8Array(target.buffer);
}

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
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;

  // GIF delay is in centiseconds (1/100 sec). 2 seconds = 200.
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

export async function encodeVideo(
  frames: FrameInput[],
  settings: EncodeSettings,
  onProgress: ProgressCallback
): Promise<{ url: string; filename: string }> {
  if (!frames.length) {
    throw new Error('No frames to encode');
  }

  const data = settings.format === 'gif'
    ? await encodeGIF(frames, settings, onProgress)
    : await encodeMP4(frames, settings, onProgress);

  const mime = settings.format === 'gif' ? 'image/gif' : 'video/mp4';
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const filename = `protovid-export-${Date.now()}.${settings.format}`;

  return { url, filename };
}
