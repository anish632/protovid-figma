import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhook } from '@/lib/stripe';
import { setSubscription, findSubscriptionByCustomerId, findSubscriptionBySubscriptionId } from '@/lib/storage';
import Stripe from 'stripe';

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
        const email = session.customer_email || session.metadata?.email;

        if (!email) {
          console.error('No email in checkout session');
          break;
        }

        setSubscription(email, {
          tier: 'pro',
          status: 'active',
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
        });
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const existing = findSubscriptionByCustomerId(customerId);
        if (!existing) {
          console.warn('No subscription found for customer:', customerId);
          break;
        }

        const isActive = ['active', 'trialing'].includes(subscription.status);
        setSubscription(existing.email, {
          tier: isActive ? 'pro' : 'free',
          status: subscription.status as any,
          stripeSubscriptionId: subscription.id,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        
        const existing = findSubscriptionBySubscriptionId(subscription.id);
        if (!existing) {
          console.warn('No subscription found for ID:', subscription.id);
          break;
        }

        setSubscription(existing.email, {
          tier: 'free',
          status: 'canceled',
        });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const existing = findSubscriptionByCustomerId(customerId);
        if (existing) {
          setSubscription(existing.email, {
            status: 'past_due',
          });
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

// Disable body parsing for webhook
export const config = {
  api: {
    bodyParser: false,
  },
};
