/**
 * Manual Trial Cancellation Script
 * For processing support requests like Iva Rušin's cancellation
 * Run with: npx tsx backend/scripts/cancel-trial.ts <email> [--force]
 */

import { getSubscription, setSubscription } from '@/lib/storage';
import { getStripe } from '@/lib/stripe';
import { recordEvent } from '@/lib/events';

async function cancelTrialSubscription(email: string, force: boolean = false) {
  try {
    console.log(`Processing trial cancellation for: ${email}`);
    
    const normalizedEmail = email.toLowerCase().trim();
    const subscription = await getSubscription(normalizedEmail);

    console.log(`Current subscription status:`);
    console.log(`  Email: ${subscription.email}`);
    console.log(`  Tier: ${subscription.tier}`);
    console.log(`  Status: ${subscription.status}`);
    console.log(`  Stripe Subscription ID: ${subscription.stripeSubscriptionId || 'None'}`);

    // Check if this is an active trial
    if (subscription.tier !== 'pro' || subscription.status !== 'trialing') {
      if (!force) {
        throw new Error(`Cannot cancel: User does not have an active trial. Current: tier=${subscription.tier}, status=${subscription.status}`);
      } else {
        console.warn(`Warning: Forcing cancellation of non-trial subscription (tier=${subscription.tier}, status=${subscription.status})`);
      }
    }

    // If user has a Stripe subscription, cancel it in Stripe
    if (subscription.stripeSubscriptionId) {
      console.log(`Cancelling Stripe subscription: ${subscription.stripeSubscriptionId}`);
      try {
        const stripe = getStripe();
        const stripeSub = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
        
        // Only cancel if it's still in trial
        if (stripeSub.status === 'trialing') {
          await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
          console.log(`✓ Stripe subscription cancelled successfully`);
        } else {
          console.log(`⚠ Stripe subscription status is "${stripeSub.status}", not cancelling`);
        }
      } catch (stripeError) {
        console.error(`✗ Error cancelling Stripe subscription:`, stripeError);
        console.log(`  Continuing with database cancellation...`);
      }
    }

    // Update subscription status in database
    console.log(`Updating database subscription status...`);
    await setSubscription(normalizedEmail, {
      tier: 'free',
      status: 'canceled',
      stripeSubscriptionId: undefined,
      currentPeriodEnd: undefined,
    });
    console.log(`✓ Database subscription updated to: tier=free, status=canceled`);

    // Record the cancellation event
    await recordEvent(normalizedEmail, 'trial_cancelled_manually', {
      source: 'support_request',
      request_email: email,
      previous_tier: subscription.tier,
      previous_status: subscription.status,
      stripe_subscription_id: subscription.stripeSubscriptionId || null,
    });
    console.log(`✓ Cancellation event recorded`);

    // Verify the cancellation
    const updatedSubscription = await getSubscription(normalizedEmail);
    console.log(`\nVerification:`);
    console.log(`  New Tier: ${updatedSubscription.tier}`);
    console.log(`  New Status: ${updatedSubscription.status}`);
    console.log(`  Stripe Subscription ID: ${updatedSubscription.stripeSubscriptionId || 'None'}`);

    if (updatedSubscription.tier === 'free' && updatedSubscription.status === 'canceled') {
      console.log(`\n✅ SUCCESS: Trial subscription for ${email} has been cancelled`);
      return {
        success: true,
        email: normalizedEmail,
        message: `Trial subscription cancelled successfully. No charges will be applied.`,
        previousStatus: { tier: subscription.tier, status: subscription.status },
        newStatus: { tier: updatedSubscription.tier, status: updatedSubscription.status },
      };
    } else {
      throw new Error(`Verification failed: subscription not properly cancelled`);
    }

  } catch (error) {
    console.error(`\n❌ ERROR: ${error instanceof Error ? error.message : String(error)}`);
    return {
      success: false,
      email,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Main execution
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: npx tsx backend/scripts/cancel-trial.ts <email> [--force]');
  console.log('');
  console.log('Example:');
  console.log('  npx tsx backend/scripts/cancel-trial.ts iva@clarion.agency');
  console.log('  npx tsx backend/scripts/cancel-trial.ts user@example.com --force');
  process.exit(1);
}

const email = args[0];
const force = args.includes('--force');

cancelTrialSubscription(email, force)
  .then(result => {
    if (result.success) {
      console.log('\n' + '='.repeat(60));
      console.log('CANCELLATION CONFIRMATION');
      console.log('='.repeat(60));
      console.log(`Email: ${result.email}`);
      console.log(`Status: CANCELLED`);
      console.log(`Previous: tier=${result.previousStatus?.tier}, status=${result.previousStatus?.status}`);
      console.log(`Current: tier=${result.newStatus?.tier}, status=${result.newStatus?.status}`);
      console.log('\nNo charges will be applied to this user.');
      console.log('='.repeat(60));
      process.exit(0);
    } else {
      console.error('\nCancellation failed:', result.error);
      process.exit(1);
    }
  });