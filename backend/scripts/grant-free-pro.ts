/**
 * Grant Free Pro Access Script
 * For offering complimentary Pro access (like the 3-month offer to Iva)
 * Run with: npx tsx backend/scripts/grant-free-pro.ts <email> <months>
 */

import { getSubscription, setSubscription } from '@/lib/storage';
import { recordEvent } from '@/lib/events';

async function grantFreePro(email: string, months: number) {
  try {
    console.log(`Processing free Pro grant for: ${email} (${months} months)`);
    
    const normalizedEmail = email.toLowerCase().trim();
    const subscription = await getSubscription(normalizedEmail);
    
    console.log(`Current subscription status:`);
    console.log(`  Email: ${subscription.email}`);
    console.log(`  Tier: ${subscription.tier}`);
    console.log(`  Status: ${subscription.status}`);
    console.log(`  Current Period End: ${subscription.currentPeriodEnd || 'None'}`);

    // Calculate end date (months from now)
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + months);
    
    console.log(`\nGranting ${months} months free Pro access...`);
    console.log(`  Start: ${new Date().toISOString().slice(0, 10)}`);
    console.log(`  End: ${endDate.toISOString().slice(0, 10)}`);

    // Update subscription to Pro with specific end date
    await setSubscription(normalizedEmail, {
      tier: 'pro',
      status: 'active',
      currentPeriodEnd: endDate.toISOString(),
      // Don't set Stripe IDs since this is a manual grant
      stripeSubscriptionId: undefined,
      stripeCustomerId: undefined,
    });

    console.log(`✓ Database subscription updated to Pro`);

    // Record the grant event
    await recordEvent(normalizedEmail, 'free_pro_granted', {
      source: 'manual_grant',
      months_granted: months,
      granted_by: 'support',
      end_date: endDate.toISOString().slice(0, 10),
      previous_tier: subscription.tier,
      previous_status: subscription.status,
      reason: 'feedback_appreciation'
    });
    console.log(`✓ Grant event recorded`);

    // Verify the grant
    const updatedSubscription = await getSubscription(normalizedEmail);
    console.log(`\nVerification:`);
    console.log(`  New Tier: ${updatedSubscription.tier}`);
    console.log(`  New Status: ${updatedSubscription.status}`);
    console.log(`  Pro Access Until: ${updatedSubscription.currentPeriodEnd?.slice(0, 10) || 'None'}`);
    console.log(`  Stripe Sub ID: ${updatedSubscription.stripeSubscriptionId || 'None (manual grant)'}`);

    if (updatedSubscription.tier === 'pro' && updatedSubscription.status === 'active') {
      console.log(`\n✅ SUCCESS: Free Pro access granted for ${email}`);
      console.log(`\nUser will have Pro features until: ${endDate.toISOString().slice(0, 10)}`);
      return {
        success: true,
        email: normalizedEmail,
        message: `${months} months free Pro access granted successfully`,
        endDate: endDate.toISOString().slice(0, 10),
        previousStatus: { tier: subscription.tier, status: subscription.status },
        newStatus: { tier: updatedSubscription.tier, status: updatedSubscription.status },
      };
    } else {
      throw new Error(`Verification failed: subscription not properly updated`);
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
if (args.length !== 2) {
  console.log('Usage: npx tsx backend/scripts/grant-free-pro.ts <email> <months>');
  console.log('');
  console.log('Example:');
  console.log('  npx tsx backend/scripts/grant-free-pro.ts iva@clarion.agency 3');
  console.log('  npx tsx backend/scripts/grant-free-pro.ts user@example.com 1');
  process.exit(1);
}

const email = args[0];
const months = parseInt(args[1]);

if (isNaN(months) || months < 1 || months > 12) {
  console.error('Error: Months must be a number between 1 and 12');
  process.exit(1);
}

grantFreePro(email, months)
  .then(result => {
    if (result.success) {
      console.log('\n' + '='.repeat(60));
      console.log('FREE PRO ACCESS GRANTED');
      console.log('='.repeat(60));
      console.log(`Email: ${result.email}`);
      console.log(`Status: PRO ACCESS GRANTED`);
      console.log(`Duration: ${months} months`);
      console.log(`Valid Until: ${result.endDate}`);
      console.log(`Previous: tier=${result.previousStatus?.tier}, status=${result.previousStatus?.status}`);
      console.log(`Current: tier=${result.newStatus?.tier}, status=${result.newStatus?.status}`);
      console.log('\nUser now has full Pro features with no billing attached.');
      console.log('='.repeat(60));
      process.exit(0);
    } else {
      console.error('\nGrant failed:', result.error);
      process.exit(1);
    }
  });