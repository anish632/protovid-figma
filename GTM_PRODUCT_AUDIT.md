# ProtoVid — GTM Product Audit

**Date:** 2026-05-19
**Status:** P2 — fix monetization
**Users:** 271 installs, $0 revenue

---

## Portfolio matrix position

| Signal | Value |
|---|---|
| Platform | Figma Community |
| Users | 271 |
| Revenue | $0 |
| Classification | fix monetization |
| Priority | P2 |
| First-value event | First completed MP4 export |
| Proof metric | Prototypes created, exports completed |
| Earned review trigger | After first successful export |
| Shareable artifact | Exported MP4 video |

---

## How a cold user finds it

Figma Community search: "prototype video", "record figma prototype", "figma to mp4", "export prototype". Plugin title and description carry all discoverability weight — no external SEO.

## Demo/sample state

No demo state exists. Users must have a prototype-connected Figma document open to see any value. Cold users who open the plugin on a blank canvas see the empty state immediately.

## First-value event

Defined as: **first MP4 downloaded after export completes.**

Current path:
1. Open plugin
2. Enter email (gate)
3. Export Video button
4. Download MP4

## Proof metric

- Frames captured per export
- Video duration (frameCount × 2s)
- Export resolution

Displayed on success screen after each export (added in this release).

---

## Changes made in this release (2026-05-19)

### Success screen
- Title changed: "Export Complete!" → "Prototype Video Exported"
- Added export metadata panel: filename, duration (seconds), resolution, frame count
- Download button is now `btn-large` for stronger CTA weight
- Review card copy updated: clearer earned framing ("if this saved a screen recording session")

### Empty state
- Email-gate no-prototype state: replaced vague paragraph with numbered 4-step guide (select frames → Prototype tab → drag handle → reopen)
- Setup stage no-prototype alert: replaced with inline 3-step guide + "Scan Prototype" call-to-action

### Analytics events added (additive — no existing events renamed)
| New event | Trigger |
|---|---|
| `prototype_detected` | `handleInit()` when prototype graph is non-empty |
| `export_started` | Beginning of `handleExportVideo()` (alongside existing `export`) |
| `paywall_viewed` | When free limit blocks export (`export_blocked` still fires too) |
| `export_success` | `handleEncodingComplete()` (alongside existing `export_completed`) |
| `export_failed` | `encoding-failed` message from UI encoder |
| `subscription_started` | `handleOpenCheckout()` (alongside existing `checkout_start`) |
| `track-event` IPC | New message type in sandbox to let UI post events |

### Watermark
No change. `drawWatermark()` in `encoder.ts` already applies a bottom-bar watermark for free exports. Text: "Made with love by ProtoVid - protovid.dasgroupllc.com".

---

## Monetization model (current)

| Tier | Price | Export limit | Resolution | Watermark |
|---|---|---|---|---|
| Free | $0 | 1/month, resets 1st | 720p only | Yes |
| Pro | $8/mo | Unlimited | 720p / 1080p / 4K | No |

Stripe subscription via `/api/billing/checkout`. Auto-detected via 60s payment poll after checkout opens.

---

## Funnel gaps (not yet fixed — backlog)

1. **No demo/sample state**: Users opening the plugin on a blank page see the empty state immediately and may close without understanding the value. A static demo GIF or animated preview in the email-gate would help. Requires embedding an asset — deferred.

2. **Free tier limit is 1/month**: This is very tight. A 2-export/month free tier with a harder paywall at export 3 may convert better, but needs A/B data. Do not change without measuring the current conversion rate first.

3. **No social proof on plugin listing**: The plugin has 271 users but 0 Figma Community reviews. The review prompt on the success screen is the primary lever. Review click rate from `review_prompt_shown` vs `review_prompt_clicked` in the analytics DB will indicate whether copy changes are needed.

4. **No Pro feature teaser in free flow**: Free users see 1080p/4K as greyed options in the resolution dropdown but there is no "preview what Pro looks like" state. A side-by-side watermark/no-watermark comparison image would increase upgrade intent.

5. **Figma Community description**: Should lead with the first-value event ("Export your Figma prototype as an MP4 video — no screen recording needed") and proof metrics. Update separately via Figma dashboard.

---

## Manual steps remaining

1. **Figma Community listing update**: Log in to figma.com/community, navigate to the plugin, update description to lead with first-value event and mention free tier + Pro.
2. **Screenshot updates**: Capture updated success screen showing the export metadata panel. Replace existing screenshots.
3. **Monitor analytics funnel**: After deploy, check `review_prompt_shown` vs `review_prompt_clicked` ratio in `/api/stats` to see if the new copy moves conversion.
4. **Monitor paywall_viewed**: Track how many free users hit the paywall and do not upgrade. If >50% leave without upgrading, revisit free tier limit.
