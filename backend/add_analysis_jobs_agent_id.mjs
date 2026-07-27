import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🔄 Migration: add analysis_jobs.agent_id (ownership for IDOR fix)...\n');

    // 1. Add the column (nullable; anonymous public-analyzer jobs stay null).
    await client.query(`
      ALTER TABLE analysis_jobs ADD COLUMN IF NOT EXISTS agent_id uuid;
    `);
    console.log('✅ Added analysis_jobs.agent_id');

    // 2. Index for ownership lookups.
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_analysis_jobs_agent_id ON analysis_jobs(agent_id);
    `);
    console.log('✅ Created index on agent_id');

    // 3. Best-effort backfill for existing agent jobs: where the job was linked
    //    to a client (policy_id) and the client has an owning agent, copy it.
    //    Jobs that can't be attributed stay null (treated as anonymous; the
    //    authenticated agent route 404s them, which is the safe default).
    const backfill = await client.query(`
      UPDATE analysis_jobs aj
         SET agent_id = c.agent_id
        FROM clients c
       WHERE aj.policy_id = c.id
         AND aj.agent_id IS NULL
         AND c.agent_id IS NOT NULL;
    `);
    console.log(`✅ Backfilled agent_id on ${backfill.rowCount} existing job(s)`);

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
