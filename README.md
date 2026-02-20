# 🎬 ProtoVid - Professional Prototype Video Exporter for Figma

Export your Figma prototypes as high-quality MP4 and GIF videos. Perfect for stakeholder presentations, documentation, and sharing your design work.

## Features

- ✅ **High-Quality Exports** - 720p, 1080p, and 4K resolution support
- 🎥 **Multiple Formats** - MP4 video and GIF animations
- 🖱️ **Cursor Animation** - Show interaction flow with animated cursor
- ⚡ **Frame Rate Control** - 30fps or 60fps output
- 🎨 **Prototype Flow Detection** - Automatically captures all prototype interactions
- 🔒 **License-Based Monetization** - Free tier + Premium via Lemon Squeezy

## Why ProtoVid?

Existing Figma video export tools produce "clunky" output with "bad quality." ProtoVid addresses the #1 requested Figma plugin feature with professional-grade video encoding.

## Installation

### For Development

1. Clone this repository:
```bash
git clone https://github.com/anish632/protovid-figma.git
cd protovid-figma
```

2. Install dependencies:
```bash
npm install
```

3. Build the plugin:
```bash
npm run build
```

4. Load in Figma:
   - Open Figma Desktop
   - Go to Menu → Plugins → Development → Import plugin from manifest
   - Select `manifest.json` from this directory
   - The plugin will appear in your plugins list

### For Users

Install from Figma Community (once published):
- Search "ProtoVid" in Figma's plugin library
- Click "Install"
- Run from Plugins menu

## Usage

1. **Create a prototype** in Figma with interaction flows
2. **Open ProtoVid** from the Plugins menu
3. **Configure export settings**:
   - Resolution (720p, 1080p, 4K)
   - Frame rate (30fps, 60fps)
   - Format (MP4, GIF)
   - Cursor animation toggle
4. **Export** and download your video

### Free Tier
- 3 exports per month
- 720p resolution only
- MP4 format only
- Watermarked exports

### Premium ($12/month)
- Unlimited exports
- Up to 4K resolution
- MP4 and GIF formats
- No watermarks
- Priority support

Get Premium: [https://protovid.lemonsqueezy.com](https://protovid.lemonsqueezy.com)

## Technical Architecture

### Plugin Structure
- **src/code.ts** - Main plugin code (runs in Figma sandbox)
- **src/ui.tsx** - Plugin UI (Preact app, runs in iframe)
- **src/ui.html** - UI container HTML
- **build.js** - esbuild configuration
- **manifest.json** - Figma plugin manifest

### Backend (Vercel)
- **api/encode-video.ts** - Video encoding with FFmpeg
- **api/validate-license.ts** - Lemon Squeezy license validation

### Tech Stack
- TypeScript
- Preact (lightweight React alternative for UI)
- esbuild (fast bundling)
- Next.js API routes (backend)
- FFmpeg (video encoding)
- Lemon Squeezy (payments & licensing)

## Development

### Watch Mode
```bash
npm run watch
```

This will rebuild the plugin automatically when you make changes to source files.

### Testing
1. Make changes to source files
2. Rebuild (or use watch mode)
3. Reload plugin in Figma (Right-click plugin → "Reload plugin")

### Backend Setup

The plugin requires a backend for video encoding. Deploy to Vercel:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd api
vercel
```

Set environment variables in Vercel:
```bash
LEMON_SQUEEZY_API_KEY=your_api_key
```

Update `manifest.json` networkAccess with your Vercel domain.

## Monetization

ProtoVid uses **Lemon Squeezy** for external monetization because Figma's native paid plugin program is closed to new sellers.

### License Key Validation
- Free tier: enforced in plugin code (3 exports/month, 720p max)
- Premium: validated via API call to Lemon Squeezy
- License keys stored locally in plugin storage

### Upgrade Flow
1. User clicks "Get Premium" in plugin UI
2. Opens Lemon Squeezy checkout page
3. After purchase, user receives license key via email
4. User enters license key in plugin
5. Plugin validates key with backend API
6. Premium features unlocked

## Publishing

To publish to Figma Community:

1. Update `manifest.json` with unique plugin ID (get from Figma)
2. Build production version: `npm run build`
3. Submit to Figma Community review
4. Once approved, users can install from Figma

## Roadmap

- [ ] Implement actual FFmpeg video encoding
- [ ] Add frame interpolation for smoother animations
- [ ] Timeline trimming/editing before export
- [ ] Custom cursor designs
- [ ] Audio narration support
- [ ] Batch export multiple prototypes
- [ ] Export templates (16:9, 4:3, 9:16, etc.)

## Contributing

Contributions welcome! Please open an issue first to discuss changes.

## License

MIT License - see LICENSE file

## Support

- Email: support@protovid.app
- GitHub Issues: [github.com/anish632/protovid-figma/issues](https://github.com/anish632/protovid-figma/issues)
- Documentation: [protovid.app/docs](https://protovid.app/docs)

---

Made with ❤️ for designers
