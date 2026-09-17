# ProtoVid v1.3.24 — One-click connect & export

## What changed
When a page has frames but no prototype connections, ProtoVid previously dead-ended
on "No connected prototype flow found." The only in-file unblock was a canned example
that ignored the designer's real work — used just once in the trailing 30 days while
10 actors generated 43 no-connected-path failures.

This release adds a primary action on that screen: **Connect N frames & export**.
It wires the user's existing top-level frames left-to-right (by x, then y) into a
single ON_CLICK walkthrough using the same reaction machinery as the example flow,
then re-scans so the normal connected-path export takes over. The canned example
remains available as a secondary option. Users can rewire order anytime in the
Prototype tab.

## Why
Activation is the top funnel leak (production data, Sep 12): 55% of session actors
export at all, and the no-connected-path failure is the largest concrete blocker
upstream of every upgrade and payment. Turning that dead-end into a first export of
the user's own screens is higher-leverage than any pricing change at current volume.

## Instrumentation
- `setup_frames_autoconnect_requested` (UI) — user clicked the new action; carries frame count.
- `setup_frames_autoconnected` (sandbox) — reactions written; carries frame count.
- `setup_autoconnect_skipped` (sandbox) — fewer than 2 frames were present at click time.

Watch `setup_frames_autoconnect_requested → export_completed` within a session for the
next 30 affected actors; compare against the historical example-creation path.

## Validation
- Root TypeScript check: clean.
- Plugin unit tests: 38 pass (matcher 5, ui-model 27, preflight 6) + build.
- Backend unit tests: 55 pass; backend TypeScript check clean.

## Publish (manual — requires your Figma account)
1. Figma desktop → Plugins → Development → Import plugin from manifest → select this
   folder's `manifest.json`.
2. Run it on a page with 2+ unconnected frames to confirm the new action appears and
   produces an export.
3. Right-click the plugin → Publish new release for plugin `1606994616321079154`.
   Prices and backend are unchanged; no backend redeploy is required for this release.
