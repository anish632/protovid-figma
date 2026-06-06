# ProtoVid Paid Path Verification

Use this checklist after deploying backend changes or testing Stripe in test mode.

## Successful Checkout

1. Start checkout from the plugin with the same email the user will keep in ProtoVid.
2. Complete Stripe checkout.
3. On `/success?session_id=...`, confirmation should call `/api/billing/confirm-session`.
4. The Stripe webhook should also process `checkout.session.completed`.

Expected persistence:

- `protovid_subscriptions.email` matches the checkout email.
- `tier = 'pro'`.
- `status = 'active'` or `trialing`.
- `stripe_customer_id` and `stripe_subscription_id` are present when Stripe returned them.

Expected attribution events:

- `checkout_completed`
- `payment_confirmed`
- Metadata includes `pricing_variant`, `price_label`, and `amount_cents`.

## Plugin Unlock

1. Return to the plugin after checkout.
2. The automatic poll calls `/api/validate-license`.
3. If polling times out, click **Already paid? Check payment status**.

Expected response:

- `valid: true`
- `tier: "pro"`
- `isPremium: true`
- `canExport: true`

Expected UI:

- Pro text shows `Pro - Client-ready exports, no watermark`.
- 1080p and 4K can be selected.
- Export button says `Export Client-Ready MP4`.
- Exported videos are not watermarked.

## Cold Start Persistence

Close and reopen ProtoVid with the same saved email.

Expected behavior:

- `/api/exports/check` returns `isPremium: true`.
- Free export count is not used for gating.
- Pro UI remains unlocked.
