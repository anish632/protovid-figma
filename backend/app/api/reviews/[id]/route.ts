import { NextRequest, NextResponse } from 'next/server';
import { recordEvent } from '@/lib/events';
import { getShare } from '@/lib/shareStorage';
import {
  addReviewComment,
  getReviewRoom,
  normalizeCommentInput,
  normalizeReviewStatus,
  updateReviewStatus,
} from '@/lib/reviewStorage';

export const runtime = 'nodejs';

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const share = await getShare(id);
  if (!share) return jsonError('Review link expired or not found', 404);

  const room = await getReviewRoom(id);
  await recordEvent(share.email, 'review_room_opened', {
    source: 'share_page',
    share_id: id,
    ...(share.experimentVariant ? { experiment_variant: share.experimentVariant } : {}),
    ...(share.anonymousId ? { anonymousId: share.anonymousId } : {}),
  }).catch(error => console.warn('Review room analytics failed:', error));
  return NextResponse.json({
    status: room.status,
    comments: room.comments,
    expiresAt: share.expiresAt,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const share = await getShare(id);
  if (!share) return jsonError('Review link expired or not found', 404);

  let input: any;
  try {
    input = await request.json();
  } catch {
    return jsonError('Request body must be valid JSON', 400);
  }

  if (input?.type === 'status') {
    const status = normalizeReviewStatus(input.status);
    const ownerToken = typeof input.ownerToken === 'string' ? input.ownerToken : '';
    if (!status || !ownerToken) return jsonError('A valid status and owner token are required', 400);
    const updated = await updateReviewStatus(id, status, ownerToken);
    if (!updated) return jsonError('Owner link is invalid or expired', 403);
    await recordEvent(share.email, 'review_status_updated', {
      source: 'review_room',
      share_id: id,
      status,
      ...(share.experimentVariant ? { experiment_variant: share.experimentVariant } : {}),
      ...(share.anonymousId ? { anonymousId: share.anonymousId } : {}),
    }).catch(error => console.warn('Review status analytics failed:', error));
    return NextResponse.json({ status });
  }

  const commentInput = normalizeCommentInput(input || {});
  if (!commentInput) return jsonError('Reviewer name, feedback, and a valid timestamp are required', 400);

  const comment = await addReviewComment(id, commentInput);
  await recordEvent(share.email, 'review_comment_created', {
    source: 'review_room',
    share_id: id,
    timestamp_seconds: comment.timestampSeconds,
    ...(share.experimentVariant ? { experiment_variant: share.experimentVariant } : {}),
    ...(share.anonymousId ? { anonymousId: share.anonymousId } : {}),
  }).catch(error => console.warn('Review comment analytics failed:', error));

  return NextResponse.json({ comment }, { status: 201 });
}
