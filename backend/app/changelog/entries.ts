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
    headline: 'Figma-led growth: one-click connect & export for disconnected pages',
    new: [
      'Placeholder: describe a new capability shipped in this version.',
    ],
    improved: [
      'Placeholder: describe something that got faster, clearer, or smoother.',
    ],
    fixed: [
      'Placeholder: describe a bug this version resolves.',
    ],
  },
  {
    version: '72',
    date: 'September 29, 2026',
    isoDate: '2026-09-29',
    headline: 'Frictionless checkout and a faster path to your first export',
    new: [
      'Placeholder: describe a new capability shipped in this version.',
    ],
    improved: [
      'Placeholder: describe something that got faster, clearer, or smoother.',
    ],
    fixed: [
      'Placeholder: describe a bug this version resolves.',
    ],
  },
];

export function changelogSlug(version: string) {
  return `v${version}`;
}
