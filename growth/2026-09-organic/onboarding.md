# Behavior-triggered sequence — prepared specification, inactive

Use existing plugin event/state handling for anonymous actors. Do not turn analytics email capture into marketing permission. Existing billing recovery has its own ledger and cron; do not add onboarding to that cron or modify subscriber grace, recovery, cancellation, or support commitments.

| Message | Trigger and delivery | Suppression and frequency | Exact copy / CTA |
| --- | --- | --- | --- |
| Setup help | In product, `flow_detection_failed` with `no_connected_path`; show only when idle | Suppress immediately on `prototype_detected` or export success; at most once per session and twice per 7 days; dismiss for 7 days | “Connect two frames to start. In Figma’s Prototype tab, choose Navigate to, then refresh the flow.” CTA: “Build a three-screen example” → /guides/first-export |
| Finish the proof | In product after first valid `export_completed` and before download | Suppress on download; once per export ID; no modal blocking the file | “Your MP4 is ready. Download it and check the text, crop, and transitions before sharing.” CTA: “Download MP4” using the existing download action |
| Checkout recovery | In product on next open, 24–72h after `checkout_created` without verified purchase | Check current entitlement and Stripe session status first; suppress paid, pending, active/trialing/grace accounts and explicit cancellation; one per checkout session, max one per actor per 7 days; expire after 7 days | “Still need the final export? Check payment status before trying again. Use the same ProtoVid email.” CTA: existing “Check payment status”; secondary pricing link only after unpaid is verified |
| Repeat job | In product on a later visit 3–14 days after first success | Suppress if another export succeeded on a later date or any paid access exists; once ever; respect 7-day dismissal | “Working on another walkthrough? Duplicate your master page, replace the screen content, and check the connections.” CTA: “Try the SaaS example” → /guides/examples/saas-walkthrough |

Global proposed cap: one discretionary onboarding/recovery message per session, no more than two per actor in a rolling seven days, and never during encoding or checkout. Priority: payment status > setup > repeat job. Success/download guidance can remain inline. Persist dismissals on the device; reset identities are a measurement limitation, not permission to reconstruct identity. Use a durable ledger for any server-delivered messages, keyed by actor + rule version + export/session ID. Re-evaluate suppression immediately before display, not only when scheduling. Failed/ambiguous delivery never creates a second attempt with a fresh dedupe key.

## Optional email variant — not activated

Only for an identified person who explicitly requested a checkout reminder. No such consent field is verified in the existing infrastructure; therefore eligible recipient count is currently unknown, not the anonymous-actor total. Do not send based solely on an email typed for billing.

Trigger: checkout older than 24h but less than 72h, current Stripe status unpaid/expired, no active entitlement, reminder consent true, no prior message for this checkout, not unsubscribed/bounced/complained. Limit: one reminder per checkout and one per recipient in 7 days; never send after payment, after explicit cancellation, or while payment is pending. Recheck before sending. Use a normal pricing/account link, never an expired or exposed private checkout URL.

Subject: Finish your ProtoVid export when you’re ready

“You asked for a reminder about your ProtoVid checkout. Before trying again, reopen ProtoVid and check payment status with the same email. If you still need paid access, Project Pass is a one-time seven-day purchase; Studio renews monthly until canceled. You can continue with the available Free allowance.”

CTA: Review options → https://protovid.dasgroupllc.com/pricing
Footer: “You requested this reminder. Stop reminders using your email preferences.” A real working preference link is mandatory before enabling this variant.

## Existing infrastructure and activation gates

`backend/lib/billingNotification.ts` already provides persisted milestone dedupe and Resend idempotency for billing service notices. `BILLING_RECOVERY.md` describes Stripe-owned failure/verification emails and ProtoVid access notices. Keep these separate from marketing. Source configuration and actual sender operation must be checked before enabling any new delivery; no send was tested here.

Implementation remains a proposal: no new scheduler, consent capture, marketing email ledger, or behavioral messages were wired into production or plugin code. Prefer the in-product sequence first. Validate with local fixtures: success just before delivery, duplicate event, dismissal, pending payment, paid entitlement on another device, clock boundary, provider timeout, and no email identity. Run a read-only eligibility preview and inspect aggregate counts before requesting activation approval.

Written support macro: “Please send the plugin version, the step that failed, and the error text. For a missing flow, check that Navigate to points to a frame on the same page. For payment, use Check payment status with your checkout email before buying again. Please omit card details and private client files.” No meetings or response-time promise.
