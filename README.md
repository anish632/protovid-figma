# ProtoVid - Prototype Video Exporter for Figma

ProtoVid turns Figma prototype flows into shareable MP4 videos. It scans prototype-connected frames on the current page, captures the flow, and exports a downloadable video with free and Pro tiers.

## Features

- **Prototype Flow Detection** - Traverses prototype connections from Figma flow starting points and interaction graph data
- **Multiple Resolutions** - Export in 720p, 1080p, or 4K
- **MP4 Export** - Produces downloadable MP4 output, with backend FFmpeg transcoding used as a fallback
- **Watermark Gating** - Free exports are watermarked, Pro exports are not
- **Email-Based Access** - The plugin stores the user's email, tracks monthly usage, and unlocks Pro via Stripe subscription status

## Free vs Pro

| Feature | Free | Pro |
|---------|------|-----|
| Exports | 1 per month | Unlimited |
| Resolution | 720p | Up to 4K |
| Format | MP4 | MP4 |
| Watermark | Yes | No |

## Installation

1. Open Figma Desktop.
2. Go to **Plugins -> Search** and find "ProtoVid".
3. Click **Install**.

Or install directly from the [Figma Community page](https://www.figma.com/community/plugin/protovid).

## Usage

1. Open a Figma file with prototype interactions on the current page.
2. Run **Plugins -> ProtoVid**.
3. Enter your email to start the free tier.
4. Choose export settings.
5. Click **Export Video** and download the result.

Upgrade is handled from inside the plugin checkout flow when the user selects a Pro-only setting or exhausts the free tier.

## Development

### Plugin

```bash
npm install
npm run build
npm run watch
```

Load in Figma via **Plugins -> Development -> Import plugin from manifest**.

### Backend

```bash
cd backend
npm install
npm run dev
```

The active backend lives in `backend/app/api` and handles:

- Stripe checkout, billing portal, and webhooks
- Monthly export tracking in Neon Postgres
- Email-based subscription lookup
- MP4 fallback transcoding for uploaded AVI data

## Backend Environment Variables

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `PROTOVID_PRICE_ID` | Stripe monthly subscription price ID |
| `PROTOVID_YEARLY_PRICE_ID` | Stripe yearly subscription price ID |
| `NEXT_PUBLIC_APP_URL` | Public backend app URL used for Stripe redirects |
| `NEON_DATABASE_URL` | Neon Postgres connection string |
| `PROTOVID_FREE_EXPORT_LIMIT` | Optional override for the free monthly export limit |

## Local Notes

- The plugin currently points at `https://protovid.dasgroupllc.com`.
- If you deploy your own backend, update `BACKEND_URL` in `src/code.ts`, `src/ui.tsx`, and `src/encoder.ts`, then update `manifest.json` `allowedDomains`.
- In non-production environments, `/api/validate-license` accepts `DEV_*` and `PREMIUM_*` values for direct API testing, but the shipped plugin UI is email-based.

## Architecture

```text
protovid-figma/
├── src/
│   ├── code.ts          # Figma sandbox logic
│   ├── ui.tsx           # Plugin UI
│   └── encoder.ts       # Client-side AVI creation + MP4 upload
├── backend/
│   └── app/api/
│       ├── billing/     # Stripe checkout, portal, webhook
│       ├── exports/     # Export limit tracking
│       ├── validate-license/
│       └── encode-video/
├── landing/
│   └── index.html
└── manifest.json
```

## Tech Stack

- **Plugin**: TypeScript + Preact
- **Backend**: Next.js on Vercel
- **Billing**: Stripe
- **Persistence**: Neon Postgres
- **Encoding**: Client-side MP4 when available, with client-side AVI assembly and backend FFmpeg MP4 transcoding as fallback

## License

MIT
