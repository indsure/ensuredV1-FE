import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🔄 Starting migration: Add access_audit_log table...\n');

    await client.query(`
      CREATE TABLE IF NOT EXISTS access_audit_log (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id uuid,
        client_id uuid,
        action text,
        route text,
        method text,
        ip text,
        user_agent text,
        created_at timestamptz DEFAULT now()
      );
    `);
    console.log('✅ Created access_audit_log table');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_access_audit_log_client_id ON access_audit_log(client_id);
    `);
    console.log('✅ Created index on client_id');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_access_audit_log_agent_created ON access_audit_log(agent_id, created_at);
    `);
    console.log('✅ Created index on (agent_id, created_at)');

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
