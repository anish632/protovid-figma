# ProtoVid — Deployment Checklist

## ✅ What's Been Done

### Code Improvements
- [x] **Persistent export count** — Free tier count now saved via `figma.clientStorage` (survives plugin reload)
- [x] **Persistent license key** — Validated keys saved and auto-restored on plugin open
- [x] **Auto-validate on load** — Saved license key is re-validated each session
- [x] License key flow: UI → plugin sandbox → backend API → Lemon Squeezy ✅
- [x] Free vs premium gating enforced both client-side (UI disables options) and server-side (encode-video route checks)

### manifest.json
- [x] Added `documentAccess: "dynamic-page"`
- [x] Added `networkAccess.reasoning` (required for Community review)
- [x] Set `capabilities: []` and `enableProposedApi: false`
- [x] **Placeholder ID** `1234567890123456789` — YOU MUST replace with real ID (see below)

### Documentation
- [x] `README.md` — Full project documentation
- [x] `LANDING_PAGE.md` — Landing page copy and content strategy
- [x] `DEPLOYMENT_CHECKLIST.md` — This file

### Backend (already live)
- [x] Backend deployed at https://backend-one-nu-28.vercel.app
- [x] CORS configured for all origins
- [x] License validation endpoint working
- [x] `LEMON_SQUEEZY_API_KEY` set in Vercel env (test mode)

---

## 🔲 What YOU Need to Do

### 1. Create Figma Plugin in Developer Console
1. Go to https://www.figma.com/plugin-settings
2. Click **"Create new plugin"**
3. Choose **"Figma design"** as the editor type
4. Name it: **ProtoVid - Prototype Video Exporter**
5. Copy the **plugin ID** from the URL or settings page
6. Update `manifest.json` → replace `"id": "1234567890123456789"` with the real ID

### 2. Create Lemon Squeezy Product
1. Go to https://app.lemonsqueezy.com
2. Create a new **Subscription product**:
   - Name: **ProtoVid Premium**
   - Price: **$12/month**
   - Enable **License keys** in the product settings
   - Set activation limit (e.g., 5 devices)
3. Copy the **checkout URL** and update:
   - `src/ui.tsx` → the `href="https://protovid.lemonsqueezy.com"` links
   - `landing/index.html` → all Lemon Squeezy links
4. **Switch to LIVE mode** when ready:
   - Generate a production API key in Lemon Squeezy
   - Update `LEMON_SQUEEZY_API_KEY` in Vercel environment variables
   - Redeploy backend

### 3. Build & Test
```bash
cd /Users/anishdas/apps/protovid-figma
npm run build
```
1. Load plugin in Figma Desktop via **Plugins → Development → Import from manifest**
2. Test with a file that has prototype interactions
3. Test license validation with a DEV_ key
4. Test free tier limits (3 exports)
5. Verify export count persists after closing/reopening plugin

### 4. Submit to Figma Community
1. Go to your plugin in the Figma developer console
2. Fill in:
   - **Description**: "Export Figma prototypes as high-quality MP4 and GIF videos. Automatic prototype flow detection, cursor animation, and up to 4K resolution."
   - **Tags**: video, export, prototype, recording, MP4, GIF, presentation
   - **Cover image**: Create a 1920×960 cover (tip: design it in Figma)
   - **Icon**: 128×128 plugin icon
3. Upload the built plugin files
4. Click **Publish** → enters Figma review queue (typically 1-5 business days)

### 5. Landing Page (Optional but Recommended)
1. Deploy `landing/index.html` to Vercel/Netlify/GitHub Pages
2. Get a custom domain (e.g., protovid.app)
3. Update all placeholder URLs in the landing page
4. Add analytics

### 6. Post-Launch
- [ ] Switch Lemon Squeezy to live mode
- [ ] Monitor license validation logs in Vercel
- [ ] Respond to Figma Community reviews
- [ ] Consider: client-side video encoding (WebCodecs) to remove backend dependency
- [ ] Consider: server-side FFmpeg on a VPS for higher quality encoding

---

## Architecture Summary

```
User installs plugin from Figma Community
  → Plugin runs in Figma Desktop
  → License key entered in UI
  → Plugin sandbox sends key to backend
  → Backend validates with Lemon Squeezy API
  → Premium features unlocked
  → Export captures frames via Figma API
  → Video encoded (currently client-side, server planned)
  → User downloads MP4/GIF
```

## Known Limitations
- Video encoding is currently a stub (returns mock data) — needs client-side WebCodecs or server-side FFmpeg implementation
- Free tier count is per-device (clientStorage), not per-account
- No watermark implementation yet (mentioned in UI but not enforced in code)
