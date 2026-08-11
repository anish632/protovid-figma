/**
 * Complete Revenue Audit Script
 * Shows ALL customers, subscriptions, charges, and revenue
 * Run with: npx tsx backend/scripts/all-customers-revenue.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import Stripe from 'stripe';
import { neon } from '@neondatabase/serverless';
import { getRefundedAmountCents, summarizeChargeRevenue } from '../lib/revenue';

function loadEnvFile(filePath: string) {
  const text = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    value = value.replace(/\\n/g, '\n').trim();
    process.env[key] = value;
  }
}

// Try multiple env file locations
const envPaths = [
  path.join(process.cwd(), '.env.production'),
  path.join(process.cwd(), '.env.local'),
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), '../../../.env.production'),
  path.join(process.cwd(), '../../../.env'),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    loadEnvFile(envPath);
    break;
  }
}

const stripeKey = process.env.STRIPE_SECRET_KEY;
const dbUrl = process.env.NEON_DATABASE_URL;

if (!stripeKey) {
  console.error('❌ STRIPE_SECRET_KEY not found. Set it in your environment.');
  console.log('   Create a .env file with:');
  console.log('   STRIPE_SECRET_KEY=sk_live_... or sk_test_...');
  process.exit(1);
}

if (!dbUrl) {
  console.error('⚠️  NEON_DATABASE_URL not found. Database queries will be skipped.');
}

const stripe = new Stripe(stripeKey, { apiVersion: '2026-01-28.clover' });
const sql = dbUrl ? neon(dbUrl) : null;

async function main() {
  console.log('🔍 ProtoVid Revenue Audit');
  console.log('=' .repeat(60));

  // 1. Get all customers
  console.log('\n📊 Fetching all customers...');
  const customers = await stripe.customers.list({ limit: 100 });
  console.log(`   Found ${customers.data.length} customers`);

  // 2. Get all subscriptions
  console.log('\n📋 Fetching all subscriptions...');
  const allSubscriptions = await stripe.subscriptions.list({ limit: 100 });
  console.log(`   Found ${allSubscriptions.data.length} subscriptions`);

  // 3. Get all charges
  console.log('\n💰 Fetching all charges...');
  const allCharges = await stripe.charges
    .list({ limit: 100 })
    .autoPagingToArray({ limit: 10_000 });
  console.log(`   Found ${allCharges.length} charges`);

  // 4. Get all invoices
  console.log('\n🧾 Fetching all invoices...');
  const allInvoices = await stripe.invoices.list({ limit: 100 });
  console.log(`   Found ${allInvoices.data.length} invoices`);

  // 5. Calculate MRR
  console.log('\n💸 Calculating MRR...');
  const activeSubs = allSubscriptions.data.filter(
    sub => sub.status === 'active' || sub.status === 'trialing'
  );
  
  let mrr = 0;
  let activeCount = 0;
  let trialingCount = 0;
  
  for (const sub of activeSubs) {
    const price = sub.items.data[0]?.price;
    if (price && price.unit_amount) {
      const amount = price.unit_amount / 100;
      mrr += amount;
      if (sub.status === 'active') activeCount++;
      if (sub.status === 'trialing') trialingCount++;
    }
  }

  // 6. Calculate total revenue
  console.log('\n💵 Calculating total revenue...');
  // Stripe preserves a charge's original amount after a refund. Calculate
  // gross paid revenue first, then subtract `amount_refunded` once so full
  // refunds are not double-subtracted and partial refunds remain accurate.
  const revenue = summarizeChargeRevenue(allCharges);
  const paidCharges = allCharges.filter(charge => charge.paid);
  const refundedCharges = paidCharges.filter(
    charge => getRefundedAmountCents(charge) > 0
  );
  const totalRevenue = revenue.grossRevenueCents / 100;
  const totalRefunded = revenue.refundedRevenueCents / 100;
  const netRevenue = revenue.netRevenueCents / 100;

  // 9. Database subscription count
  let dbSubCount = 0;
  let dbProCount = 0;
  if (sql) {
    try {
      const [dbSubs] = await sql`
        SELECT COUNT(*) as count FROM protovid_subscriptions
      `;
      const [dbPro] = await sql`
        SELECT COUNT(*) as count FROM protovid_subscriptions WHERE tier = 'pro'
      `;
      dbSubCount = parseInt(dbSubs.count);
      dbProCount = parseInt(dbPro.count);
    } catch (e) {
      console.log('   ⚠️  Could not query database:', e);
    }
  }

  // 10. Payment events from DB
  let dbPaymentEvents = 0;
  if (sql) {
    try {
      const [events] = await sql`
        SELECT COUNT(*) as count FROM protovid_events 
        WHERE event_type = 'payment_confirmed'
      `;
      dbPaymentEvents = parseInt(events.count);
    } catch (e) {
      console.log('   ⚠️  Could not query events:', e);
    }
  }

  // 11. Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📈 PROTOVID REVENUE SUMMARY');
  console.log('='.repeat(60));
  
  console.log('\n🎯 Customer Metrics:');
  console.log(`   Total Customers: ${customers.data.length}`);
  console.log(`   Total Subscriptions: ${allSubscriptions.data.length}`);
  console.log(`   Database Subscriptions: ${dbSubCount}`);
  console.log(`   Pro Subscriptions (DB): ${dbProCount}`);

  console.log('\n💰 Revenue Metrics:');
  console.log(`   MRR: $${mrr.toFixed(2)}`);
  console.log(`   Active Paid Subscriptions: ${activeCount}`);
  console.log(`   Trial Subscriptions: ${trialingCount}`);
  console.log(`   Total Revenue (All Time): $${totalRevenue.toFixed(2)}`);
  console.log(`   Total Refunded: $${totalRefunded.toFixed(2)}`);
  console.log(`   Net Revenue: $${netRevenue.toFixed(2)}`);

  console.log('\n📊 Payment Events:');
  console.log(`   Paid Charges: ${revenue.paidChargeCount}`);
  console.log(`   Refunded Charges: ${revenue.refundedChargeCount}`);
  console.log(`   Fully Refunded Charges: ${revenue.fullyRefundedChargeCount}`);
  console.log(`   Partially Refunded Charges: ${revenue.partiallyRefundedChargeCount}`);
  console.log(`   DB Payment Confirmed Events: ${dbPaymentEvents}`);

  // 12. Detailed customer breakdown
  console.log('\n' + '='.repeat(60));
  console.log('👥 CUSTOMER DETAILS');
  console.log('='.repeat(60));

  for (const customer of customers.data) {
    const customerEmail = customer.email || 'No email';
    const customerId = customer.id;
    
    // Get their subscriptions
    const subs = allSubscriptions.data.filter(
      sub => sub.customer === customerId
    );
    
    // Get their charges
    const charges = allCharges.filter(
      c => c.customer === customerId
    );
    
    const customerRevenueSummary = summarizeChargeRevenue(charges);
    const customerRevenue = customerRevenueSummary.grossRevenueCents / 100;
    const customerRefunded = customerRevenueSummary.refundedRevenueCents / 100;
    
    const activeSub = subs.find(sub => sub.status === 'active');
    const trialSub = subs.find(sub => sub.status === 'trialing');
    
    console.log(`\n${customerEmail} (${customerId})`);
    console.log(`   Status: ${activeSub ? '✅ ACTIVE PAYING' : trialSub ? '🎯 ON TRIAL' : '❌ INACTIVE'}`);
    console.log(`   Subscriptions: ${subs.length}`);
    console.log(`   Total Spent: $${customerRevenue.toFixed(2)}`);
    console.log(`   Total Refunded: $${customerRefunded.toFixed(2)}`);
    console.log(`   Net: $${(customerRevenue - customerRefunded).toFixed(2)}`);
    
    if (subs.length > 0) {
      const latestSub = subs[0] as any;
      console.log(`   Latest Subscription: ${latestSub.id} (${latestSub.status})`);
      if (latestSub.items.data[0]?.price) {
        const price = latestSub.items.data[0].price;
        console.log(`   Price: $${(price.unit_amount! / 100).toFixed(2)}/${price.recurring?.interval}`);
      }
      if (latestSub.current_period_end) {
        console.log(`   Period Ends: ${new Date(latestSub.current_period_end * 1000).toLocaleDateString()}`);
      }
    }
  }

  // 13. Print charge details
  console.log('\n' + '='.repeat(60));
  console.log('💳 PAID CHARGES (Gross Before Refunds)');
  console.log('='.repeat(60));

  for (const charge of paidCharges.slice(0, 20)) {
    const customer = customers.data.find(c => c.id === charge.customer);
    const refundedAmount = getRefundedAmountCents(charge);
    console.log(`\n${new Date(charge.created * 1000).toLocaleDateString()} - $${(charge.amount / 100).toFixed(2)}`);
    console.log(`   Customer: ${customer?.email || charge.customer}`);
    console.log(`   Charge ID: ${charge.id}`);
    console.log(`   Currency: ${charge.currency.toUpperCase()}`);
    console.log(`   Description: ${charge.description || 'ProtoVid subscription'}`);
    if (refundedAmount > 0) {
      console.log(`   Refunded: $${(refundedAmount / 100).toFixed(2)}; Net: $${((charge.amount - refundedAmount) / 100).toFixed(2)}`);
    }
  }

  // 14. Print refund details
  if (refundedCharges.length > 0) {
    console.log('\n' + '='.repeat(60));
    console.log('🔄 REFUNDED CHARGES');
    console.log('='.repeat(60));

    for (const charge of refundedCharges) {
      const customer = customers.data.find(c => c.id === charge.customer);
      const refundedAmount = getRefundedAmountCents(charge);
      console.log(`\n${new Date(charge.created * 1000).toLocaleDateString()} - $${(refundedAmount / 100).toFixed(2)} refunded from $${(charge.amount / 100).toFixed(2)}`);
      console.log(`   Customer: ${customer?.email || charge.customer}`);
      console.log(`   Charge ID: ${charge.id}`);
      console.log(`   ⚠️  ${refundedAmount >= charge.amount ? 'FULLY REFUNDED' : 'PARTIALLY REFUNDED'}`);
    }
  }

  // 15. Final summary
  console.log('\n' + '='.repeat(60));
  console.log('✅ AUDIT COMPLETE');
  console.log('='.repeat(60));
  console.log(`\nKey Findings:`);
  console.log(`   • You have ${customers.data.length} customers in Stripe`);
  console.log(`   • MRR: $${mrr.toFixed(2)}`);
  console.log(`   • Net Revenue: $${netRevenue.toFixed(2)}`);
  console.log(`   • ${activeCount} active subscriptions`);
  console.log(`   • ${trialingCount} trials`);
  console.log(`\n💡 Next: Update GTM_PRODUCT_AUDIT.md with these numbers`);
  console.log('='.repeat(60));
}

main().catch((err) => {
  console.error('\n❌ Error:', err);
  process.exit(1);
});
