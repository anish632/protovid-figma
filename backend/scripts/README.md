# ProtoVid Revenue & Usage Analysis Scripts

This directory contains scripts for analyzing ProtoVid's actual revenue, usage, and customer data.

## Quick Start

### 1. Set up your environment

Create a `.env` file in the `backend` directory with your credentials:

```bash
cd /Users/anishdas/Apps\ Portfolio/Apps-ZMore/protovid-figma/backend

# Create .env file
cat > .env << 'EOF'
STRIPE_SECRET_KEY=sk_live_... OR sk_test_...
NEON_DATABASE_URL=postgresql://...@.../neondb?sslmode=require
PROTOVID_ADMIN_KEY=your-secret-admin-key
NEXT_PUBLIC_APP_URL=https://protovid.dasgroupllc.com
EOF
```

### 2. Install dependencies

```bash
cd /Users/anishdas/Apps\ Portfolio/Apps-ZMore/protovid-figma/backend
npm install
```

## Available Scripts

### 🎯 all-customers-revenue.ts
**Purpose**: Complete revenue audit showing ALL customers, subscriptions, charges, and revenue metrics.

**Run**:
```bash
npx tsx scripts/all-customers-revenue.ts
```

**Output**:
- Total customers and subscriptions
- MRR (Monthly Recurring Revenue)
- Total revenue (all time)
- Net revenue (after refunds)
- Active, trial, and canceled subscriptions
- Detailed breakdown for each customer
- All successful charges
- Refunded charges

**Example Output**:
```
📈 PROTOVID REVENUE SUMMARY
============================================================

🎯 Customer Metrics:
   Total Customers: 5
   Total Subscriptions: 7
   Database Subscriptions: 12
   Pro Subscriptions (DB): 3

💰 Revenue Metrics:
   MRR: $15.00
   Active Paid Subscriptions: 3
   Trial Subscriptions: 2
   Total Revenue (All Time): $45.00
   Total Refunded: $5.00
   Net Revenue: $40.00
```

---

### 📊 db-revenue-query.sql
**Purpose**: SQL queries to run directly against your Neon Postgres database.

**How to Run**:

Option A: Using psql
```bash
psql $NEON_DATABASE_URL -f scripts/db-revenue-query.sql
```

Option B: Using a GUI (Recommended)
1. Open your database GUI (pgAdmin, DBeaver, TablePlus, etc.)
2. Connect to your Neon database
3. Open `scripts/db-revenue-query.sql`
4. Run each query section

**Contains Queries For**:
- Overall metrics (subscriptions, users)
- Revenue tracking (payments, subscriptions, checkouts)
- Funnel analysis (30-day conversion rates)
- Export usage (by month, by user, success vs failure)
- Free tier usage
- Recent activity
- Stripe webhook events
- Pricing experiment results

---

## API Endpoints

### GET /api/revenue/summary
**Purpose**: REST API endpoint for programmatic revenue access.

**Requires**: Admin key header (`x-admin-key`)

**Example Request**:
```bash
curl https://protovid.dasgroupllc.com/api/revenue/summary \
  -H "x-admin-key: YOUR_ADMIN_KEY"
```

**Example Response**:
```json
{
  "timestamp": "2026-07-10T10:00:00.000Z",
  "summary": {
    "totalCustomers": 5,
    "totalSubscriptions": 7,
    "activeSubscriptions": 3,
    "trialSubscriptions": 2,
    "mrr": 15.00,
    "totalRevenueAllTime": 45.00,
    "totalRefunded": 5.00,
    "netRevenue": 40.00,
    "databaseSubscriptions": 12,
    "paymentEventsRecorded": 8
  },
  "customers": [...],
  "subscriptions": [...],
  "recentPayments": [...]
}
```

---

## How to Use These Scripts

### Daily Revenue Check
```bash
# Quick revenue summary
npx tsx scripts/all-customers-revenue.ts
```

### Monthly Analysis
```bash
# 1. Run the revenue script and save output
npx tsx scripts/all-customers-revenue.ts > revenue-report-$(date +%Y-%m-%d).txt

# 2. Query the database
psql $NEON_DATABASE_URL -c "SELECT * FROM protovid_subscriptions" > subscriptions-$(date +%Y-%m-%d).csv
```

### Update GTM Audit
```bash
# Run the audit script
npx tsx scripts/all-customers-revenue.ts

# Copy the numbers into GTM_PRODUCT_AUDIT.md
```

---

## Security Notes

⚠️ **IMPORTANT**: 
- Never commit `.env` files with real API keys
- Keep your Stripe secret key secure
- The admin key should be a strong, random string
- Only run these scripts on trusted machines

---

## Troubleshooting

### "STRIPE_SECRET_KEY not found"
Make sure you have a `.env` file in the `backend` directory with your Stripe key.

### "NEON_DATABASE_URL not found"
Your database URL might be in a parent directory. The script checks multiple locations.

### "Permission denied"
Make sure the script has execute permissions:
```bash
chmod +x scripts/*.ts
```

### "Module not found"
Run `npm install` in the backend directory first.

---

## Files in This Directory

| File | Purpose |
|------|---------|
| `all-customers-revenue.ts` | Complete revenue audit script |
| `db-revenue-query.sql` | SQL queries for database analysis |
| `cancel-trial.ts` | Cancel trial subscriptions (existing) |
| `grant-free-pro.ts` | Grant free Pro access (existing) |
| `iva_stripe_audit.ts` | Audit Iva's Stripe data (existing) |
| `iva_cancel_and_refund.ts` | Process Iva's refund (existing) |
| `predict_trial_outcome.ts` | Predict trial conversion (existing) |
| `README.md` | This file |

---

## Need More Help?

Check the main documentation:
- `../README.md` - Project overview
- `../GTM_PRODUCT_AUDIT.md` - Growth metrics
- `../DEPLOYMENT_CHECKLIST.md` - Deployment guide
