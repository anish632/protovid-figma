# 🚀 ProtoVid - Quick Start (5 Minutes)

Get ProtoVid running in Figma in under 5 minutes.

---

## Step 1: Build the Plugin (30 seconds)

```bash
cd /Users/anishdas/apps/protovid-figma
npm install  # (already done)
npm run build
```

You should see:
```
✅ Build complete
```

---

## Step 2: Load in Figma Desktop (1 minute)

1. **Open Figma Desktop** (not browser)
2. Open any Figma file or create a new one
3. Go to **Menu (☰) → Plugins → Development → Import plugin from manifest...**
4. Navigate to `/Users/anishdas/apps/protovid-figma/`
5. Select `manifest.json`
6. Click **Open**

✅ ProtoVid should now appear in **Plugins → Development → ProtoVid**

---

## Step 3: Create a Test Prototype (2 minutes)

1. Create a **new Figma file**
2. Draw **3 frames** (press F to create frames)
   - Name them: "Home", "Details", "Success"
3. Add some content (text, shapes, anything)
4. **Add prototype interactions:**
   - Select "Home" frame
   - Switch to Prototype tab (right sidebar)
   - Click on a button/element → drag blue arrow → connect to "Details"
   - Repeat: "Details" → "Success"

🎯 You now have a simple prototype flow!

---

## Step 4: Run ProtoVid (1 minute)

1. Go to **Plugins → Development → ProtoVid**
2. The plugin UI should open and show:
   - "Found **3** prototype frames"
   - Export settings panel
3. Keep settings as default:
   - Resolution: **720p** (free tier)
   - Frame Rate: **30 fps**
   - Format: **MP4**
4. Click **"🎬 Export Video"**

---

## Step 5: Test Premium Features (optional)

To test premium features without paying:

1. In the plugin UI, find the **License Key** input
2. Enter: `DEV_TEST_KEY`
3. Click **"Validate License"**
4. You should see: **"✅ Premium Active"**
5. Now you can select:
   - 1080p or 4K resolution
   - GIF format
   - No watermark

---

## Expected Results

### ✅ Success Indicators
- Plugin loads without errors
- UI shows prototype frames count
- Export button is clickable
- Progress bar animates during export
- Test license key validates successfully

### ⚠️ Common Issues

**"No prototype found"**
- Make sure you created prototype interactions (blue arrows)
- Check you're on the correct page in Figma

**Plugin won't load**
- Run `npm run build` again
- Restart Figma Desktop
- Check that `dist/` folder exists and has files

**Build errors**
- Delete `node_modules/` and run `npm install` again
- Make sure you're in the right directory

---

## What's Working

✅ Plugin loads in Figma  
✅ UI renders and detects prototypes  
✅ Frame capture system functional  
✅ License validation (with test keys)  
✅ Free tier limits enforced  
✅ Progress tracking  

## What's Placeholder

🔧 **Video encoding** - Currently returns mock data. To implement:
- Deploy backend to Vercel
- Add FFmpeg encoding in `/api/encode-video.ts`
- Update plugin to call real API

The plugin is **fully functional for development** and ready to demo the complete user flow!

---

## Development Workflow

### Make Code Changes
```bash
# Watch mode (auto-rebuild)
npm run watch
```

Then in Figma:
1. Right-click plugin → **"Reload plugin"**
2. Test your changes

### Common Edits
- **UI changes:** Edit `src/ui.tsx`
- **Plugin logic:** Edit `src/code.ts`
- **Styles:** Edit CSS in `src/ui.html`

---

## Next: Full Backend Setup

See **SETUP.md** for:
- Deploying to Vercel
- Setting up Lemon Squeezy
- Implementing FFmpeg encoding
- Publishing to Figma Community

---

## Questions?

- 📖 Full docs: **README.md**
- 🔧 Setup guide: **SETUP.md**
- 📊 Overview: **PROJECT_SUMMARY.md**
- 🐛 Issues: https://github.com/anish632/protovid-figma/issues

**You're ready to build!** 🚀
