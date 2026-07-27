import 'dotenv/config';
import pkg from 'pg';

const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    console.log('Adding insurance_type + extracted_data columns to clients...');

    await pool.query(`
      ALTER TABLE clients
        ADD COLUMN IF NOT EXISTS insurance_type text NOT NULL DEFAULT 'health',
        ADD COLUMN IF NOT EXISTS extracted_data jsonb;
    `);

    // Backfill any rows that somehow predate the default.
    await pool.query(`
      UPDATE clients SET insurance_type = 'health' WHERE insurance_type IS NULL;
    `);

    // Ask PostgREST (Supabase REST, used by the frontend supabase-js client)
    // to reload its schema cache so the new columns are queryable immediately.
    await pool.query(`NOTIFY pgrst, 'reload schema';`);

    // Show the resulting column definitions for confirmation.
    const { rows } = await pool.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'clients'
        AND column_name IN ('insurance_type', 'extracted_data')
      ORDER BY column_name;
    `);
    console.log('Columns now present:', rows);

    console.log('Done.');
    process.exit(0);
  } catch (error) {
    console.error('Error applying schema updates:', error);
    process.exit(1);
  }
}

run();
