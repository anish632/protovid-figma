'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';

type ReviewStatus = 'open' | 'approved' | 'changes_requested';
type Comment = {
  id: string;
  reviewerName: string;
  body: string;
  timestampSeconds: number;
  createdAt: string;
};

function buildCommentInsights(comments: Comment[], status: ReviewStatus, nextSteps: string[]) {
  if (!comments.length) {
    return {
      headline: 'Waiting for reviewer input',
      points: nextSteps,
    };
  }

  const sorted = [...comments].sort((a, b) => a.timestampSeconds - b.timestampSeconds);
  const first = sorted[0];
  const latest = [...comments].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  const reviewerCount = new Set(comments.map(comment => comment.reviewerName.trim().toLowerCase())).size;
  const approvalCopy = status === 'approved'
    ? 'The owner has marked this direction approved.'
    : status === 'changes_requested'
      ? 'The owner has requested changes before approval.'
      : 'The review is still open for decision.';

  return {
    headline: `${comments.length} comment${comments.length === 1 ? '' : 's'} from ${reviewerCount} reviewer${reviewerCount === 1 ? '' : 's'}`,
    points: [
      `${approvalCopy}`,
      `First discussion point is at ${formatTimestamp(first.timestampSeconds)}.`,
      `Latest note from ${latest.reviewerName}: ${latest.body.slice(0, 120)}${latest.body.length > 120 ? '...' : ''}`,
      'Resolve clustered comments first, then export the revised walkthrough.',
    ],
  };
}

function formatTimestamp(seconds: number) {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = String(wholeSeconds % 60).padStart(2, '0');
  return `${minutes}:${remainder}`;
}

