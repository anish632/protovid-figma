import { NextRequest, NextResponse } from 'next/server';
import { recordEvent } from '@/lib/events';
import { getShareVideo, incrementShareViews } from '@/lib/shareStorage';

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await getShareVideo(id);
  if (!result) return new Response('Share link expired or not found', { status: 404 });

  const firstView = result.share.viewCount === 0;
  await incrementShareViews(id);
  if (firstView) {
    await recordEvent(result.share.email, 'share_page_viewed', {
      source: 'share_video',
      share_id: id,
      resolution: result.share.resolution,
      frame_count: result.share.frameCount,
      ...(result.share.experimentVariant ? { experiment_variant: result.share.experimentVariant } : {}),
      ...(result.share.anonymousId ? { anonymousId: result.share.anonymousId } : {}),
    }).catch(error => console.warn('Share view analytics failed:', error));
  }

  return new NextResponse(result.video as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(result.video.byteLength),
      'Content-Disposition': `inline; filename="${result.share.filename}"`,
      'Cache-Control': 'private, max-age=300',
      'Accept-Ranges': 'bytes',
    },
  });
}
