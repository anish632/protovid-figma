# ProtoVid Backend - Vercel Deployment Guide

## Required Environment Variables

Add these to your Vercel project settings (Settings → Environment Variables):

### Stripe Configuration
```
STRIPE_SECRET_KEY=<your-stripe-restricted-api-key>
STRIPE_WEBHOOK_SECRET=<your-stripe-webhook-signing-secret>
PROTOVID_PRICE_ID=<your-stripe-price-id>
PROTOVID_PROJECT_PASS_PRICE_ID=<your-stripe-$4-one-time-price-id>
```

### App Configuration
```
NEXT_PUBLIC_APP_URL=<your-vercel-production-url>
BILLING_MANAGEMENT_TOKEN_SECRET=<32-byte-random-secret>
CRON_SECRET=<32-byte-random-secret-for-expired-share-cleanup>
```

### Secure billing recovery (recommended)

Completed Stripe Checkout sessions can mint a device-scoped management token.
To give existing customers a secure recovery path after they reinstall the
plugin, configure an email sender for one-time Stripe Portal links:

```
RESEND_API_KEY=<your-resend-api-key>
BILLING_MANAGEMENT_EMAIL_FROM=ProtoVid <billing@your-domain.com>
BILLING_SUPPORT_EMAIL=support@your-domain.com
```

Without the Resend variables, email-only portal and cancellation requests stay
blocked; customers are directed to support rather than being authorized by an
email address alone.

### Database Configuration
```
NEON_DATABASE_URL=<your-neon-postgres-connection-string>
```

⚠️ **Important:** The Neon database is a shared instance used by:
- ProtoVid (table prefix: `protovid_`)
- RecurringTasks
- ResolveAI

## Database Setup

Before first deployment, initialize the database table:

```bash
cd backend
npm install
NEON_DATABASE_URL="<your-neon-connection-string>" npx tsx lib/db-init.ts
```

This creates the `protovid_subscriptions` table with indexes.

## Deployment

```bash
# Install Vercel CLI if needed
npm i -g vercel

# Deploy to production
vercel --prod
```

## What Changed?

**Before:** Subscription data stored in-memory (lost on every cold start)  
**After:** Persistent storage in Neon Postgres

### Migration Impact
- ✅ No user-facing changes required
- ✅ No API changes
- ✅ No plugin code changes
- ✅ Existing Stripe webhooks work as-is
- ✅ All storage functions now async (already awaited in routes)

### Testing Checklist
- [ ] Verify `/api/validate-license` works with email
- [ ] Test Stripe checkout flow (creates subscription record)
- [ ] Test Stripe webhook events (subscription updates)
- [ ] Verify export count increments persist across cold starts
- [ ] Check that free tier limits reset monthly
- [ ] Verify the daily cleanup cron deletes expired review videos and comments

## Stripe Webhook

Webhook URL: `<your-production-url>/api/billing/webhook`

Events to subscribe to:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
