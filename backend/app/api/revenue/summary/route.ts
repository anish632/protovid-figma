/**
 * Revenue Summary API Endpoint
 * GET /api/revenue/summary - Returns current revenue metrics
 * Requires admin key for security
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { neon } from '@neondatabase/serverless';
import { getRefundedAmountCents, summarizeChargeRevenue, subscriptionMonthlyRevenueCents } from '@/lib/revenue';

function getDB() {
  if (!process.env.NEON_DATABASE_URL) {
    throw new Error('Database not configured');
  }
  return neon(process.env.NEON_DATABASE_URL);
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}

export async function GET(request: NextRequest) {
  try {
    // Admin key protection
    const adminKey = request.headers.get('x-admin-key');
    const expectedKey = process.env.PROTOVID_ADMIN_KEY?.trim() || process.env.STATS_API_KEY?.trim();
    
    if (!expectedKey || adminKey !== expectedKey) {
      return NextResponse.json({ 
        error: 'Unauthorized - admin key required' 
      }, { status: 403 });
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return NextResponse.json({ 
        error: 'Stripe not configured' 
      }, { status: 500 });
    }

    const stripe = new Stripe(stripeKey, { 
      apiVersion: '2026-01-28.clover' 
    });
    const sql = getDB();

    // Fetch data in parallel
    const [
      customers,
      subscriptions,
      charges,
      invoices,
      dbSubs,
      dbEvents,
      recentEvents
    ] = await Promise.all([
      stripe.customers.list({ limit: 100 }).autoPagingToArray({ limit: 100_000 }),
      stripe.subscriptions.list({ status: 'all', limit: 100 }).autoPagingToArray({ limit: 100_000 }),
      // Revenue is an all-time metric. Auto-pagination prevents the 101st
      // charge from silently disappearing from the calculation.
      stripe.charges.list({ limit: 100 }).autoPagingToArray({ limit: 10_000 }),
      stripe.invoices.list({ limit: 100 }).autoPagingToArray({ limit: 100_000 }),
      sql`SELECT COUNT(*) as count FROM protovid_subscriptions`,
      sql`SELECT COUNT(*) as count FROM protovid_events WHERE event_type = 'payment_confirmed'`,
      sql`
        SELECT email, event_type, created_at, metadata
        FROM protovid_events
        WHERE event_type IN ('payment_confirmed', 'subscription_started', 'checkout_completed')
        ORDER BY created_at DESC
        LIMIT 50
      `
    ]);

    // Normalize all recurring items; trials are access, not paid MRR.
    const mrr = subscriptions.reduce((sum, sub) => sum + subscriptionMonthlyRevenueCents(sub), 0) / 100;
    const activeCount = subscriptions.filter(sub => sub.status === 'active').length;
    const trialingCount = subscriptions.filter(sub => sub.status === 'trialing').length;

    // A refunded Stripe charge still has its original `amount`. Start from
    // every paid charge and subtract `amount_refunded` exactly once; filtering
    // refunded charges out before subtracting them double-counts the refund.
    const revenue = summarizeChargeRevenue(charges);
    const paidCharges = charges.filter(charge => charge.paid);
    const refundedCharges = paidCharges.filter(
      charge => getRefundedAmountCents(charge) > 0
    );

    // Database metrics
    const dbSubCount = parseInt(dbSubs[0]?.count || '0');
    const dbPaymentEvents = parseInt(dbEvents[0]?.count || '0');

    // Recent events
    const recentEventSummaries = recentEvents.map((e: any) => ({
      email: e.email,
      eventType: e.event_type,
      timestamp: e.created_at,
      metadata: e.metadata
    }));

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      summary: {
        // Customer metrics
        totalCustomers: customers.length,
        totalSubscriptions: subscriptions.length,
        activeSubscriptions: activeCount,
        trialSubscriptions: trialingCount,
        canceledSubscriptions: subscriptions.filter(s => s.status === 'canceled').length,
        
        // Revenue metrics
        mrr: mrr,
        // `totalRevenueAllTime` is retained for existing consumers and is
        // explicitly gross revenue before refunds.
        totalRevenueAllTime: revenue.grossRevenueCents / 100,
        grossRevenueAllTime: revenue.grossRevenueCents / 100,
        totalRefunded: revenue.refundedRevenueCents / 100,
        netRevenue: revenue.netRevenueCents / 100,
        
        // Database metrics
        databaseSubscriptions: dbSubCount,
        paymentEventsRecorded: dbPaymentEvents,
        
        // Charges
        paidCharges: revenue.paidChargeCount,
        // Backwards-compatible alias. This includes charges later refunded;
        // use `paidCharges` and the refund counts for unambiguous reporting.
        successfulCharges: revenue.paidChargeCount,
        refundedCharges: revenue.refundedChargeCount,
        fullyRefundedCharges: revenue.fullyRefundedChargeCount,
        partiallyRefundedCharges: revenue.partiallyRefundedChargeCount,
        totalCharges: charges.length,
        
        // Invoices
        totalInvoices: invoices.length,
        paidInvoices: invoices.filter(i => i.status === 'paid').length,
      },
      customers: customers.map(c => ({
        id: c.id,
        email: c.email,
        name: c.name,
        created: c.created,
      })),
      subscriptions: subscriptions.map((s: any) => ({
        id: s.id,
        customer: s.customer,
        status: s.status,
        currentPeriodEnd: s.current_period_end ? new Date(s.current_period_end * 1000).toISOString() : null,
        trialEnd: s.trial_end ? new Date(s.trial_end * 1000).toISOString() : null,
        price: s.items.data[0]?.price?.unit_amount ? s.items.data[0].price.unit_amount / 100 : null,
        currency: s.items.data[0]?.price?.currency || 'usd',
      })),
      recentPayments: paidCharges.slice(0, 20).map(c => {
        const refundedAmountCents = getRefundedAmountCents(c);
        return {
          id: c.id,
          amount: c.amount / 100,
          amountRefunded: refundedAmountCents / 100,
          netAmount: (c.amount - refundedAmountCents) / 100,
          currency: c.currency,
          customer: c.customer,
          created: new Date(c.created * 1000).toISOString(),
          refunded: refundedAmountCents > 0,
          fullyRefunded: c.amount > 0 && refundedAmountCents >= c.amount,
        };
      }),
      recentEvents: recentEventSummaries,
    });

  } catch (error) {
    console.error('Revenue summary error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch revenue summary',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
