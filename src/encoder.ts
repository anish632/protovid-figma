// ProtoVid - Client-side video encoder (runs in UI iframe context)
// Pure JS MJPEG AVI encoder — no WASM, no eval, works in Figma's restricted iframe.

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

/**
 * Build an AVI file with MJPEG video stream from JPEG frames.
 * Pure JS — only needs ArrayBuffer, no browser media APIs.
 */
function createMJPEGAVI(
  jpegFrames: Uint8Array[],
  width: number,
  height: number,
  fps: number
): Uint8Array {
  const numFrames = jpegFrames.length;
  const maxChunk = Math.max(...jpegFrames.map(f => f.length));
  // AVI chunks must be word-aligned (2-byte)
  const padded = jpegFrames.map(f => f.length + (f.length % 2));

  /* ---- section sizes ---- */
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

  /* ---- RIFF / AVI ---- */
  cc('RIFF'); u32(riff); cc('AVI ');

  /* ---- hdrl LIST ---- */
  cc('LIST'); u32(hdrl); cc('hdrl');

  /* avih — Main AVI Header */
  cc('avih'); u32(AVIH);
  u32(usPerFrame);                    // dwMicroSecPerFrame
  u32(maxChunk * fps);                // dwMaxBytesPerSec (approx)
  u32(0);                             // dwPaddingGranularity
  u32(0x10);                          // dwFlags = AVIF_HASINDEX
  u32(numFrames);                     // dwTotalFrames
  u32(0);                             // dwInitialFrames
  u32(1);                             // dwStreams
  u32(maxChunk);                      // dwSuggestedBufferSize
  u32(width);                         // dwWidth
  u32(height);                        // dwHeight
  u32(0); u32(0); u32(0); u32(0);    // reserved

  /* ---- strl LIST ---- */
  cc('LIST'); u32(strl); cc('strl');

  /* strh — Stream Header */
  cc('strh'); u32(STRH);
  cc('vids');                         // fccType
  cc('MJPG');                         // fccHandler
  u32(0);                             // dwFlags
  u16(0); u16(0);                     // wPriority, wLanguage
  u32(0);                             // dwInitialFrames
  u32(1);                             // dwScale
  u32(fps);                           // dwRate → fps
  u32(0);                             // dwStart
  u32(numFrames);                     // dwLength
  u32(maxChunk);                      // dwSuggestedBufferSize
  i32(-1);                            // dwQuality (default)
  u32(0);                             // dwSampleSize
  i16(0); i16(0); i16(width); i16(height); // rcFrame

  /* strf — BITMAPINFOHEADER */
  cc('strf'); u32(STRF);
  u32(40);                            // biSize
  i32(width);                         // biWidth
  i32(height);                        // biHeight
  u16(1);                             // biPlanes
  u16(24);                            // biBitCount
  cc('MJPG');                         // biCompression
  u32(width * height * 3);            // biSizeImage
  i32(0); i32(0);                     // pels/meter
  u32(0); u32(0);                     // clr used/important

  /* ---- movi LIST ---- */
  cc('LIST'); u32(movi); cc('movi');

  const offsets: number[] = [];
  let off = 4; // byte offset from 'movi' fourcc
  for (let i = 0; i < numFrames; i++) {
    offsets.push(off);
    cc('00dc');
    u32(jpegFrames[i].length);
    u8.set(jpegFrames[i], p); p += jpegFrames[i].length;
    if (jpegFrames[i].length % 2) dv.setUint8(p++, 0);
    off += 8 + padded[i];
  }

  /* ---- idx1 — frame index ---- */
  cc('idx1'); u32(idx1);
  for (let i = 0; i < numFrames; i++) {
    cc('00dc');
    u32(0x10);                        // AVIIF_KEYFRAME
    u32(offsets[i]);
    u32(jpegFrames[i].length);
  }

  return u8;
}

/**
 * Encode prototype frames as MJPEG AVI video.
 * Converts each PNG frame → JPEG via Canvas, then wraps in AVI container.
 * Each prototype frame is repeated to hold for FRAME_HOLD_SECONDS.
 */
async function encodeAVI(
  frames: FrameInput[],
  _settings: EncodeSettings,
  onProgress: ProgressCallback
): Promise<Uint8Array> {
  const first = await loadPNG(frames[0].imageData);
  const width = first.width;
  const height = first.height;
  first.close();

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create canvas context');

  // Use 1 fps and repeat each frame FRAME_HOLD_SECONDS times
  const fps = 1;
  const jpegFrames: Uint8Array[] = [];

  for (let i = 0; i < frames.length; i++) {
    const bmp = await loadPNG(frames[i].imageData);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(bmp, 0, 0, width, height);
    bmp.close();

    const jpeg = await canvasToJPEG(canvas, 0.92);

    // Repeat frame for hold duration
    for (let t = 0; t < FRAME_HOLD_SECONDS; t++) {
      jpegFrames.push(jpeg);
    }

    onProgress(60 + ((i + 1) / frames.length) * 30);
  }

  return createMJPEGAVI(jpegFrames, width, height, fps);
}

/**
 * Main entry point — encode frames to video.
 */
export async function encodeVideo(
  frames: FrameInput[],
  settings: EncodeSettings,
  onProgress: ProgressCallback
): Promise<{ url: string; filename: string }> {
  if (!frames.length) {
    throw new Error('No frames to encode');
  }

  const data = await encodeAVI(frames, settings, onProgress);
  const blob = new Blob([data], { type: 'video/avi' });
  const url = URL.createObjectURL(blob);
  const filename = `protovid-export-${Date.now()}.avi`;

  return { url, filename };
}
