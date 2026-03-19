# ProtoVid Backend - Vercel Deployment Guide

## Required Environment Variables

Add these to your Vercel project settings (Settings → Environment Variables):

### Stripe Configuration
```
STRIPE_SECRET_KEY=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
STRIPE_WEBHOOK_SECRET=whsec_KuFwbpO5166I7xR3EaOEWLCN5JZLUzjQ
PROTOVID_PRICE_ID=price_1T4jsPKOR3CPCI6HRF130l7h
```

### App Configuration
```
NEXT_PUBLIC_APP_URL=https://backend-one-nu-28.vercel.app
```

### Database Configuration
```
NEON_DATABASE_URL=postgresql://neondb_owner:npg_Eekbuc84GiTW@ep-fragrant-dawn-ai5pgip6-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require
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
NEON_DATABASE_URL="postgresql://..." npx tsx lib/db-init.ts
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

## Stripe Webhook

Webhook URL: `https://backend-one-nu-28.vercel.app/api/billing/webhook`

Events to subscribe to:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`
