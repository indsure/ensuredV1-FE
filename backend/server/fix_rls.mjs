import pg from 'pg';
const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Export it or add it to the repo-root .env before running this script.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL
});

async function checkRLS() {
  try {
    // List all policies on agents
    const res = await pool.query(`
      SELECT policyname, cmd, roles, qual, with_check, permissive
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'agents'
    `);
    console.log('AGENTS POLICIES:');
    console.table(res.rows);

    // Check if RLS enabled
    const rlsRes = await pool.query(`
      SELECT relname, relrowsecurity, relforcerowsecurity
      FROM pg_class
      WHERE relname = 'agents'
      AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    `);
    console.log('RLS Status:', rlsRes.rows);

    // Try force-adding the policy from scratch
    try {
      await pool.query(`DROP POLICY IF EXISTS "allow_signup_insert" ON public.agents`);
      await pool.query(`
        CREATE POLICY "allow_signup_insert"
        ON public.agents
        FOR INSERT
        WITH CHECK (true)
      `);
      console.log('\nCreated permissive insert policy (WITH CHECK true for all)');
    } catch (e) {
      console.error('Failed to create policy:', e.message);
    }

    // List again
    const res2 = await pool.query(`
      SELECT policyname, cmd, roles, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'agents'
    `);
    console.log('\nFINAL AGENTS POLICIES:');
    console.table(res2.rows);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkRLS();
