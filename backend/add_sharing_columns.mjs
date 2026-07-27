import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: 'aws-1-ap-south-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.khxbabotbvnyjwvqtumt',
  password: 'zQqau#PVNTZG,m6',
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting migration: Add sharing columns to clients table...\n');
    
    // Enable uuid extension if not already enabled
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    `);
    console.log('✅ UUID extension enabled');
    
    // Migration 1: Add columns to clients table
    await client.query(`
      ALTER TABLE clients
        ADD COLUMN IF NOT EXISTS share_token uuid UNIQUE DEFAULT uuid_generate_v4(),
        ADD COLUMN IF NOT EXISTS share_enabled boolean DEFAULT true,
        ADD COLUMN IF NOT EXISTS views integer DEFAULT 0,
        ADD COLUMN IF NOT EXISTS filename text,
        ADD COLUMN IF NOT EXISTS file_size integer,
        ADD COLUMN IF NOT EXISTS client_email text,
        ADD COLUMN IF NOT EXISTS client_phone text,
        ADD COLUMN IF NOT EXISTS policy_identifier text,
        ADD COLUMN IF NOT EXISTS last_shared_at timestamp with time zone;
    `);
    console.log('✅ Added columns to clients table');
    
    // Create index on share_token
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_clients_share_token ON clients(share_token);
    `);
    console.log('✅ Created index on share_token');
    
    // Migration 2: Create report_views table
    await client.query(`
      CREATE TABLE IF NOT EXISTS report_views (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        ip_hash text NOT NULL,
        viewed_at timestamp with time zone DEFAULT now(),
        UNIQUE(client_id, ip_hash, viewed_at)
      );
    `);
    console.log('✅ Created report_views table');
    
    // Create indexes on report_views
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_report_views_client_id ON report_views(client_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_report_views_recent ON report_views(client_id, ip_hash, viewed_at DESC);
    `);
    console.log('✅ Created indexes on report_views');
    
    // Backfill share_token for existing rows that might have NULL
    const backfillResult = await client.query(`
      UPDATE clients 
      SET share_token = uuid_generate_v4() 
      WHERE share_token IS NULL;
    `);
    console.log(`✅ Backfilled share_token for ${backfillResult.rowCount} existing rows`);
    
    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
