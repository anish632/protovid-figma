# Figma prototype to MP4 for client delivery

Send a booking flow your client can play without opening Figma.

Worked example: **Cedar appointment booking**, a fictional design exercise. The clip communicates the proposed booking experience; it does not make a real booking.

## Build the reusable Figma sample

No native Figma file or actual ProtoVid video was created in this session: no callable Figma editor connection is available. These exact construction instructions are the deliverable. The existing plugin example generator can provide a connected starting point; its three generic screens are not these finished samples.

1. Create a design page named `Cedar appointment booking`. Create three top-level frames, each 1280 × 720, at x=0, 1400, 2800 and y=0. Set Clip content on and fill #F5F7F4.
2. Inside each frame add a 1152 × 72 header at (64,48), fill #173E32, radius 12. Add `Cedar appointment booking` at (88,70), Inter Regular 24, white.
3. Add the screen title at (64,168), Inter Regular 48, color #173E32. Add the body at (64,252), width 1050, Inter Regular 28, color #344B43. Add a button rectangle at (64,520), 360 × 64, fill #173E32, radius 12; its label at (88,538), Inter Regular 24, white. Use the exact text below.

| Frame name | Title | Body | Button |
| --- | --- | --- | --- |
| 01 — Choose a visit | Choose a visit | Design consultation · 30 minutes · Tuesday 10:00 | Review booking |
| 02 — Review your booking | Review your booking | Design consultation · Tuesday 10:00 · Online | Confirm booking |
| 03 — Booking confirmed | Booking confirmed | Your design consultation is booked. | Back to overview |

4. In Prototype, connect the first frame to the second and the second to the third: On click → Navigate to → Dissolve → 300 ms → Ease in and out. Leave the last frame without an outgoing connection. Set the first frame as the flow starting point. Keep all three on this page.
5. Run ProtoVid, refresh the flow, and confirm all three frames appear in this order. If none appear, inspect the Navigate to destinations; adjacent frames alone are not a flow.
6. Select MP4, 720p, and a two-second frame duration if the installed version offers that control. Export and download the proof. Record the actual runtime rather than claiming a fixed duration; rendering and transition timing can differ.
7. Play the entire downloaded file. Check sequence, text, crop, transitions, and watermark. The free plan currently includes one watermarked export each month; choose one example for the free proof. Do not promise three free videos. A failed encode should restore its reserved allowance.
8. Save the Figma file as your master. Duplicate the page for the next project; replace copy and reconnect any changed destinations. For a clean final export, the displayed Project Pass is $4 once for seven days; Studio is $5/month, recurring until canceled. Check checkout before paying.

## What the output represents

Expected output: three screens joined by dissolves, rendered as an MP4. This is an output specification, not an exported-video preview. No cursor, voiceover, soundtrack, captions, live data, or usability results are implied. Add accessibility captions to a separate recorded tutorial, and identify those edits as tutorial production.

Ask the client to check the service, time, and confirmation wording.

**Try this workflow:** [Install ProtoVid](https://protovid.dasgroupllc.com/api/referrals/figma?source=guide_client_delivery). [Read the first-export guide](https://protovid.dasgroupllc.com/guides/first-export).

## Delivery note to copy

“Here is the cedar appointment booking concept walkthrough. It shows choose a visit → review your booking → booking confirmed. This video demonstrates the proposed interface. Please reply in writing with the screen and wording or interaction you would change.”
