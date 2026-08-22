import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { retrieveSubscription, verifyWebhook } from '@/lib/stripe';
import { setSubscription, findSubscriptionByCustomerId, findSubscriptionBySubscriptionId } from '@/lib/storage';
import { getCheckoutEmail, getCheckoutEventMetadata, getCheckoutSubscriptionUpdate } from '@/lib/checkoutConfirmation';
import Stripe from 'stripe';

function getDB() {
  if (!process.env.NEON_DATABASE_URL) {
    throw new Error('Database not configured');
  }
  return neon(process.env.NEON_DATABASE_URL);
}

async function recordEvent(email: string, eventType: string, metadata: Record<string, unknown> = {}) {
  const sql = getDB();
  await sql`
    INSERT INTO protovid_events (
      email,
      event_type,
      plugin_version,
      metadata,
      created_at
    ) VALUES (
      ${email.toLowerCase().trim()},
      ${eventType},
      ${'webhook'},
      ${Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null},
      CURRENT_TIMESTAMP
    )
  `;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'No signature' }, { status: 400 });
    }

    let event: Stripe.Event;
    try {
      event = verifyWebhook(body, signature);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const email = getCheckoutEmail(session);

        if (!email) {
          console.error('No email in checkout session');
          break;
        }

        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null;
        let subscriptionUpdate = getCheckoutSubscriptionUpdate(session);

        if (subscriptionId) {
          try {
            const stripeSubscription = await retrieveSubscription(subscriptionId);
            const periodEnd = (stripeSubscription as any).current_period_end;
            subscriptionUpdate = {
              tier: ['active', 'trialing'].includes(stripeSubscription.status) ? 'pro' : 'free',
              status: stripeSubscription.status as any,
              stripeCustomerId: typeof session.customer === 'string' ? session.customer : undefined,
              stripeSubscriptionId: stripeSubscription.id,
              currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : undefined,
            };
          } catch (error) {
            console.warn('Failed to fetch Stripe subscription after checkout completion:', error);
          }
        }

        await setSubscription(email, subscriptionUpdate);
        const eventMetadata = getCheckoutEventMetadata(session, 'stripe_webhook', 'checkout.session.completed');
        // Anchor the anonymous-to-email identity so the stats funnel sees a
        // single actor across the pre-checkout plugin session and this
        // post-payment webhook. Plugin-side `email_captured` misses users who
        // close the plugin before the poll resolves.
        await recordEvent(email, 'email_captured', eventMetadata);
        if (session.metadata?.offer_type === 'large_flow_pass') {
          await recordEvent(email, 'large_flow_pass_purchased', eventMetadata);
        } else {
          await recordEvent(email, 'subscription_started', eventMetadata);
        }
        await recordEvent(email, 'checkout_completed', eventMetadata);
        await recordEvent(email, 'payment_confirmed', eventMetadata);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const existing = await findSubscriptionByCustomerId(customerId);
        if (!existing) {
          console.warn('No subscription found for customer:', customerId);
          break;
        }

        const previousState = await findSubscriptionBySubscriptionId(subscription.id);
        const isActive = ['active', 'trialing'].includes(subscription.status);
        const periodEnd = (subscription as any).current_period_end;
        await setSubscription(existing.email, {
          tier: isActive ? 'pro' : 'free',
          status: subscription.status as any,
          stripeSubscriptionId: subscription.id,
          currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : undefined,
        });

        // Track trial events
        if (subscription.status === 'trialing') {
          await recordEvent(existing.email, 'trial_started', {
            trial_end: subscription.trial_end,
            subscription_id: subscription.id,
          });
        } else if (subscription.status === 'active' && event.type === 'customer.subscription.updated') {
          // Check if this was a trial conversion
          if (previousState?.status === 'trialing') {
            await recordEvent(existing.email, 'trial_converted', {
              subscription_id: subscription.id,
            });
          }
        }
        break;
      }

      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const existing = await findSubscriptionByCustomerId(customerId);
        if (existing) {
          await recordEvent(existing.email, 'trial_ending_soon', {
            trial_end: subscription.trial_end,
            subscription_id: subscription.id,
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        
        const existing = await findSubscriptionBySubscriptionId(subscription.id);
        if (!existing) {
          console.warn('No subscription found for ID:', subscription.id);
          break;
        }

        await setSubscription(existing.email, {
          tier: 'free',
          status: 'canceled',
        });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const existing = await findSubscriptionByCustomerId(customerId);
        if (existing) {
          await setSubscription(existing.email, {
            status: 'past_due',
          });
        }
        break;
      }

      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : null;
        if (!customerId) break;

        const existing = await findSubscriptionByCustomerId(customerId);
        if (!existing) {
          console.warn('No subscription found for paid invoice customer:', customerId);
          break;
        }

        const invoiceWithSubscription = invoice as Stripe.Invoice & {
          subscription?: string | Stripe.Subscription | null;
        };
        const subscriptionId = typeof invoiceWithSubscription.subscription === 'string'
          ? invoiceWithSubscription.subscription
          : invoiceWithSubscription.subscription?.id || existing.stripeSubscriptionId || null;
        const billingReason = typeof invoice.billing_reason === 'string'
          ? invoice.billing_reason
          : null;
        const amountPaid = typeof invoice.amount_paid === 'number' ? invoice.amount_paid : null;
        const isRenewal = billingReason === 'subscription_cycle';

        if (subscriptionId) {
          try {
            const stripeSubscription = await retrieveSubscription(subscriptionId);
            const periodEnd = (stripeSubscription as any).current_period_end;
            await setSubscription(existing.email, {
              tier: ['active', 'trialing'].includes(stripeSubscription.status) ? 'pro' : 'free',
              status: stripeSubscription.status as any,
              stripeSubscriptionId: stripeSubscription.id,
              currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : undefined,
            });
          } catch (error) {
            console.warn('Failed to refresh subscription after paid invoice:', error);
          }
        }

        await recordEvent(existing.email, isRenewal ? 'subscription_renewed' : 'invoice_paid', {
          source: 'stripe_webhook',
          event: event.type,
          stripe_invoice_id: invoice.id,
          stripe_subscription_id: subscriptionId,
          billing_reason: billingReason,
          amount_cents: amountPaid,
          currency: invoice.currency || null,
        });
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
