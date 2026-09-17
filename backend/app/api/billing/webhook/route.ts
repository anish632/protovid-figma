import { NextRequest, NextResponse } from 'next/server';
import { retrieveSubscription, verifyWebhook } from '@/lib/stripe';
import { setSubscription, findSubscriptionByCustomerId, findSubscriptionBySubscriptionId } from '@/lib/storage';
import { getCheckoutEmail, getCheckoutEventMetadata, getCheckoutSubscriptionUpdate } from '@/lib/checkoutConfirmation';
import { recordEvent } from '@/lib/events';
import Stripe from 'stripe';
import { syncBillingRecovery } from '@/lib/billingRecovery';
import { deliverBillingNotification } from '@/lib/billingNotification';

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

    const recordWebhookEvent = (
      email: string,
      eventType: string,
      metadata: Record<string, unknown> = {},
    ) => recordEvent(email, eventType, {
      ...metadata,
      event_id: `stripe:${event.id}:${eventType}`,
      stripe_event_id: event.id,
    }, 'webhook');

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
        await recordWebhookEvent(email, 'email_captured', eventMetadata);
        if (session.metadata?.offer_type === 'large_flow_pass') {
          await recordWebhookEvent(email, 'large_flow_pass_purchased', eventMetadata);
        } else {
          await recordWebhookEvent(email, 'subscription_started', eventMetadata);
        }
        await recordWebhookEvent(email, 'checkout_completed', eventMetadata);
        await recordWebhookEvent(email, 'payment_confirmed', eventMetadata);
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

        // Ignore late events for an old subscription after a customer restarts.
        if (existing.stripeSubscriptionId && existing.stripeSubscriptionId !== subscription.id) break;
        const previousState = await findSubscriptionBySubscriptionId(subscription.id);
        if (!existing.stripeSubscriptionId) {
          await setSubscription(existing.email, { stripeSubscriptionId: subscription.id });
        }
        // Access is reconciled from current Stripe state below, once per event.

        // Track trial events
        if (subscription.status === 'trialing') {
          await recordWebhookEvent(existing.email, 'trial_started', {
            trial_end: subscription.trial_end,
            subscription_id: subscription.id,
          });
        } else if (subscription.status === 'active' && event.type === 'customer.subscription.updated') {
          // Check if this was a trial conversion
          if (previousState?.status === 'trialing') {
            await recordWebhookEvent(existing.email, 'trial_converted', {
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
          await recordWebhookEvent(existing.email, 'trial_ending_soon', {
            trial_end: subscription.trial_end,
            subscription_id: subscription.id,
          });
        }
        break;
      }

      case 'customer.subscription.deleted':
      case 'invoice.payment_failed':
      case 'invoice.payment_action_required':
        // Current state reconciliation below handles retries and late events.
        break;

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

        await recordWebhookEvent(existing.email, isRenewal ? 'subscription_renewed' : 'invoice_paid', {
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

    const billingEvents = ['customer.subscription.created', 'customer.subscription.updated',
      'customer.subscription.deleted', 'invoice.payment_failed', 'invoice.payment_action_required',
      'invoice.paid', 'invoice.payment_succeeded'];
    if (billingEvents.includes(event.type)) {
      const object = event.data.object as { customer?: string | { id: string } | null };
      const customerId = typeof object.customer === 'string' ? object.customer : object.customer?.id;
      const existing = customerId ? await findSubscriptionByCustomerId(customerId) : null;
      if (existing) {
        const current = await syncBillingRecovery(existing.email);
        try { await deliverBillingNotification(current); }
        catch (error) { console.error('Billing email deferred to scheduled recovery:', error); }
      }
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