export default function ReviewRoom({ shareId, ownerToken, nextSteps }: { shareId: string; ownerToken?: string; nextSteps: string[] }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<ReviewStatus>('open');
  const [comments, setComments] = useState<Comment[]>([]);
  const [reviewerName, setReviewerName] = useState('');
  const [body, setBody] = useState('');
  const [timestampSeconds, setTimestampSeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const commentInsights = buildCommentInsights(comments, status, nextSteps);

  useEffect(() => {
    fetch(`/api/reviews/${shareId}`)
      .then(response => response.ok ? response.json() : Promise.reject(new Error('Could not load review room.')))
      .then(data => {
        setStatus(data.status || 'open');
        setComments(Array.isArray(data.comments) ? data.comments : []);
      })
      .catch(error => setNotice(error instanceof Error ? error.message : 'Could not load review room.'))
      .finally(() => setLoading(false));
  }, [shareId]);

  const captureTimestamp = () => {
    const currentTime = videoRef.current?.currentTime || 0;
    setTimestampSeconds(Math.round(currentTime * 10) / 10);
    setNotice(`Feedback will be attached at ${formatTimestamp(currentTime)}.`);
  };

  const seekTo = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      void videoRef.current.play();
    }
  };

  const submitComment = async (event: FormEvent) => {
    event.preventDefault();
    if (!reviewerName.trim() || !body.trim()) return;
    setSubmitting(true);
    setNotice('');
    try {
      const response = await fetch(`/api/reviews/${shareId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewerName, body, timestampSeconds }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not submit feedback.');
      setComments(current => [...current, data.comment]);
      setBody('');
      setNotice('Feedback added to the review.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not submit feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (nextStatus: ReviewStatus) => {
    if (!ownerToken) return;
    setSubmitting(true);
    setNotice('');
    try {
      const response = await fetch(`/api/reviews/${shareId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'status', status: nextStatus, ownerToken }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not update review status.');
      setStatus(data.status);
      setNotice(nextStatus === 'approved' ? 'Review marked approved.' : 'Changes requested.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not update review status.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
      <div style={{ padding: 20, borderRadius: 20, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a5b4fc' }}>Review room</div>
            <h2 style={{ margin: '5px 0 0', color: '#fff', fontSize: 20 }}>Leave feedback on the walkthrough</h2>
          </div>
          <span style={{ padding: '6px 10px', borderRadius: 999, background: status === 'approved' ? 'rgba(34,197,94,0.16)' : status === 'changes_requested' ? 'rgba(251,146,60,0.16)' : 'rgba(255,255,255,0.08)', color: status === 'approved' ? '#86efac' : status === 'changes_requested' ? '#fdba74' : '#cbd5e1', fontSize: 12, fontWeight: 700 }}>
            {status === 'approved' ? 'Approved' : status === 'changes_requested' ? 'Changes requested' : 'Open for review'}
          </span>
        </div>
        <video ref={videoRef} controls playsInline preload="metadata" style={{ display: 'block', width: '100%', borderRadius: 12, background: '#000' }} src={`/api/shares/${shareId}/video`} />
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
          <span style={{ color: '#94a3b8', fontSize: 13 }}>Current feedback point: <strong style={{ color: '#e2e8f0' }}>{formatTimestamp(timestampSeconds)}</strong></span>
          <button type="button" onClick={captureTimestamp} style={{ padding: '9px 12px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.14)', color: '#fff', background: 'rgba(255,255,255,0.06)', cursor: 'pointer' }}>Comment at current time</button>
        </div>
        {notice && <p role="status" style={{ margin: '12px 0 0', color: '#c4b5fd', fontSize: 13 }}>{notice}</p>}
      </div>

      <aside style={{ padding: 20, borderRadius: 20, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <h2 style={{ margin: 0, color: '#fff', fontSize: 18 }}>Feedback</h2>
        <form onSubmit={submitComment} style={{ display: 'grid', gap: 9, marginTop: 14 }}>
          <label style={{ color: '#cbd5e1', fontSize: 12 }}>Your name</label>
          <input value={reviewerName} onChange={event => setReviewerName(event.target.value)} placeholder="Alex" maxLength={80} required style={{ padding: 10, borderRadius: 9, border: '1px solid rgba(255,255,255,0.14)', background: '#111c2d', color: '#fff' }} />
          <label style={{ color: '#cbd5e1', fontSize: 12, marginTop: 4 }}>Feedback at {formatTimestamp(timestampSeconds)}</label>
          <textarea value={body} onChange={event => setBody(event.target.value)} placeholder="What should change or stay?" maxLength={2000} rows={4} required style={{ padding: 10, borderRadius: 9, border: '1px solid rgba(255,255,255,0.14)', background: '#111c2d', color: '#fff', resize: 'vertical' }} />
          <button type="submit" disabled={submitting || loading} style={{ marginTop: 3, padding: '11px 14px', border: 0, borderRadius: 9, background: '#7c6ef0', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>{submitting ? 'Saving…' : 'Add feedback'}</button>
        </form>

        {ownerToken && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 18 }}>
          <button type="button" disabled={submitting} onClick={() => updateStatus('approved')} style={{ padding: '10px 8px', borderRadius: 9, border: '1px solid rgba(74,222,128,0.35)', background: 'rgba(34,197,94,0.12)', color: '#bbf7d0', cursor: 'pointer' }}>Approve</button>
          <button type="button" disabled={submitting} onClick={() => updateStatus('changes_requested')} style={{ padding: '10px 8px', borderRadius: 9, border: '1px solid rgba(251,146,60,0.35)', background: 'rgba(251,146,60,0.12)', color: '#fed7aa', cursor: 'pointer' }}>Request changes</button>
        </div>}

        <div style={{ marginTop: 22 }}>
          <h3 style={{ margin: 0, color: '#fff', fontSize: 15 }}>Comments {comments.length ? `(${comments.length})` : ''}</h3>
          {comments.length === 0 ? <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.5 }}>No feedback yet. Click the video time you want to discuss, then add a note.</p> : <div style={{ display: 'grid', gap: 10, marginTop: 10, maxHeight: 300, overflow: 'auto' }}>
            {comments.map(comment => <button key={comment.id} type="button" onClick={() => seekTo(comment.timestampSeconds)} style={{ textAlign: 'left', padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#e2e8f0', cursor: 'pointer' }}>
              <span style={{ color: '#a5b4fc', fontSize: 12, fontWeight: 700 }}>{formatTimestamp(comment.timestampSeconds)} · {comment.reviewerName}</span>
              <span style={{ display: 'block', marginTop: 4, fontSize: 13, lineHeight: 1.45 }}>{comment.body}</span>
            </button>)}
          </div>}
        </div>
      </aside>
      <aside style={{ padding: 20, borderRadius: 20, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a5b4fc' }}>Local review intelligence</div>
        <h2 style={{ margin: '5px 0 0', color: '#fff', fontSize: 18 }}>{commentInsights.headline}</h2>
        <ul style={{ display: 'grid', gap: 9, margin: '14px 0 0', paddingLeft: 18, color: '#cbd5e1', fontSize: 13, lineHeight: 1.55 }}>
          {commentInsights.points.map(point => <li key={point}>{point}</li>)}
        </ul>
        <p style={{ margin: '14px 0 0', color: '#94a3b8', fontSize: 12, lineHeight: 1.5 }}>Generated from this review room only. No separate AI account or external model is required.</p>
      </aside>
    </section>
  );
}
