# 🎬 ProtoVid — Prototype Video Exporter for Figma

Export your Figma prototypes as high-quality MP4 and GIF videos. Perfect for stakeholder presentations, documentation, and sharing design flows.

## Features

- **Prototype Flow Detection** — Automatically scans and captures your entire prototype flow
- **Multiple Resolutions** — Export in 720p, 1080p, or 4K
- **Frame Rate Control** — 30fps or 60fps
- **MP4 & GIF Export** — MP4 for presentations, GIF for easy sharing
- **Cursor Animation** — Optional animated cursor showing interaction flow
- **Persistent State** — License key and export count saved across sessions

## Free vs Premium

| Feature | Free | Premium ($12/mo) |
|---------|------|-------------------|
| Exports | 3 total | Unlimited |
| Resolution | 720p | Up to 4K |
| Format | MP4 only | MP4 + GIF |
| Watermark | Yes | No |

## Installation

1. Open Figma Desktop
2. Go to **Plugins → Search** and find "ProtoVid"
3. Click **Install**

Or install directly from the [Figma Community page](https://www.figma.com/community/plugin/protovid).

## Usage

1. Open a Figma file with prototype interactions
2. Run **Plugins → ProtoVid**
3. Configure export settings (resolution, frame rate, format)
4. Click **Export Video**
5. Download your video file

### Premium Activation

1. Purchase a license at [protovid.lemonsqueezy.com](https://protovid.lemonsqueezy.com)
2. Copy your license key from the confirmation email
3. In the plugin, paste the key and click **Validate License**
4. Premium features unlock immediately (key is saved for future sessions)

## Development

### Plugin (Figma)

```bash
npm install
npm run build    # Build plugin
npm run watch    # Watch mode for development
```

Load in Figma via **Plugins → Development → Import plugin from manifest**.

### Backend (Vercel)

```bash
cd backend
npm install
npm run dev      # Local dev server
```

The backend handles:
- License key validation via Lemon Squeezy API
- Video encoding (future: server-side FFmpeg)

### Environment Variables (Backend)

| Variable | Description |
|----------|-------------|
| `LEMON_SQUEEZY_API_KEY` | Lemon Squeezy API key for license validation |

### Dev License Keys

For development/testing, these prefixes bypass API validation:
- `DEV_*` — Development mode
- `PREMIUM_*` — Simulates premium

## Architecture

```
protovid-figma/
├── src/
│   ├── code.ts          # Plugin sandbox code (Figma API)
│   ├── ui.tsx           # Plugin UI (Preact)
│   └── ui.html          # UI shell + styles
├── backend/
│   └── app/api/
│       ├── validate-license/route.ts   # License validation
│       └── encode-video/route.ts       # Video encoding
├── landing/
│   └── index.html       # Marketing landing page
├── manifest.json        # Figma plugin manifest
└── build.js             # Build script
```

## Tech Stack

- **Plugin**: TypeScript + Preact
- **Backend**: Next.js on Vercel
- **Payments**: Lemon Squeezy (license keys)
- **Video**: Client-side Canvas API (server-side FFmpeg planned)

## License

MIT
