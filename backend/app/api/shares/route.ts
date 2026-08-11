import { NextRequest, NextResponse } from 'next/server';
import { emailSchema } from '@/lib/validation';
import { recordEvent } from '@/lib/events';
import { cleanupExpiredShares, createShare, MAX_SHARE_BYTES, normalizeShareExperimentVariant } from '@/lib/shareStorage';
import { getSubscription } from '@/lib/storage';
import { isPremiumSubscription } from '@/lib/plans';
import { createReviewRoom } from '@/lib/reviewStorage';

export const runtime = 'nodejs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-user-email, x-anonymous-id, x-filename, x-resolution, x-frame-count, x-start-frame-name, x-end-frame-name, x-estimated-duration-seconds, x-share-experiment-variant',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const rawEmail = request.headers.get('x-user-email');
    const parsedEmail = rawEmail ? emailSchema.safeParse(rawEmail) : null;
    const email = parsedEmail?.success ? parsedEmail.data : null;
    const anonymousId = request.headers.get('x-anonymous-id')?.slice(0, 128) || null;
    const resolution = request.headers.get('x-resolution') || '720p';
    const frameCount = Number.parseInt(request.headers.get('x-frame-count') || '0', 10);
    const estimatedDurationSeconds = Number.parseFloat(request.headers.get('x-estimated-duration-seconds') || '0');
    const startFrameName = request.headers.get('x-start-frame-name');
    const endFrameName = request.headers.get('x-end-frame-name');
    const experimentVariant = normalizeShareExperimentVariant(request.headers.get('x-share-experiment-variant'));
    const filename = request.headers.get('x-filename');
    const contentType = request.headers.get('content-type') || '';

    if (!contentType.toLowerCase().includes('video/mp4')) {
      return NextResponse.json({ error: 'Share upload must be an MP4 video', code: 'invalid_content_type' }, { status: 415, headers: corsHeaders });
    }

    const body = new Uint8Array(await request.arrayBuffer());
    if (!body.byteLength) {
      return NextResponse.json({ error: 'Share video is empty', code: 'empty_video' }, { status: 400, headers: corsHeaders });
    }
    if (body.byteLength > MAX_SHARE_BYTES) {
      return NextResponse.json({
        error: 'This MP4 is too large for a share link. Download the file instead.',
        code: 'share_payload_too_large',
        maxBytes: MAX_SHARE_BYTES,
      }, { status: 413, headers: corsHeaders });
    }

    await recordEvent(email, 'share_link_requested', {
      source: 'share_api',
      resolution,
      frame_count: Number.isFinite(frameCount) ? frameCount : 0,
      file_size_bytes: body.byteLength,
      ...(experimentVariant ? { experiment_variant: experimentVariant } : {}),
      ...(anonymousId ? { anonymousId } : {}),
    }).catch(error => console.warn('Share request analytics failed:', error));

    let paid = false;
    if (email) {
      const subscription = await getSubscription(email);
      paid = isPremiumSubscription(subscription);
    }

    await cleanupExpiredShares().catch(error => console.warn('Expired share cleanup failed:', error));

    const share = await createShare({
      video: body,
      email,
      anonymousId,
      filename,
      resolution,
      frameCount: Number.isFinite(frameCount) ? frameCount : 0,
      startFrameName,
      endFrameName,
      estimatedDurationSeconds: Number.isFinite(estimatedDurationSeconds) ? estimatedDurationSeconds : null,
      paid,
      experimentVariant,
    });
    const reviewRoom = await createReviewRoom(share.id);

    await recordEvent(email, 'share_link_created', {
      source: 'success_screen',
      share_id: share.id,
      resolution: share.resolution,
      frame_count: share.frameCount,
      file_size_bytes: body.byteLength,
      paid,
      expires_at: share.expiresAt,
      ...(share.experimentVariant ? { experiment_variant: share.experimentVariant } : {}),
      ...(anonymousId ? { anonymousId } : {}),
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || request.nextUrl.origin;
    return NextResponse.json({
      id: share.id,
      url: `${baseUrl}/share/${share.id}`,
      ownerUrl: `${baseUrl}/share/${share.id}?owner=${reviewRoom.ownerToken}`,
      expiresAt: share.expiresAt,
      paid,
      experimentVariant: share.experimentVariant,
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('Share creation error:', error);
    return NextResponse.json({ error: 'Could not create a share link', code: 'share_creation_failed' }, { status: 500, headers: corsHeaders });
  }
}
