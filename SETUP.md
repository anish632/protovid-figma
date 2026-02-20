# ProtoVid Setup Guide

## Quick Start

### 1. Install Dependencies
```bash
cd /Users/anishdas/apps/protovid-figma
npm install
```

### 2. Build the Plugin
```bash
npm run build
```

### 3. Load in Figma

**Method 1: Figma Desktop (Recommended for Development)**
1. Open Figma Desktop app
2. Go to **Menu → Plugins → Development → Import plugin from manifest...**
3. Navigate to `/Users/anishdas/apps/protovid-figma/` and select `manifest.json`
4. The plugin will now appear in **Plugins → Development → ProtoVid**

**Method 2: Run a prototype in Figma**
1. Create a simple prototype with 2-3 frames and interactions
2. Run **Plugins → Development → ProtoVid**
3. The plugin UI should open showing your prototype info

### 4. Development Workflow

**Watch Mode (Auto-rebuild on changes):**
```bash
npm run watch
```

After making code changes:
1. Save your files
2. In Figma, right-click the plugin → **Reload plugin**
3. Test your changes

## Testing the Plugin

### Create a Test Prototype
1. Create 3 frames in Figma
2. Add prototype interactions:
   - Frame 1 → (Click) → Frame 2
   - Frame 2 → (Click) → Frame 3
3. Run the plugin
4. Select export settings (use 720p for free tier)
5. Click "Export Video"

### Test License Keys (Development)
The plugin accepts test license keys:
- `DEV_TEST_KEY` - validates as premium
- `PREMIUM_12345` - validates as premium
- Any other key - validates as free tier

## Backend Setup (Optional for Full Functionality)

The plugin currently has placeholder backend code. To enable actual video encoding:

### Deploy to Vercel
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel
```

### Set Environment Variables
In Vercel dashboard, add:
```
LEMON_SQUEEZY_API_KEY=your_api_key_here
```

### Update manifest.json
Replace `allowedDomains` with your Vercel URL:
```json
"networkAccess": {
  "allowedDomains": [
    "https://your-project.vercel.app",
    "https://api.lemonsqueezy.com"
  ]
}
```

## Lemon Squeezy Setup

### 1. Create Lemon Squeezy Account
- Sign up at [lemonsqueezy.com](https://lemonsqueezy.com)
- Create a product: "ProtoVid Premium"
- Set price: $12/month (recurring)

### 2. Generate API Key
- Go to Settings → API
- Create new API key
- Copy key to Vercel environment variables

### 3. License Key Flow
When users purchase:
1. They receive a license key via email
2. They enter it in the plugin
3. Plugin calls `/api/validate-license` with the key
4. Backend validates with Lemon Squeezy API
5. Plugin unlocks premium features

## File Structure

```
protovid-figma/
├── manifest.json          # Figma plugin manifest
├── package.json           # Dependencies
├── tsconfig.json          # TypeScript config
├── build.js              # Build script (esbuild)
├── src/
│   ├── code.ts           # Main plugin code (Figma sandbox)
│   ├── ui.tsx            # Plugin UI (Preact)
│   └── ui.html           # UI container
├── api/                  # Backend API routes (Vercel)
│   ├── encode-video.ts   # Video encoding endpoint
│   └── validate-license.ts # License validation
├── landing/
│   └── index.html        # Landing page
├── dist/                 # Built files (generated)
│   ├── code.js
│   ├── ui.js
│   └── ui.html
└── README.md
```

## Key Features Implemented

✅ **Plugin Core**
- Figma plugin manifest and structure
- TypeScript-based codebase
- Preact UI with state management
- Build system (esbuild)

✅ **Prototype Detection**
- Scans current page for frames
- Detects prototype interactions
- Analyzes flow paths

✅ **Frame Capture**
- Exports frames as PNG
- Scales to target resolution (720p/1080p/4K)
- Follows prototype flow

✅ **License System**
- Free tier: 3 exports/month, 720p, watermarked
- Premium tier: Unlimited, 4K, no watermark
- License key validation structure
- Test keys for development

✅ **UI/UX**
- Frame selection and preview
- Export settings (resolution, FPS, format)
- Progress tracking
- License key input

✅ **Backend Structure**
- Next.js API route for video encoding
- Lemon Squeezy integration code
- License validation endpoint

## Next Steps for Production

### 1. Implement Video Encoding
The `/api/encode-video.ts` file has placeholder code. To make it functional:
- Install FFmpeg or ffmpeg.wasm
- Implement frame stitching
- Add watermark for free tier
- Upload to cloud storage (S3, Cloudflare R2, etc.)

### 2. Publish Plugin
- Get unique plugin ID from Figma
- Update `manifest.json` with real ID
- Submit to Figma Community
- Wait for review approval

### 3. Launch Landing Page
- Deploy `landing/index.html` to Vercel/Netlify
- Set up domain (e.g., protovid.app)
- Update all links in plugin and landing page

### 4. Marketing
- Post on Figma Community forums
- Share on Twitter, Product Hunt
- Create demo video showing the plugin
- Write tutorial blog posts

## Troubleshooting

### Plugin won't load
- Make sure you ran `npm run build`
- Check that `dist/` directory exists and has files
- Try restarting Figma Desktop

### "No prototype found" error
- Make sure your Figma file has prototype interactions
- Interactions must be on the current page
- Check that frames have click/tap actions set up

### Build errors
- Delete `node_modules/` and run `npm install` again
- Make sure TypeScript version is compatible
- Check for syntax errors in .ts/.tsx files

### License validation not working
- In development, use test keys: `DEV_TEST_KEY`
- Backend API must be deployed and accessible
- Check network tab in browser dev tools (Ctrl+Shift+I in plugin)

## Support

- GitHub Issues: https://github.com/anish632/protovid-figma/issues
- Email: support@protovid.app (placeholder)
- Documentation: README.md

---

Built with ❤️ for designers
