import 'dotenv/config';
import pkg from 'pg';

const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    console.log('Adding agent_id/customer_id to calculator_reports...');

    await pool.query(`
      ALTER TABLE calculator_reports
        ADD COLUMN IF NOT EXISTS agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_calc_reports_agent ON calculator_reports(agent_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_calc_reports_customer ON calculator_reports(customer_id);`);

    // RLS: agents can read/update their own reports via supabase-js.
    // Consumer flow is unaffected — inserts/reads go through the backend's
    // direct Postgres connection, which bypasses RLS entirely.
    await pool.query(`ALTER TABLE calculator_reports ENABLE ROW LEVEL SECURITY;`);
    await pool.query(`DROP POLICY IF EXISTS "Agent: own calc reports" ON calculator_reports;`);
    await pool.query(`
      CREATE POLICY "Agent: own calc reports" ON calculator_reports
        FOR SELECT USING (auth.uid() = agent_id);
    `);
    await pool.query(`DROP POLICY IF EXISTS "Agent: update own calc reports" ON calculator_reports;`);
    await pool.query(`
      CREATE POLICY "Agent: update own calc reports" ON calculator_reports
        FOR UPDATE USING (auth.uid() = agent_id);
    `);

    await pool.query(`NOTIFY pgrst, 'reload schema';`);

    const { rows } = await pool.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'calculator_reports'
      ORDER BY ordinal_position;
    `);
    console.log('calculator_reports columns:', rows);
    console.log('Done.');
    process.exit(0);
  } catch (error) {
    console.error('Error applying schema updates:', error);
    process.exit(1);
  }
}

run();
