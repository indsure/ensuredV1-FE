import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';

// DATABASE_URL lives in the repo-root env (IndSure/.env.local then .env), not backend/.env.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = pkg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

/*
 * lead_policies — policies the agent collects from a PROSPECT (agent_leads row)
 * to keep context and reach out near the renewal/due date. Light OCR-only or
 * manual: name, insurer, type, premium, due_date. No forensic analysis (that
 * stays optional/separate). A lead can hold several policies (motor + health…).
 */

async function run() {
  try {
    console.log('Creating lead_policies table...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS lead_policies (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        lead_id uuid NOT NULL REFERENCES agent_leads(id) ON DELETE CASCADE,
        agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        insurance_type text,
        insurer text,
        policy_name text,
        policyholder_name text,
        premium numeric,
        due_date date,
        file_url text,
        file_name text,
        extracted_data jsonb,
        spoken_to boolean NOT NULL DEFAULT false,
        notes text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_lead_policies_lead ON lead_policies(lead_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_lead_policies_agent ON lead_policies(agent_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_lead_policies_due ON lead_policies(due_date);`);

    // Mirror the RLS posture of agent_leads ("Agent: own", ALL, auth.uid() = agent_id).
    await pool.query(`ALTER TABLE lead_policies ENABLE ROW LEVEL SECURITY;`);
    await pool.query(`DROP POLICY IF EXISTS "Agent: own lead_policies" ON lead_policies;`);
    await pool.query(`
      CREATE POLICY "Agent: own lead_policies" ON lead_policies
        FOR ALL USING (auth.uid() = agent_id);
    `);

    // Reload PostgREST schema cache so supabase-js sees the new table.
    await pool.query(`NOTIFY pgrst, 'reload schema';`);

    const { rows: cols } = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'lead_policies'
      ORDER BY ordinal_position;
    `);
    console.log('lead_policies columns:', cols);

    console.log('Done.');
    process.exit(0);
  } catch (error) {
    console.error('Error applying schema updates:', error);
    process.exit(1);
  }
}

run();
