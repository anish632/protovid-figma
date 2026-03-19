/**
 * ProtoVid Database Initialization
 * Creates the protovid_subscriptions table in the shared Neon instance
 * 
 * Run once to set up: npx tsx lib/db-init.ts
 */

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_DATABASE_URL!);

async function initDatabase() {
  console.log('🔧 Initializing ProtoVid database...');
  
  try {
    // Create subscriptions table with proper indexes
    await sql`
      CREATE TABLE IF NOT EXISTS protovid_subscriptions (
        email VARCHAR(255) PRIMARY KEY,
        tier VARCHAR(10) NOT NULL DEFAULT 'free',
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        stripe_customer_id VARCHAR(255),
        stripe_subscription_id VARCHAR(255),
        current_period_end TIMESTAMP,
        exports_this_month INTEGER NOT NULL DEFAULT 0,
        last_reset_month VARCHAR(7) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    console.log('✅ Created table: protovid_subscriptions');
    
    // Create indexes for efficient lookups
    await sql`
      CREATE INDEX IF NOT EXISTS idx_protovid_stripe_customer 
      ON protovid_subscriptions(stripe_customer_id)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_protovid_stripe_subscription 
      ON protovid_subscriptions(stripe_subscription_id)
    `;
    
    console.log('✅ Created indexes for Stripe lookups');
    
    // Test query
    const result = await sql`SELECT COUNT(*) as count FROM protovid_subscriptions`;
    console.log(`📊 Current subscription count: ${result[0].count}`);
    
    console.log('🎉 Database initialization complete!');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

initDatabase();
