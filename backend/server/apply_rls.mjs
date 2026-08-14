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

async function applyRLS() {
  try {
    // First check what existing policies exist
    const existingPolicies = await pool.query(`
      SELECT policyname, tablename, cmd, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'public'
      AND tablename IN ('agents', 'invite_codes')
    `);
    console.log('Existing policies:');
    existingPolicies.rows.forEach(p => {
      console.log(`  ${p.tablename}.${p.cmd}: ${p.policyname}`);
    });

    // Check if RLS is enabled
    const rlsStatus = await pool.query(`
      SELECT relname, relrowsecurity
      FROM pg_class
      WHERE relname IN ('agents', 'invite_codes')
      AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    `);
    console.log('\nRLS Enabled:');
    rlsStatus.rows.forEach(r => {
      console.log(`  ${r.relname}: ${r.relrowsecurity}`);
    });

    // Enable RLS if not enabled
    if (rlsStatus.rows.find(r => r.relname === 'agents' && !r.relrowsecurity)) {
      await pool.query('ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY');
      console.log('\nEnabled RLS on agents');
    }

    // Drop conflicting policies if they exist and re-create
    const policiesToCreate = [
      {
        name: 'Agents can insert own profile',
        table: 'agents',
        sql: `
          CREATE POLICY "Agents can insert own profile"
          ON public.agents FOR INSERT TO authenticated
          WITH CHECK (auth.uid() = id)
        `
      },
      {
        name: 'Agents can read own profile',
        table: 'agents',
        sql: `
          CREATE POLICY "Agents can read own profile"
          ON public.agents FOR SELECT TO authenticated
          USING (auth.uid() = id)
        `
      },
      {
        name: 'Agents can update own profile',
        table: 'agents',
        sql: `
          CREATE POLICY "Agents can update own profile"
          ON public.agents FOR UPDATE TO authenticated
          USING (auth.uid() = id)
        `
      },
      {
        name: 'Authenticated can read invite codes',
        table: 'invite_codes',
        sql: `
          CREATE POLICY "Authenticated can read invite codes"
          ON public.invite_codes FOR SELECT TO authenticated
          USING (true)
        `
      },
      {
        name: 'Authenticated can update invite codes',
        table: 'invite_codes',
        sql: `
          CREATE POLICY "Authenticated can update invite codes"
          ON public.invite_codes FOR UPDATE TO authenticated
          USING (true)
        `
      }
    ];

    for (const p of policiesToCreate) {
      // Check if already exists
      const exists = existingPolicies.rows.find(e => e.policyname === p.name && e.tablename === p.table);
      if (exists) {
        console.log(`\nSkipping (already exists): ${p.table} - ${p.name}`);
        continue;
      }
      try {
        await pool.query(p.sql);
        console.log(`\nCreated: ${p.table} - ${p.name}`);
      } catch (err) {
        console.log(`\nFailed: ${p.table} - ${p.name}: ${err.message}`);
      }
    }

    // Final verification - list all policies
    const finalPolicies = await pool.query(`
      SELECT policyname, tablename, cmd FROM pg_policies
      WHERE schemaname = 'public'
      AND tablename IN ('agents', 'invite_codes')
    `);
    console.log('\n=== FINAL POLICIES ===');
    finalPolicies.rows.forEach(p => {
      console.log(`  [${p.tablename}] ${p.cmd}: "${p.policyname}"`);
    });

    process.exit(0);
  } catch (err) {
    console.error('Failed:', err.message);
    process.exit(1);
  }
}

applyRLS();
