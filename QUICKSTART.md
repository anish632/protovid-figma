# ProtoVid - Quick Start

Get ProtoVid running in Figma in a few minutes.

## Step 1: Build the plugin

```bash
npm install
npm run build
```

## Step 2: Load it in Figma Desktop

1. Open Figma Desktop.
2. Go to **Menu -> Plugins -> Development -> Import plugin from manifest...**
3. Select `manifest.json` from this repo.
4. Confirm ProtoVid appears under **Plugins -> Development**.

## Step 3: Create a tiny prototype

1. Create 3 frames on the same page.
2. Add prototype interactions:
   - Frame 1 -> Frame 2
   - Frame 2 -> Frame 3
3. Set a flow starting point if needed.

## Step 4: Export

1. Run **Plugins -> Development -> ProtoVid**.
2. Enter your email on the start screen.
3. Leave the default settings:
   - 720p
4. Click the export button.

## Expected results

- The plugin detects prototype frames on the current page.
- Export progress appears in the UI.
- A downloadable MP4 video file is generated.
- If backend transcoding fails, the plugin shows a conversion error instead of returning AVI.

## Optional: Test the Pro path

If your backend is configured with Stripe in test mode:

1. Trigger a Pro-only option such as 1080p or 4K.
2. Complete checkout with a Stripe test card.
3. Wait for the plugin to detect the updated subscription automatically.

## Common issues

### "No prototype found"

- Ensure the current page has prototype connections.
- Add a Figma flow starting point if export order is unclear.

### Plugin won't load

- Re-run `npm run build`.
- Make sure `dist/` exists.
- Restart Figma Desktop if needed.

### Export is blocked after one run

- That is expected on the free tier.
- Use Pro or wait for the monthly limit reset.

## What's already working

- Plugin UI and export flow
- Current-page prototype detection
- Free vs Pro feature gating
- Email-based usage tracking
- Stripe-backed upgrade flow
- Backend MP4 transcoding

## Next

- See `SETUP.md` for full backend setup
- See `DEPLOYMENT_CHECKLIST.md` for publish prep
- See `PROJECT_SUMMARY.md` for the current architecture snapshot
