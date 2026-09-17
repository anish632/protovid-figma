# Billing recovery

Existing subscribers with a previously paid invoice receive seven days of paid access
from the failed renewal invoice's finalization. First purchases and unpaid trials do
not receive grace. A retry never resets the deadline. Cancellation ends paid access.
Server export/encoding checks use the same policy, including the exact expiry boundary.

Stripe owns payment-failure and 3D Secure emails. Verify **Send emails when card payments
fail** and **Send a Stripe-hosted link for customers to confirm payments** in Stripe
Billing recovery settings. Authentication-required webhook delivery is enabled for
ProtoVid's existing production endpoint.

ProtoVid sends one access-ending notice within 48 hours of the grace deadline, then
an access-paused notice if unresolved, a cancellation confirmation when canceled, and
an access-restored notice when the same subscription recovers. It does not email on
every failed retry. A daily authenticated cron reconciles current Stripe state before
choosing notifications. Webhooks also reconcile current state, so stale failed-payment
events do not overwrite a recovered subscription.

## Email activation

Configure `RESEND_API_KEY`, `BILLING_MANAGEMENT_EMAIL_FROM` (verified domain/sender), and
`BILLING_SUPPORT_EMAIL` in Vercel, then redeploy. Until configured, no ProtoVid access
emails are sent; the notification ledger remains pending. Stripe-hosted portal login
emails do not require Resend. Portal links are configured separately through
`STRIPE_CUSTOMER_PORTAL_LOGIN_URL` and `STRIPE_CUSTOMER_PORTAL_CONFIGURATION_ID`.

The notification key deduplicates by subscription, invoice, and access milestone.
Provider acceptance records `provider_id` and `sent_at`; these are not proof of inbox
delivery or reading. Provider delivery/bounce webhooks are not configured. Failed or
ambiguous sends retry with the same Resend idempotency key for up to 23 hours. Older
ambiguous attempts remain for manual review to avoid duplicates. Pending old milestones
are not blindly drained: only the account's current applicable milestone is sent.

## Deployment and checks

- Apply `scripts/billing-recovery-migration.sql` before deployment (additive only).
- Run backend `npm test` and `npm run build`; root `npm test` builds the plugin.
- `scripts/validate-billing-ui.mjs` checks grace, paused, authentication, and canceled
  banners, recovery buttons, and narrow layout using the local UI harness.
- `/api/maintenance/billing-recovery` requires the existing `CRON_SECRET` bearer token.
- Publish the bundled Figma plugin v1.3.20 to ship the new in-product banners. Deploying
  Vercel alone updates access enforcement and the account page, not installed plugin UI.
- No real payment attempts or customer emails are needed for these checks.
