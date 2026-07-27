import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Syncs data from full_name/city to name/location columns
 * This ensures Settings page shows data for users who signed up with the new flow
 */

async function syncColumns() {
  try {
    console.log('\n🔄 Syncing agent data between columns...\n');

    // Sync full_name → name (where name is null but full_name exists)
    const nameResult = await pool.query(`
      UPDATE agents 
      SET name = full_name 
      WHERE full_name IS NOT NULL 
      AND (name IS NULL OR name = '')
    `);
    console.log(`✅ Synced ${nameResult.rowCount} records: full_name → name`);

    // Sync city → location (where location is null but city exists)
    const locationResult = await pool.query(`
      UPDATE agents 
      SET location = city 
      WHERE city IS NOT NULL 
      AND (location IS NULL OR location = '')
    `);
    console.log(`✅ Synced ${locationResult.rowCount} records: city → location`);

    // Also sync the other direction for completeness
    const fullNameResult = await pool.query(`
      UPDATE agents 
      SET full_name = name 
      WHERE name IS NOT NULL 
      AND (full_name IS NULL OR full_name = '')
    `);
    console.log(`✅ Synced ${fullNameResult.rowCount} records: name → full_name`);

    const cityResult = await pool.query(`
      UPDATE agents 
      SET city = location 
      WHERE location IS NOT NULL 
      AND (city IS NULL OR city = '')
    `);
    console.log(`✅ Synced ${cityResult.rowCount} records: location → city`);

    // Show current state
    const agents = await pool.query(`
      SELECT 
        id,
        email,
        name,
        full_name,
        location,
        city,
        experience_years
      FROM agents
      ORDER BY created_at DESC
      LIMIT 10
    `);

    console.log('\n📋 Recent agents (showing both column sets):');
    console.table(agents.rows);

    console.log('\n✅ Column sync complete!');
    console.log('💡 Settings page will now show data correctly.');

  } catch (error) {
    console.error('\n❌ Error syncing columns:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

syncColumns();
