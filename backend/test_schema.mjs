import pkg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function runTests() {
  try {
    console.log('\n=== B1: All new columns exist ===');
    const b1 = await pool.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'clients' 
      AND column_name IN (
        'share_token', 'share_enabled', 'views', 'filename', 'file_size', 
        'client_email', 'client_phone', 'policy_identifier', 'last_shared_at'
      )
      ORDER BY column_name
    `);
    console.log(`Found ${b1.rows.length} columns (expected 9):`);
    console.log(JSON.stringify(b1.rows, null, 2));
    console.log(b1.rows.length === 9 ? '✅ PASS' : '❌ FAIL');

    console.log('\n=== B2: Existing policies backfilled ===');
    const b2 = await pool.query('SELECT COUNT(*) FROM clients WHERE share_token IS NULL');
    console.log(`Clients with NULL share_token: ${b2.rows[0].count} (expected 0)`);
    console.log(b2.rows[0].count === '0' ? '✅ PASS' : '❌ FAIL');

    console.log('\n=== B3: report_views table exists ===');
    try {
      const b3 = await pool.query('SELECT COUNT(*) FROM report_views');
      console.log(`report_views table exists with ${b3.rows[0].count} rows`);
      console.log('✅ PASS');
    } catch (e) {
      console.log('❌ FAIL - table does not exist');
      console.error(e.message);
    }

    console.log('\n=== B4: share_enabled default is true ===');
    const b4 = await pool.query('SELECT COUNT(*) FROM clients WHERE share_enabled IS NULL OR share_enabled = false');
    console.log(`Clients with share_enabled NULL or false: ${b4.rows[0].count} (expected 0)`);
    console.log(b4.rows[0].count === '0' ? '✅ PASS' : '❌ FAIL');

  } catch (error) {
    console.error('Error running tests:', error);
  } finally {
    await pool.end();
  }
}

runTests();
