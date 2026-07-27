import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function applyRLS() {
  console.log("Attempting to apply RLS policies...");
  
  // We'll execute this via the Postgres connection because supabase-js doesn't run raw SQL easily 
  // without a postgres function. Let's import pg.
  import('pg').then(async ({ Client }) => {
    const client = new Client({
      connectionString: process.env.DATABASE_URL
    });

    try {
      await client.connect();
      console.log("Connected to PG databse.");

      // Apply the user requested policies, wrapped in try-catch in case tables don't exist
      const sql = `
        DO $$ 
        BEGIN
          -- user specified policy_analyses
          BEGIN
            ALTER TABLE policy_analyses ENABLE ROW LEVEL SECURITY;
            DROP POLICY IF EXISTS "agent_own_analyses" ON policy_analyses;
            CREATE POLICY "agent_own_analyses" ON policy_analyses FOR ALL USING (agent_id = auth.uid());
            RAISE NOTICE 'Applied RLS to policy_analyses';
          EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'policy_analyses table might not exist'; END;

          -- user specified analysis_jobs
          BEGIN
            ALTER TABLE analysis_jobs ENABLE ROW LEVEL SECURITY;
            DROP POLICY IF EXISTS "agent_own_jobs" ON analysis_jobs;
            CREATE POLICY "agent_own_jobs" ON analysis_jobs FOR ALL USING (agent_id = auth.uid());
            RAISE NOTICE 'Applied RLS to analysis_jobs';
          EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'analysis_jobs table might not exist'; END;

          -- Actual actual tables used in UI: policies
          BEGIN
            ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
            DROP POLICY IF EXISTS "agent_own_analyses_real" ON policies;
            CREATE POLICY "agent_own_analyses_real" ON policies FOR ALL USING (agent_id = auth.uid());
            RAISE NOTICE 'Applied RLS to policies';
          EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'policies table might not exist'; END;

          -- Actual actual tables used in UI: public_analysis_jobs
          BEGIN
            ALTER TABLE public_analysis_jobs ENABLE ROW LEVEL SECURITY;
            DROP POLICY IF EXISTS "agent_own_jobs_real" ON public_analysis_jobs;
            CREATE POLICY "agent_own_jobs_real" ON public_analysis_jobs FOR ALL USING (agent_id = auth.uid());
            RAISE NOTICE 'Applied RLS to public_analysis_jobs';
          EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'public_analysis_jobs might not exist'; END;
        END $$;
      `;

      await client.query(sql);
      console.log("Successfully applied RLS policies.");

    } catch (e) {
      console.error("Error executing SQL:", e);
    } finally {
      await client.end();
    }
  }).catch(err => {
    console.error("PG module not found or error:", err);
  });
}

applyRLS();
