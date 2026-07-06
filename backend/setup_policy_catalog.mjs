import dotenv from 'dotenv';
import path from 'path';
import pkg from 'pg';

// Env lives in the IndSure ROOT (.env.local + .env), same as the app's loadEnv.
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });
dotenv.config();

const { Pool } = pkg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Supabase pooler uses a self-signed chain
});

async function run() {
  try {
    console.log('Creating policy_catalog table…');

    // The catalog of pre-extracted policy wordings. UIN is the definitive identity
    // (IRDAI's mandatory per-product code). Comparisons are pure math over `profile`
    // rows of the SAME product_type — zero AI at compare time.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS policy_catalog (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        uin TEXT UNIQUE NOT NULL,
        insurer TEXT NOT NULL,
        plan_name TEXT NOT NULL,
        product_type TEXT NOT NULL DEFAULT 'comprehensive_health_indemnity',
        sum_insured_options TEXT,
        profile JSONB NOT NULL,          -- the full WordingProfile
        source_file TEXT,                -- original wording PDF filename
        status TEXT NOT NULL DEFAULT 'unverified',  -- unverified | verified
        confidence TEXT,                 -- extractor confidence (high|medium|low)
        schema_version INT NOT NULL DEFAULT 1,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_catalog_type ON policy_catalog(product_type);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_catalog_insurer ON policy_catalog(insurer);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_catalog_active ON policy_catalog(is_active);`);

    // Read-only to authenticated agents via supabase-js (the picker reads the catalog).
    // Backend's direct Postgres connection bypasses RLS for ingestion.
    await pool.query(`ALTER TABLE policy_catalog ENABLE ROW LEVEL SECURITY;`);
    await pool.query(`DROP POLICY IF EXISTS "Catalog: agents read active" ON policy_catalog;`);
    await pool.query(`
      CREATE POLICY "Catalog: agents read active" ON policy_catalog
        FOR SELECT TO authenticated USING (is_active = true);
    `);

    await pool.query(`NOTIFY pgrst, 'reload schema';`);

    const { rows } = await pool.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'policy_catalog' ORDER BY ordinal_position;
    `);
    console.log('policy_catalog columns:', rows);
    console.log('Done.');
    process.exit(0);
  } catch (error) {
    console.error('Error creating policy_catalog table:', error);
    process.exit(1);
  }
}

run();
