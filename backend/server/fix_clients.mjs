import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: 'aws-1-ap-south-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.khxbabotbvnyjwvqtumt',
  password: 'zQqau#PVNTZG,m6',
  ssl: { rejectUnauthorized: false },
});

async function fixSchema() {
  try {
    console.log("Adding batch_id column to clients...");
    await pool.query(`
      ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS batch_id UUID;
      ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS pdf_url TEXT;
      NOTIFY pgrst, 'reload schema';
    `);
    console.log("✅ Schema updated successfully.");
  } catch (err) {
    console.error("Error updating schema:", err);
  } finally {
    pool.end();
  }
}

fixSchema();
