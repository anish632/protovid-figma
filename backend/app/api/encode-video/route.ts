import { NextRequest } from 'next/server';
import { execFile } from 'child_process';
import { writeFile, readFile, unlink } from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';

import ffmpeg from '@ffmpeg-installer/ffmpeg';

export const runtime = 'nodejs';
export const maxDuration = 30;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  const id = randomUUID();
  const inputPath = path.join('/tmp', `input-${id}.avi`);
  const outputPath = path.join('/tmp', `output-${id}.mp4`);

  try {
    // Read raw AVI binary from request body
    const body = await request.arrayBuffer();
    if (!body || body.byteLength === 0) {
      return Response.json(
        { error: 'No video data provided' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Write AVI to temp file
    await writeFile(inputPath, Buffer.from(body));

    // Transcode MJPEG AVI → H.264 MP4 via FFmpeg
    await new Promise<void>((resolve, reject) => {
      if (!ffmpeg.path) {
        reject(new Error('ffmpeg binary not found'));
        return;
      }

      execFile(
        ffmpeg.path,
        [
          '-y',                    // Overwrite output
          '-i', inputPath,         // Input AVI
          '-c:v', 'libx264',      // H.264 codec
          '-pix_fmt', 'yuv420p',  // Max compatibility
          '-movflags', '+faststart', // Moov atom at front for instant playback
          '-preset', 'ultrafast', // Fastest encoding (small files, fine quality)
          outputPath,
        ],
        { timeout: 25000 },
        (error, _stdout, stderr) => {
          if (error) {
            console.error('FFmpeg stderr:', stderr);
            reject(new Error(`FFmpeg failed: ${error.message}`));
          } else {
            resolve();
          }
        }
      );
    });

    // Read the output MP4
    const mp4Data = await readFile(outputPath);

    return new Response(mp4Data, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error('Transcode error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Transcoding failed' },
      { status: 500, headers: corsHeaders }
    );
  } finally {
    // Clean up temp files
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}
