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

async function forensicSchemaFix() {
  try {
    console.log("Adding ALL missing columns used by the upload and analysis pipeline...");
    
    // The backend routes.ts expects the following columns on 'clients':
    // agent_id, batch_id, policy_name, pdf_url, status, score, flaws, 
    // report_data, policyholder_name, insurer, sum_insured, expiry_date, error_message

    await pool.query(`
      -- Fix clients table
      ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS policy_name TEXT;
      ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS batch_id UUID;
      ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS pdf_url TEXT;
      ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS error_message TEXT;
      ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS score INTEGER;
      ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS flaws JSONB;
      ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS report_data JSONB;
      ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS policyholder_name TEXT;
      ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS insurer TEXT;
      ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS sum_insured TEXT;
      ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS expiry_date TEXT;

      -- Double check batch_uploads just in case
      ALTER TABLE public.batch_uploads ADD COLUMN IF NOT EXISTS total INTEGER DEFAULT 0;
      ALTER TABLE public.batch_uploads ADD COLUMN IF NOT EXISTS processed_count INTEGER DEFAULT 0;
      ALTER TABLE public.batch_uploads ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

      -- Reload schema cache
      NOTIFY pgrst, 'reload schema';
    `);
    
    console.log("✅ Forensic schema fix complete. All columns added.");
  } catch (err) {
    console.error("Error updating schema:", err);
  } finally {
    pool.end();
  }
}

forensicSchemaFix();
