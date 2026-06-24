import dotenv from 'dotenv';
import path from 'path';
import pkg from 'pg';

// Env lives in the IndSure ROOT (.env.local + .env), same as the app's loadEnv.
// dotenv does not override already-set vars, so .env.local (primary) wins.
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });
dotenv.config(); // fall back to backend/.env if present

const { Pool } = pkg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Supabase pooler uses a self-signed chain
});

async function run() {
  try {
    console.log('Creating comparison_reports table…');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS comparison_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        result JSONB NOT NULL,           -- the ComparisonResult (matrix + verdict)
        profiles JSONB,                  -- the two raw WordingProfiles (for re-render/debug)
        name_a TEXT,                     -- denormalized plan/insurer name for listing
        name_b TEXT,
        agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
        customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_compare_reports_agent ON comparison_reports(agent_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_compare_reports_customer ON comparison_reports(customer_id);`);

    // RLS: agents read their own reports via supabase-js. The backend's direct
    // Postgres connection bypasses RLS, so save + public share-by-uuid are unaffected.
    await pool.query(`ALTER TABLE comparison_reports ENABLE ROW LEVEL SECURITY;`);
    await pool.query(`DROP POLICY IF EXISTS "Agent: own comparison reports" ON comparison_reports;`);
    await pool.query(`
      CREATE POLICY "Agent: own comparison reports" ON comparison_reports
        FOR SELECT USING (auth.uid() = agent_id);
    `);

    await pool.query(`NOTIFY pgrst, 'reload schema';`);

    const { rows } = await pool.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'comparison_reports'
      ORDER BY ordinal_position;
    `);
    console.log('comparison_reports columns:', rows);
    console.log('Done.');
    process.exit(0);
  } catch (error) {
    console.error('Error creating comparison_reports table:', error);
    process.exit(1);
  }
}

run();
