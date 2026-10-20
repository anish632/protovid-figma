// Changelog data. Add a new object to the TOP of this array for each release.
// `headline` is used for the page title, the OG image, and social sharing, so
// keep it short and benefit-led. Leave any category array empty to hide it.

export interface ChangelogEntry {
  /** Figma Community version number, e.g. "73". Used in the URL anchor. */
  version: string;
  /** Human date, e.g. "October 14, 2026". */
  date: string;
  /** ISO date (YYYY-MM-DD) for <time> and sitemap lastModified. */
  isoDate: string;
  /** One-line benefit summary. Powers <title>, OG image, and social copy. */
  headline: string;
  new?: string[];
  improved?: string[];
  fixed?: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '73',
    date: 'October 14, 2026',
    isoDate: '2026-10-14',
    headline: 'Send for review: a clearer, more measurable client-delivery flow',
    new: [
      'The delivery loop is now measurable: MP4 exports record when the review call-to-action is seen, so we can tell a missed action apart from a weak offer.',
    ],
    improved: [
      'The post-export action is now “Send for review” (previously “Create approval link”), with copy that explains what a recipient can do, who owns approval, and the 7-day free / 30-day paid link lifetimes.',
      'Repeat exports are now framed as “Export a revision,” making the saved-settings workflow easier to find.',
      'Clearer promise throughout: turn Figma frames into a client-ready walkthrough without screen recording — following your connected prototype path or connecting unlinked frames left to right.',
    ],
  },
  {
    version: '72',
    date: 'September 29, 2026',
    isoDate: '2026-09-29',
    headline: 'One-click checkout — no more pre-checkout email gate',
    new: [
      'Creating a share or review link now feeds the growth loop, so the share → reviewer → install path can be measured end to end.',
    ],
    improved: [
      'Upgrading now opens Stripe Checkout immediately — the inline email gate that stopped most upgrades before checkout is gone. Stripe collects the email, and returning buyers skip re-entering it.',
      '“Export another” now shows a free user’s remaining allowance when they still have exports left, nudging another export within the same session.',
    ],
    fixed: [
      'The “Rate on Figma Community” prompt is now a single step — previously a first “Yes, it saved me time” click was required and almost no one reached the rate button.',
      'Backend transcode requests now report the correct plugin version instead of a stale hardcoded value.',
    ],
  },
];

export function changelogSlug(version: string) {
  return `v${version}`;
}
