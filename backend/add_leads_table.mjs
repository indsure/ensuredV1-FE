import 'dotenv/config';
import pkg from 'pg';

const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/*
 * NOTE: the table is `agent_leads`, NOT `leads`. `leads` already exists as the
 * PUBLIC lead-capture table (POST /api/leads from the policy-report flow, admin
 * GET /api/leads) — name/email/phone NOT NULL, no agent ownership. This is a
 * separate per-agent CRM pipeline, so it gets its own namespaced table.
 */

async function run() {
  try {
    console.log('Creating agent_leads table (per-agent prospect pipeline)...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS agent_leads (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        name text NOT NULL,
        phone text,
        email text,
        city text,
        source text,
        insurance_interest text,
        expected_value numeric,
        status text NOT NULL DEFAULT 'new',
        next_follow_up date,
        notes text,
        customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_agent_leads_agent ON agent_leads(agent_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_agent_leads_status ON agent_leads(status);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_agent_leads_customer ON agent_leads(customer_id);`);

    // Mirror the RLS posture of clients/customers ("Agent: own", ALL, auth.uid() = agent_id).
    await pool.query(`ALTER TABLE agent_leads ENABLE ROW LEVEL SECURITY;`);
    await pool.query(`DROP POLICY IF EXISTS "Agent: own agent_leads" ON agent_leads;`);
    await pool.query(`
      CREATE POLICY "Agent: own agent_leads" ON agent_leads
        FOR ALL USING (auth.uid() = agent_id);
    `);

    // Reload PostgREST schema cache so supabase-js sees the new table.
    await pool.query(`NOTIFY pgrst, 'reload schema';`);

    const { rows: cols } = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'agent_leads'
      ORDER BY ordinal_position;
    `);
    console.log('agent_leads columns:', cols);

    console.log('Done.');
    process.exit(0);
  } catch (error) {
    console.error('Error applying schema updates:', error);
    process.exit(1);
  }
}

run();
