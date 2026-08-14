import pg from 'pg';
const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Export it or add it to the repo-root .env before running this script.');
  process.exit(1);
}

const CONN = DATABASE_URL;
const pool = new Pool({ connectionString: CONN });

async function fixSchema() {
  try {
    // Check if column exists
    const res = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'batch_uploads'
        AND column_name = 'processed_count';
    `);

    if (res.rows.length === 0) {
      console.log('Column processed_count not found. Adding it...');
      await pool.query(`
        ALTER TABLE public.batch_uploads 
        ADD COLUMN processed_count INTEGER DEFAULT 0;
      `);
      console.log('Column added.');
    } else {
      console.log('Column already exists.');
    }

    // Force PostgREST schema cache reload
    await pool.query('NOTIFY pgrst, reload_schema;');
    console.log('Schema cache reloaded.');

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

fixSchema();
