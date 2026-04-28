import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Adds missing columns to the agents table for the signup flow
 */

async function addMissingColumns() {
  try {
    console.log('\n🔧 Adding missing columns to agents table...\n');

    // Add full_name column (if using 'name' currently, we'll keep both)
    await pool.query(`
      ALTER TABLE agents 
      ADD COLUMN IF NOT EXISTS full_name TEXT
    `);
    console.log('✅ Added full_name column');

    // Add phone column
    await pool.query(`
      ALTER TABLE agents 
      ADD COLUMN IF NOT EXISTS phone TEXT
    `);
    console.log('✅ Added phone column');

    // Add city column (if using 'location', we'll keep both)
    await pool.query(`
      ALTER TABLE agents 
      ADD COLUMN IF NOT EXISTS city TEXT
    `);
    console.log('✅ Added city column');

    // Add invite_code column
    await pool.query(`
      ALTER TABLE agents 
      ADD COLUMN IF NOT EXISTS invite_code TEXT
    `);
    console.log('✅ Added invite_code column');

    // Add consent_given_at column
    await pool.query(`
      ALTER TABLE agents 
      ADD COLUMN IF NOT EXISTS consent_given_at TIMESTAMPTZ
    `);
    console.log('✅ Added consent_given_at column');

    // Add is_admin column (for admin users)
    await pool.query(`
      ALTER TABLE agents 
      ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE
    `);
    console.log('✅ Added is_admin column');

    // Check current columns
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'agents' 
      ORDER BY ordinal_position
    `);

    console.log('\n📋 Current agents table columns:');
    console.table(result.rows);

    console.log('\n✅ All missing columns added successfully!');
    console.log('\n💡 You can now use the signup flow without errors.');

  } catch (error) {
    console.error('\n❌ Error adding columns:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

addMissingColumns();
