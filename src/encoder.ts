// ProtoVid - Client-side video encoder (runs in UI iframe context)
// Uses h264-mp4-encoder (WASM) for MP4 — loaded via script tag, accessed as global.

declare var HME: { createH264MP4Encoder: () => Promise<any> };

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
  } catch (_e) {}
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
 * Main entry point — encode frames to MP4 video.
 */
export async function encodeVideo(
  frames: FrameInput[],
  settings: EncodeSettings,
  onProgress: ProgressCallback
): Promise<{ url: string; filename: string }> {
  if (!frames.length) {
    throw new Error('No frames to encode');
  }

  const data = await encodeMP4(frames, settings, onProgress);
  const blob = new Blob([data], { type: 'video/mp4' });
  const url = URL.createObjectURL(blob);
  const filename = `protovid-export-${Date.now()}.mp4`;

  return { url, filename };
}
