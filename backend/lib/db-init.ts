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

    // Stablecoin payment columns — idempotent, safe to re-run
    await sql`ALTER TABLE protovid_subscriptions ADD COLUMN IF NOT EXISTS crypto_charge_id VARCHAR(255)`;
    await sql`ALTER TABLE protovid_subscriptions ADD COLUMN IF NOT EXISTS crypto_paid_at TIMESTAMP`;
    await sql`ALTER TABLE protovid_subscriptions ADD COLUMN IF NOT EXISTS crypto_expires_at TIMESTAMP`;

    console.log('✅ Ensured stablecoin columns on protovid_subscriptions');

    // Trial tracking columns
    await sql`ALTER TABLE protovid_subscriptions ADD COLUMN IF NOT EXISTS first_export_date DATE`;

    console.log('✅ Ensured trial tracking columns on protovid_subscriptions');

    await sql`
      CREATE TABLE IF NOT EXISTS protovid_event_dedupes (
        event_id VARCHAR(255) PRIMARY KEY,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ Ensured analytics event deduplication table');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_protovid_events_created_at
      ON protovid_events(created_at DESC)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_protovid_events_type_created_at
      ON protovid_events(event_type, created_at DESC)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_protovid_events_lower_email
      ON protovid_events(LOWER(email))
    `;
    console.log('✅ Ensured analytics query indexes');

    await sql`
      CREATE TABLE IF NOT EXISTS protovid_shares (
        id VARCHAR(32) PRIMARY KEY,
        email VARCHAR(255),
        anonymous_id VARCHAR(128),
        filename VARCHAR(255) NOT NULL,
        resolution VARCHAR(32) NOT NULL DEFAULT '720p',
        frame_count INTEGER NOT NULL DEFAULT 0,
        mime_type VARCHAR(100) NOT NULL DEFAULT 'video/mp4',
        video_data BYTEA NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        experiment_variant VARCHAR(32),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        view_count INTEGER NOT NULL DEFAULT 0
      )
    `;
    await sql`
      ALTER TABLE protovid_shares
      ADD COLUMN IF NOT EXISTS experiment_variant VARCHAR(32)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_protovid_shares_expires_at
      ON protovid_shares(expires_at)
    `;
    console.log('✅ Ensured hosted share table');
    
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
