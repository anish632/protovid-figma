// Comparison page content. Each key becomes /compare/<slug>.
// Rows are intentionally fair: `note` calls out where the alternative is a
// better fit, so the page reads as honest guidance, not competitor-bashing.

export interface CompareRow {
  dimension: string;
  protovid: string;
  alternative: string;
  /** true when ProtoVid is the stronger option on this row (drives the ✓). */
  protovidWins: boolean;
}

export interface ComparePage {
  slug: string;
  /** Short name of the thing being compared, e.g. "Screen recording". */
  alternativeName: string;
  h1: string;
  title: string;
  description: string;
  keywords: string[];
  intro: string;
  rows: CompareRow[];
  /** Honest acknowledgement of where the alternative wins. */
  fairNote: string;
  verdict: string;
}

export const COMPARE_PAGES: Record<string, ComparePage> = {
  'screen-recording': {
    slug: 'screen-recording',
    alternativeName: 'Screen recording',
    h1: 'ProtoVid vs screen recording for Figma prototypes',
    title: 'ProtoVid vs Screen Recording — Figma prototype to video',
    description:
      'Screen recording a Figma prototype captures cursor jitter, notifications, and inconsistent quality. See how ProtoVid exports a clean MP4 straight from your frames.',
    keywords: [
      'record figma prototype',
      'figma prototype to video',
      'screen record figma',
      'figma prototype screen recording',
    ],
    intro:
      'The quickest way to get a Figma prototype into a video is to hit record and click through it. It works — until a notification pops up, your cursor wanders, or the capture stutters. ProtoVid renders the same flow directly from your frames, so the output is clean every time.',
    rows: [
      { dimension: 'Setup', protovid: 'Pick frames in the plugin and export', alternative: 'Install a recorder, size the window, hide the dock', protovidWins: true },
      { dimension: 'Cursor & notifications', protovid: 'Never in frame — rendered from frames, not your screen', alternative: 'Cursor, tooltips, and OS notifications can appear', protovidWins: true },
      { dimension: 'Quality consistency', protovid: 'Deterministic 720p / 1080p / 4K every run', alternative: 'Depends on display, window size, and encoder', protovidWins: true },
      { dimension: 'File size', protovid: 'Encoded to efficient MP4/WebM at target resolution', alternative: 'Often large, variable bitrate captures', protovidWins: true },
      { dimension: 'Re-exporting after edits', protovid: 'Re-run the export, same settings', alternative: 'Re-record the whole click-through by hand', protovidWins: true },
      { dimension: 'Capturing non-prototype UI', protovid: 'Limited to connected frames', alternative: 'Can record literally anything on screen', protovidWins: false },
    ],
    fairNote:
      'Screen recording is the right tool when you need to capture something that lives outside your Figma frames — a browser, a live app, or a conversation walkthrough. For the prototype itself, rendering from the frames avoids the artifacts recording introduces.',
    verdict:
      'If the goal is a clean, repeatable video of a Figma flow, export it from the frames instead of recording your screen.',
  },
  loom: {
    slug: 'loom',
    alternativeName: 'Loom',
    h1: 'ProtoVid vs Loom for Figma design reviews',
    title: 'ProtoVid vs Loom — Figma design review videos',
    description:
      'Loom is great for talking-head walkthroughs. For Figma design reviews, ProtoVid is purpose-built: clean frame renders and timestamped, frame-level comments with no recording setup.',
    keywords: [
      'figma design review video',
      'loom alternative for design',
      'figma prototype walkthrough video',
      'share figma prototype with clients',
    ],
    intro:
      'Loom is excellent for narrated, personal walkthroughs. But a Figma design review is usually about the screens, not your face — and reviewers need to point at a specific moment. ProtoVid is built for that: it renders the prototype cleanly and gives reviewers timestamped, frame-level comments without anyone recording anything.',
    rows: [
      { dimension: 'Built for Figma', protovid: 'Reads your frames directly', alternative: 'General-purpose screen recorder', protovidWins: true },
      { dimension: 'Frame-level comments', protovid: 'Timestamped comments tied to the flow', alternative: 'Comments on the video timeline', protovidWins: true },
      { dimension: 'Setup to share', protovid: 'Export and send one link — no recording', alternative: 'Record a take, re-record if you fumble', protovidWins: true },
      { dimension: 'Output consistency', protovid: 'Deterministic render of the frames', alternative: 'Depends on the live take', protovidWins: true },
      { dimension: 'Personal narration / your voice', protovid: 'Not the focus', alternative: 'Camera + mic walkthrough is the core feature', protovidWins: false },
      { dimension: 'Recording non-Figma content', protovid: 'Figma frames only', alternative: 'Any app, any tab', protovidWins: false },
    ],
    fairNote:
      'If the value is you explaining something in your own voice — onboarding, a sales walkthrough, a bug repro across apps — Loom is the better tool. ProtoVid wins specifically for Figma design reviews where the screens and precise feedback matter more than narration.',
    verdict:
      'For Figma design reviews that need clean screens and pinpoint feedback, ProtoVid fits better. For narrated walkthroughs across any app, reach for Loom.',
  },
  'manual-gif': {
    slug: 'manual-gif',
    alternativeName: 'Manual GIF export',
    h1: 'ProtoVid vs manual GIF export from Figma',
    title: 'ProtoVid vs Manual GIF Export — Figma to GIF & MP4',
    description:
      'Exporting Figma frames to a GIF by hand means one frame at a time and heavy, low-color files. ProtoVid sequences the whole flow and exports GIF, MP4, or WebM in one pass.',
    keywords: [
      'figma to gif',
      'export figma to gif',
      'figma prototype to gif',
      'figma frames to mp4',
    ],
    intro:
      'You can export Figma frames and stitch a GIF together by hand, but you lose the flow between frames, the files get heavy, and color banding creeps in. ProtoVid sequences the connected frames for you and exports a GIF, MP4, or WebM in a single pass.',
    rows: [
      { dimension: 'Multi-frame flows', protovid: 'Sequences the whole connected path', alternative: 'Export and assemble frames one by one', protovidWins: true },
      { dimension: 'Output formats', protovid: 'GIF, MP4, and WebM from one export', alternative: 'Usually GIF only, assembled manually', protovidWins: true },
      { dimension: 'Quality & file size', protovid: 'Tunable resolution; MP4 avoids GIF color banding', alternative: 'GIFs are large and limited to 256 colors', protovidWins: true },
      { dimension: 'Timing & transitions', protovid: 'Honors prototype timing between frames', alternative: 'Manual, approximate timing', protovidWins: true },
      { dimension: 'Single static frame as a GIF', protovid: 'Works, but built for flows', alternative: 'Trivial — just export the one frame', protovidWins: false },
    ],
    fairNote:
      'For a single frame or a quick one-off loop, a manual export is perfectly fine and needs no plugin. ProtoVid earns its place once you have a multi-frame flow and want consistent quality and a real MP4 option.',
    verdict:
      'For anything past a single frame, let ProtoVid sequence and encode the flow instead of assembling a GIF by hand.',
  },
};

export const COMPARE_SLUGS = Object.keys(COMPARE_PAGES);
