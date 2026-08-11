export interface PrototypeBriefInput {
  filename?: string | null;
  frameCount?: number | null;
  resolution?: string | null;
  startFrameName?: string | null;
  endFrameName?: string | null;
  estimatedDurationSeconds?: number | null;
}

export interface PrototypeDecisionBrief {
  summary: string;
  walkthroughScript: string;
  decisionMemo: string[];
  reviewFocus: string[];
  nextSteps: string[];
  signals: {
    complexity: 'simple' | 'moderate' | 'complex';
    deliveryQuality: 'proof' | 'client-ready';
    reviewMode: 'quick-check' | 'stakeholder-review' | 'decision-review';
  };
}

function cleanText(value: string | null | undefined, fallback: string): string {
  const cleaned = (value || '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
}

function normalizeCount(value: number | null | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value || 0)) : 0;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'short';
  if (seconds < 60) return `${Math.round(seconds)} second`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return remainder ? `${minutes} minute ${remainder} second` : `${minutes} minute`;
}

export function buildPrototypeDecisionBrief(input: PrototypeBriefInput): PrototypeDecisionBrief {
  const frameCount = normalizeCount(input.frameCount);
  const filename = cleanText(input.filename, 'Prototype walkthrough');
  const startFrame = cleanText(input.startFrameName, 'the first screen');
  const endFrame = cleanText(input.endFrameName, 'the final screen');
  const resolution = cleanText(input.resolution, '720p');
  const duration = formatDuration(input.estimatedDurationSeconds || frameCount * 2);
  const complexity = frameCount >= 15 ? 'complex' : frameCount >= 6 ? 'moderate' : 'simple';
  const deliveryQuality = resolution === '1080p' || resolution === '4K' ? 'client-ready' : 'proof';
  const reviewMode = complexity === 'complex'
    ? 'decision-review'
    : deliveryQuality === 'client-ready'
      ? 'stakeholder-review'
      : 'quick-check';

  const route = frameCount > 1
    ? `${frameCount} connected frames from ${startFrame} to ${endFrame}`
    : `a single screen starting at ${startFrame}`;

  return {
    summary: `${filename} shows ${route} as a ${duration} ${resolution} walkthrough.`,
    walkthroughScript: `This walkthrough starts at ${startFrame}, follows the connected prototype path, and ends at ${endFrame}. Review it for flow clarity, decision points, and any gaps that would slow approval.`,
    decisionMemo: [
      `Scope: ${route}.`,
      `Output: ${resolution} ${deliveryQuality === 'client-ready' ? 'client-ready' : 'watermarked proof'} MP4.`,
      `Use this review to decide whether the flow is ready to share, needs copy or interaction changes, or should be split into smaller walkthroughs.`,
    ],
    reviewFocus: [
      'Does the first screen make the user intent obvious?',
      'Do transitions and screen order explain the product decision without a live narration?',
      'Where should reviewers approve the direction versus request concrete changes?',
      complexity === 'complex'
        ? 'Should this long flow be split into smaller decision reviews?'
        : 'Is anything missing before this can move to the next stakeholder?',
    ],
    nextSteps: [
      'Invite reviewers to leave timestamped comments at unclear moments.',
      'Mark the room approved when the direction is accepted.',
      'Export a revised version after changes so the review history stays tied to the decision.',
    ],
    signals: {
      complexity,
      deliveryQuality,
      reviewMode,
    },
  };
}
