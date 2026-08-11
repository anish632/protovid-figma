import { NextRequest } from 'next/server';
import { execFile } from 'child_process';
import { writeFile, readFile, unlink } from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';

import ffmpeg from '@ffmpeg-installer/ffmpeg';
import { trackExportUsage } from '@/lib/usageMonitoring';
import { recordEvent } from '@/lib/events';

export const runtime = 'nodejs';
export const maxDuration = 120;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-user-email, x-anonymous-id, x-resolution, x-frame-count, x-export-id, x-project-id, x-plugin-version',
};

const MAX_TRANSCODE_BYTES = 4_000_000;

function classifyTranscodeError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid data') || normalized.includes('moov atom not found')) return 'invalid_input';
  if (normalized.includes('out of memory') || normalized.includes('cannot allocate') || normalized.includes('array buffer')) return 'memory_limit';
  if (normalized.includes('timed out') || normalized.includes('timeout')) return 'timeout';
  if (normalized.includes('pixel format') || normalized.includes('unsupported')) return 'unsupported_format';
  if (normalized.includes('no such file') || normalized.includes('ffmpeg binary not found')) return 'ffmpeg_missing';
  return 'ffmpeg_error';
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  const id = randomUUID();
  const inputPath = path.join('/tmp', `input-${id}.avi`);
  const outputPath = path.join('/tmp', `output-${id}.mp4`);

  // The client encoder no longer sends user email here; keep the call
  // compatible by treating this as anonymous usage.
  const userEmail = request.headers.get('x-user-email') || 'anonymous';
  const anonymousId = request.headers.get('x-anonymous-id')?.slice(0, 128) || null;
  const exportId = request.headers.get('x-export-id')?.slice(0, 128) || null;
  const projectId = request.headers.get('x-project-id')?.slice(0, 255) || null;
  const pluginVersion = request.headers.get('x-plugin-version')?.slice(0, 32) || null;
  const resolution = request.headers.get('x-resolution') || 'unknown';
  const frameCount = parseInt(request.headers.get('x-frame-count') || '0');
  const startTime = Date.now();
  let inputSizeMB = 0;

  try {
    // Read raw AVI binary from request body
    const body = await request.arrayBuffer();
    inputSizeMB = body ? body.byteLength / (1024 * 1024) : 0;

    if (!body || body.byteLength === 0) {
      return Response.json(
        {
          error: 'No video data provided',
          inputSizeMB: Math.round(inputSizeMB * 100) / 100,
          frameCount
        },
        { status: 400, headers: corsHeaders }
      );
    }

    if (body.byteLength > MAX_TRANSCODE_BYTES) {
      return Response.json(
        {
          error: 'The fallback video is too large to process. Try a shorter path or 720p.',
          code: 'payload_too_large',
          inputSizeMB: Math.round(inputSizeMB * 100) / 100,
          frameCount,
          resolution,
        },
        { status: 413, headers: corsHeaders },
      );
    }

    if (exportId) {
      await recordEvent(null, 'transcode_started', {
        event_id: `${exportId}:transcode_started`,
        export_id: exportId,
        project_id: projectId,
        payload_bytes: body.byteLength,
        resolution,
        frame_count: frameCount,
        source: 'backend_transcode',
      }).catch(error => console.warn('Could not record transcode start:', error));
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
          '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', // Pad to even dimensions for H.264
          '-c:v', 'libx264',      // H.264 codec
          '-crf', '28',           // Favor smaller, faster fallback outputs
          '-pix_fmt', 'yuv420p',  // Max compatibility
          '-movflags', '+faststart', // Moov atom at front for instant playback
          '-preset', 'ultrafast', // Fastest encoding (small files, fine quality)
          outputPath,
        ],
        { timeout: 110000 },
        (error, _stdout, stderr) => {
          if (error) {
            console.error('FFmpeg stderr:', stderr);
            // Include stderr in error for diagnostics
            const ffmpegErrorMsg = stderr?.trim() || error.message;
            const errorCategory = classifyTranscodeError(ffmpegErrorMsg);
            reject(new Error(`FFmpeg failed [${errorCategory}]: ${ffmpegErrorMsg.slice(-1800)}`));
          } else {
            resolve();
          }
        }
      );
    });

    // Read the output MP4
    const mp4Data = await readFile(outputPath);

    // Track usage metrics for monitoring
    const processingTime = Date.now() - startTime;
    const videoSizeMB = mp4Data.length / (1024 * 1024);

    // Track export usage (especially for monitored users like Iva)
    await trackExportUsage(userEmail, {
      videoSizeMB: Math.round(videoSizeMB * 100) / 100, // Round to 2 decimals
      processingTimeMs: processingTime,
      resolution: resolution,
      frameCount: frameCount,
      exportId,
      projectId,
      pluginVersion,
    }, anonymousId);

    if (exportId) {
      await recordEvent(null, 'transcode_completed', {
        event_id: `${exportId}:transcode_completed`,
        export_id: exportId,
        project_id: projectId,
        payload_bytes: body.byteLength,
        video_size_bytes: mp4Data.length,
        processing_time_ms: processingTime,
        resolution,
        frame_count: frameCount,
        source: 'backend_transcode',
      }).catch(error => console.warn('Could not record transcode completion:', error));
    }

    return new Response(mp4Data, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'X-Processing-Time': processingTime.toString(),
        'X-Video-Size': videoSizeMB.toFixed(2),
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error('Transcode error:', error);
    if (exportId) {
      await recordEvent(null, 'export_failed', {
        event_id: `${exportId}:export_failed:transcode`,
        export_id: exportId,
        project_id: projectId,
        plugin_version: pluginVersion,
        reason: 'backend_transcode_failed',
        error_code: error instanceof Error ? classifyTranscodeError(error.message) : 'transcode_failed',
        resolution,
        frame_count: frameCount,
      }).catch(recordingError => console.warn('Could not record transcode failure:', recordingError));
    }
    return Response.json(
      {
        error: error instanceof Error ? error.message : 'Transcoding failed',
        code: error instanceof Error ? classifyTranscodeError(error.message) : 'transcode_failed',
        inputSizeMB: Math.round(inputSizeMB * 100) / 100,
        frameCount,
        resolution
      },
      { status: 500, headers: corsHeaders }
    );
  } finally {
    // Clean up temp files
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}
