# ProtoVid Setup Guide

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Build the plugin

```bash
npm run build
```

### 3. Load in Figma

1. Open Figma Desktop.
2. Go to **Menu -> Plugins -> Development -> Import plugin from manifest...**
3. Select `manifest.json` from this repo.
4. The plugin appears under **Plugins -> Development -> ProtoVid**.

### 4. Test a basic export

1. Create a small prototype with 2-3 connected frames on one page.
2. Run **Plugins -> Development -> ProtoVid**.
3. Enter an email address in the start screen.
4. Keep the default free settings:
   - 720p
5. Click **Export Video**.

## Development Workflow

```bash
npm run watch
```

After making changes:

1. Save files.
2. In Figma, right-click the development plugin.
3. Click **Reload plugin**.

## Current Product Behavior

- Free tier: 1 export per month, 720p, watermarked
- Pro tier: unlimited exports, 1080p/4K, no watermark
- Premium access is tied to the user's email and Stripe subscription status
- Export discovery is based on prototype-connected frames on the current page

## Backend Setup

The plugin is currently wired to `https://backend-one-nu-28.vercel.app`. If you want to run your own backend:

### 1. Install backend dependencies

```bash
cd backend
npm install
```

### 2. Configure environment variables

Add these in your local environment or Vercel project:

```bash
STRIPE_SECRET_KEY=<your-stripe-secret-key>
STRIPE_WEBHOOK_SECRET=<your-stripe-webhook-signing-secret>
PROTOVID_PRICE_ID=<your-stripe-monthly-price-id>
PROTOVID_YEARLY_PRICE_ID=<your-stripe-yearly-price-id>
NEXT_PUBLIC_APP_URL=<your-backend-app-url>
NEON_DATABASE_URL=<your-neon-postgres-connection-string>
```

Optional:

```bash
PROTOVID_FREE_EXPORT_LIMIT=1
```

### 3. Initialize the database

```bash
cd backend
NEON_DATABASE_URL="<your-neon-connection-string>" npx tsx lib/db-init.ts
```

### 4. Run or deploy the backend

```bash
cd backend
npm run dev
```

For production deployment, see `backend/VERCEL_DEPLOYMENT.md`.

### 5. Point the plugin at your backend

Update these files:

- `src/code.ts`
- `src/ui.tsx`
- `src/encoder.ts`
- `manifest.json` `networkAccess.allowedDomains`

Then rebuild the plugin.

## Billing Flow

1. User enters an email in the plugin.
2. Plugin checks the backend for free-tier usage and subscription status.
3. If the user chooses a Pro-only action, the plugin opens Stripe Checkout.
4. Stripe webhook updates the user's subscription record in Neon.
5. The plugin re-checks status by email and unlocks Pro automatically.

## Key Files

```text
src/code.ts                      # Figma sandbox + export orchestration
src/ui.tsx                       # UI state, email gate, upgrade flow
src/encoder.ts                   # Local AVI creation and MP4 upload
backend/app/api/encode-video     # Active MP4 transcoding route
backend/app/api/validate-license # Email-based premium lookup
backend/app/api/billing          # Stripe checkout, portal, webhook
backend/lib/storage.ts           # Neon-backed subscription storage
```

## Troubleshooting

### Plugin won't load

- Run `npm run build` again.
- Make sure `dist/` exists.
- Restart Figma Desktop if needed.

### "No prototype found"

- Make sure frames on the current page have prototype interactions.
- Set a Figma flow starting point if the page has multiple flows.

### MP4 conversion fails

- Check the backend deployment and `encode-video` route logs.
- Confirm the route allows `POST, OPTIONS` CORS requests with the `Content-Type` header.

### Upgrade flow does not unlock Pro

- Verify Stripe webhook delivery.
- Confirm the same email was used in the plugin and in checkout.
- Check the subscription record in Neon.

## Notes for Local Testing

- The shipping UI is email-first, not license-key-first.
- The backend still accepts `DEV_*` and `PREMIUM_*` values in non-production through `/api/validate-license` for direct API testing.
