/**
 * Quick test to verify database connection and structure
 */

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_DATABASE_URL!);

async function testDatabase() {
  console.log('🧪 Testing database connection...\n');
  
  try {
    // Check table structure
    const tableInfo = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'protovid_subscriptions'
      ORDER BY ordinal_position
    `;
    
    console.log('📋 Table structure:');
    console.table(tableInfo);
    
    // Test insert and retrieve
    const testEmail = 'test@example.com';
    console.log(`\n🔍 Testing insert/retrieve with: ${testEmail}`);
    
    await sql`
      INSERT INTO protovid_subscriptions (
        email, tier, status, exports_this_month, last_reset_month
      ) VALUES (
        ${testEmail}, 'free', 'active', 0, '2026-03'
      )
      ON CONFLICT (email) DO UPDATE SET
        updated_at = CURRENT_TIMESTAMP
    `;
    
    const result = await sql`
      SELECT * FROM protovid_subscriptions WHERE email = ${testEmail}
    `;
    
    console.log('\n✅ Retrieved subscription:');
    console.log(result[0]);
    
    // Test Stripe customer lookup
    console.log('\n🔍 Testing Stripe customer ID lookup...');
    await sql`
      UPDATE protovid_subscriptions 
      SET stripe_customer_id = 'cus_test123', tier = 'pro', status = 'active'
      WHERE email = ${testEmail}
    `;
    
    const stripeResult = await sql`
      SELECT email, tier, status FROM protovid_subscriptions 
      WHERE stripe_customer_id = 'cus_test123'
    `;
    
    console.log('✅ Found by Stripe customer ID:');
    console.log(stripeResult[0]);
    
    // Cleanup
    await sql`DELETE FROM protovid_subscriptions WHERE email = ${testEmail}`;
    
    console.log('\n🎉 All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testDatabase();
