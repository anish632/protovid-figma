// Next.js API Route - Video Encoding with FFmpeg
// Deploy to Vercel at /api/encode-video

import type { NextApiRequest, NextApiResponse } from 'next';

interface Frame {
  nodeId: string;
  nodeName: string;
  imageBase64: string;
  width: number;
  height: number;
}

interface EncodingRequest {
  frames: Frame[];
  settings: {
    resolution: '720p' | '1080p' | '4K';
    frameRate: 30 | 60;
    format: 'mp4' | 'gif';
    showCursor: boolean;
  };
  isPremium: boolean;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { frames, settings, isPremium }: EncodingRequest = req.body;

    // Validate request
    if (!frames || frames.length === 0) {
      return res.status(400).json({ error: 'No frames provided' });
    }

    // Free tier restrictions
    if (!isPremium) {
      if (settings.resolution !== '720p') {
        return res.status(403).json({ error: 'HD/4K requires Premium' });
      }
      if (settings.format === 'gif') {
        return res.status(403).json({ error: 'GIF export requires Premium' });
      }
    }

    // TODO: Implement actual FFmpeg encoding
    // This would:
    // 1. Convert base64 frames to image files
    // 2. Use FFmpeg to encode video:
    //    ffmpeg -framerate ${settings.frameRate} -i frame_%d.png -c:v libx264 -pix_fmt yuv420p output.mp4
    // 3. Add watermark for free tier (unless isPremium)
    // 4. Upload to storage (S3, R2, etc.)
    // 5. Return download URL

    // For now, return mock response
    const mockVideoUrl = `https://storage.protovid.app/videos/${Date.now()}.${settings.format}`;

    res.status(200).json({
      success: true,
      url: mockVideoUrl,
      size: frames.length * 100000, // Mock file size
      duration: frames.length / settings.frameRate
    });

  } catch (error) {
    console.error('Video encoding error:', error);
    res.status(500).json({ 
      error: 'Video encoding failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Example FFmpeg implementation (requires ffmpeg-static or fluent-ffmpeg):
/*
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

async function encodeWithFFmpeg(frames: Frame[], settings: any, isPremium: boolean) {
  const tempDir = path.join('/tmp', `protovid-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  // Write frames to temp files
  for (let i = 0; i < frames.length; i++) {
    const buffer = Buffer.from(frames[i].imageBase64, 'base64');
    fs.writeFileSync(path.join(tempDir, `frame_${i}.png`), buffer);
  }

  const outputPath = path.join(tempDir, `output.${settings.format}`);
  
  const ffmpegArgs = [
    '-framerate', settings.frameRate.toString(),
    '-i', path.join(tempDir, 'frame_%d.png'),
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'medium',
    '-crf', '23'
  ];

  // Add watermark for free tier
  if (!isPremium) {
    ffmpegArgs.push(
      '-vf', 'drawtext=text="ProtoVid Free":x=10:y=H-th-10:fontsize=16:fontcolor=white@0.5'
    );
  }

  ffmpegArgs.push(outputPath);

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        const videoBuffer = fs.readFileSync(outputPath);
        // Upload to storage and return URL
        resolve({ url: 'https://...', buffer: videoBuffer });
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
      
      // Cleanup
      fs.rmSync(tempDir, { recursive: true });
    });
  });
}
*/
