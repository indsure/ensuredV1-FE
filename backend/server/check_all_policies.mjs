import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: "postgresql://postgres:zQqau%23PVNTZG%2Cm6@db.khxbabotbvnyjwvqtumt.supabase.co:5432/postgres"
});

// Check all policies for agents
async function check() {
  const res = await pool.query(`
    SELECT policyname, cmd, roles, qual, with_check, permissive
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('agents', 'invite_codes')
    ORDER BY tablename, cmd
  `);
  console.log('ALL POLICIES:');
  res.rows.forEach(p => {
    console.log(`[${p.tablename}] ${p.cmd} (${p.permissive ? 'PERMISSIVE' : 'RESTRICTIVE'}) for [${p.roles}]: "${p.policyname}"`);
    if (p.with_check) console.log(`  WITH CHECK: ${p.with_check}`);
    if (p.qual) console.log(`  USING: ${p.qual}`);
  });

  // Check RLS enabled
  const rlsRes = await pool.query(`
    SELECT relname, relrowsecurity
    FROM pg_class
    WHERE relname IN ('agents', 'invite_codes')
    AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  `);
  console.log('\nRLS enabled:', rlsRes.rows.map(r => `${r.relname}: ${r.relrowsecurity}`).join(', '));

  // If the 'allow_signup_insert' policy exists check its for roles
  const specificRes = await pool.query(`
    SELECT policyname, cmd, roles, qual, with_check, permissive
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'agents' AND cmd = 'INSERT'
  `);
  console.log('\nINSERT policies on agents:', specificRes.rows);

  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
