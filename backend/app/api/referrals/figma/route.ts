import { NextRequest, NextResponse } from 'next/server';
import { recordEvent } from '@/lib/events';
import { getShare } from '@/lib/shareStorage';

const FIGMA_COMMUNITY_URL = 'https://www.figma.com/community/plugin/1606994616321079154';
const ALLOWED_SOURCES = new Set(['marketing_landing', 'review_room', 'review_room_footer']);

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestedSource = request.nextUrl.searchParams.get('source') || '';
  const source = ALLOWED_SOURCES.has(requestedSource) ? requestedSource : 'unknown';
  const shareId = (request.nextUrl.searchParams.get('shareId') || '').slice(0, 32);

  try {
    const share = shareId ? await getShare(shareId) : null;
    await recordEvent(share?.email || null, 'viral_growth_action', {
      source,
      action: 'figma_install_clicked',
      ...(share ? {
        share_id: share.id,
        ...(share.experimentVariant ? { experiment_variant: share.experimentVariant } : {}),
        ...(share.anonymousId ? { anonymousId: share.anonymousId } : {}),
      } : {}),
    });
  } catch (error) {
    // Acquisition must still work if analytics or share storage is degraded.
    console.warn('Figma referral analytics failed:', error);
  }

  return NextResponse.redirect(FIGMA_COMMUNITY_URL, 302);
}
