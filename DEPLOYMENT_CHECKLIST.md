# ProtoVid - Deployment Checklist

## Already in Place

- Figma plugin manifest with network access configuration
- Email-based onboarding and free-tier tracking
- Free vs Pro gating in plugin UI and plugin logic
- Stripe checkout, billing portal, and webhook routes
- Neon-backed subscription persistence
- MP4 transcoding route with strict MP4 output behavior on the client
- Real plugin ID present in `manifest.json`
- Listing screenshot source files in `assets/listing/`

## Before Publishing

### 1. Verify Figma plugin settings

- Confirm the plugin ID in `manifest.json` matches the Figma developer listing.
- Rebuild the plugin with `npm run build`.
- Load the manifest in Figma Desktop and verify the plugin opens cleanly.

### 2. Verify backend configuration

Confirm these production variables exist:

```bash
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
PROTOVID_PRICE_ID=...
PROTOVID_YEARLY_PRICE_ID=...
NEXT_PUBLIC_APP_URL=...
NEON_DATABASE_URL=...
```

Optional:

```bash
PROTOVID_FREE_EXPORT_LIMIT=1
```

### 3. Verify Stripe products and redirects

- Monthly price ID is valid.
- Yearly price ID is valid if you want to keep the yearly option in the plugin UI.
- Checkout success and cancel URLs point at the right site.
- Webhook events update the correct user by email/customer ID.

### 4. Build and QA

```bash
npm run build
```

Verify:

- Blank/no-prototype state shows the sample MP4 outcome card
- Scan Prototype refreshes the page state after prototype connections are added
- Free tier allows exactly 1 export per month
- Free tier is limited to 720p
- Free exports are watermarked
- Pro unlocks 1080p, 4K, and watermark removal
- Upgrade flow opens checkout and returns to an unlocked state
- MP4 download works, and conversion failures show a visible error

### 5. Figma Community listing copy

Use listing copy that matches the current product:

**Name**
`ProtoVid - Prototype Video Exporter`

**Tagline**
`Turn Figma prototype flows into shareable videos in seconds`

**Description**

```text
ProtoVid exports Figma prototype flows as shareable MP4 videos without screen recording. Great for design reviews, stakeholder walkthroughs, portfolios, and social posts.

Features:
- Detects prototype-connected frames on the current page
- Export at 720p free, or 1080p/4K with Pro
- Free tier: 1 export/month with watermark
- Pro: unlimited exports and no watermark
- Email is used for export limits and Pro status
- Exported frame data is sent for MP4 creation when you export
```

**Screenshots**

Upload these generated PNGs in order:

1. `protovid-slide1.png` - Export MP4s without screen recording
2. `protovid-slide2.png` - Auto-detect connected frames
3. `protovid-slide3.png` - Start free, upgrade for HD

Avoid claims about GIF export or cursor animation unless those features are shipped.

**Release notes**

```text
Updated onboarding and listing assets to focus on the core Figma prototype-to-MP4 export flow. ProtoVid now shows detected prototype frames before email entry, explains export-limit/data use more clearly, keeps MP4 output aligned with the listing promise, and asks for a Figma Community review only after a successful export.
```

### 6. Figma data security answers

Use answers that match the shipped code:

1. **Do you host a backend service for your plugin/widget?**
   Select: `Yes, and data read/derived from Figma's plugin API is sent to this backend.`

   **Public vulnerability process**

```text
No. ProtoVid does not currently have a publicly documented vulnerability disclosure process. Security issues can be reported to the support contact listed on this plugin submission and will be reviewed by the maintainer.
```

   **Security standards accreditation**

```text
No. ProtoVid is not currently accredited to SOC 2, PCI DSS, HITRUST, ISO 27001, SSAE 18, or similar security standards.
```

2. **Does your plugin/widget make any network requests with services you do not host?**
   Select: `My plugin/widget makes network requests not captured by the above.`
   Text:

```text
Calls the ProtoVid backend for usage tracking, license/subscription validation, checkout creation, billing portal access, and MP4 fallback transcoding.
```

3. **Does your plugin/widget use any user authentication?**
   Select: `No, my plugin/widget does not require or use any user authentication.`

4. **Do you store any data read/derived from Figma's plugin API?**
   Select both:
   `Yes, my plugin/widget stores data read/derived from Figma's plugin API locally.`
   `Yes, my plugin/widget stores data read/derived from Figma's plugin API in a way not captured by the above.`

   Text:

```text
Locally stores the user's email and export count in figma.clientStorage. The backend stores user email, export usage/subscription status, and usage events such as prototype detection, frame count, export settings, export completion, checkout events, and review prompt events. Exported frame/video data may be processed temporarily for MP4 transcoding and is not used for user authentication.
```

   Access/data handling text:

```text
Access is limited to the plugin maintainer and the backend services used to operate ProtoVid. Stored backend data is used for usage limits, Pro subscription status, operational analytics, and support. Exported frame/video data is processed for MP4 transcoding when needed and should not be used for unrelated purposes.
```

5. **How do you manage updates to your plugin/widget?**
   Select the answer that is operationally true. If you are the only publisher/reviewer, use:
   `I am a solo developer. I manage and update my plugin/widget myself.`

### 7. Landing page alignment

- Update pricing and feature bullets to match the plugin UI
- Avoid "no account needed" wording, since the plugin uses an email gate
- Keep billing links pointed at the real production pricing/checkout experience

## Architecture Snapshot

```text
User opens plugin
  -> enters email
  -> plugin checks export usage and subscription status
  -> user exports or upgrades through Stripe
  -> plugin captures frames locally
  -> backend transcodes AVI to MP4
  -> user downloads the result
```

## Known Risks

- If Stripe webhook delivery breaks, Pro unlock state will lag behind checkout.
- If the transcoding route is unavailable, exports fail visibly until MP4 conversion is restored.
- Marketing copy can drift quickly because pricing and feature gating live in both plugin UI and site copy.
