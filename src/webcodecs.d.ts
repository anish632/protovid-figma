// Minimal WebCodecs type declarations for the Figma plugin iframe environment.
// Figma's @figma/plugin-typings does not include the WebCodecs API.

interface VideoEncoderConfig {
  codec: string;
  width: number;
  height: number;
  bitrate?: number;
  framerate?: number;
  avc?: { format: 'avc' | 'annexb' };
}

interface VideoEncoderEncodeOptions {
  keyFrame?: boolean;
}

interface EncodedVideoChunkMetadata {
  decoderConfig?: {
    codec: string;
    description?: ArrayBuffer | ArrayBufferView;
    [key: string]: unknown;
  };
}

declare class EncodedVideoChunk {
  readonly timestamp: number;
  readonly duration: number | null;
  readonly type: 'key' | 'delta';
  readonly byteLength: number;
  copyTo(destination: ArrayBuffer | ArrayBufferView): void;
}

interface VideoEncoderInit {
  output: (chunk: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata) => void;
  error: (error: Error) => void;
}

declare class VideoEncoder {
  constructor(init: VideoEncoderInit);
  configure(config: VideoEncoderConfig): void;
  encode(frame: VideoFrame, options?: VideoEncoderEncodeOptions): void;
  flush(): Promise<void>;
  close(): void;
  static isConfigSupported(config: VideoEncoderConfig): Promise<{ supported: boolean }>;
}

interface VideoFrameInit {
  timestamp: number;
  duration?: number;
}

declare class VideoFrame {
  constructor(source: ImageBitmap | HTMLCanvasElement, init: VideoFrameInit);
  close(): void;
}
