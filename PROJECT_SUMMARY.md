# ProtoVid - Project Summary

## Status

ProtoVid is in a coherent, testable state for Figma development and publish prep. The current product flow is:

1. User opens the plugin on a page with prototype connections.
2. User enters an email to start the free tier.
3. Plugin checks monthly usage and subscription status.
4. Plugin captures prototype frames and assembles a local AVI.
5. Backend transcodes the AVI intermediate to MP4.
6. Pro features are unlocked through Stripe subscription status tied to the same email.

## What Exists Today

### Plugin

- Email gate for first-run onboarding
- Current-page prototype graph discovery
- Resolution gating: 720p free, 1080p/4K Pro
- Free tier watermarking
- Export progress UI and download flow

### Backend

- `backend/app/api/encode-video` for AVI to MP4 transcoding
- `backend/app/api/validate-license` for email-based subscription lookup
- `backend/app/api/exports/check` and `exports/increment` for monthly usage tracking
- `backend/app/api/billing/checkout`, `portal`, and `webhook` for Stripe billing
- Neon-backed persistence in `backend/lib/storage.ts`

### Marketing / Docs

- Figma plugin metadata in `manifest.json`
- Marketing landing page in `landing/index.html`
- Updated repo docs aligned to the Stripe + MP4 flow

## Current Product Rules

- Free tier: 1 export per month
- Free tier export settings: 720p, MP4, watermarked
- Pro tier: unlimited exports, 1080p/4K, no watermark
- Prototype discovery is scoped to the current Figma page

## Important Implementation Notes

- The plugin stores the user's email locally and uses it to look up export limits and subscription state.
- The active backend is hard-coded to `https://backend-one-nu-28.vercel.app` in the plugin source.
- If MP4 transcoding fails, the plugin shows a conversion error instead of returning AVI.
- The root-level `api/` directory contains older reference code; the active backend lives under `backend/app/api`.

## Known Limitations

- Publish copy should avoid claiming GIF export or cursor animation today.
- The export flow works from prototype-connected frames on the current page, not across the entire document.
- Stripe and Neon must be configured correctly for paid upgrades and monthly usage persistence.

## Recommended Next Steps

1. Finalize Figma Community listing copy and screenshots.
2. Decide whether to keep the hosted backend or point the plugin at a new deployment.
3. Add smoke tests around export status, billing status, and webhook handling.
4. Consider future features only after publish copy matches the shipped product.

## Useful Files

```text
manifest.json
src/code.ts
src/ui.tsx
src/encoder.ts
backend/app/api/encode-video/route.ts
backend/app/api/validate-license/route.ts
backend/app/api/billing/checkout/route.ts
backend/lib/storage.ts
landing/index.html
```
