import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: 'aws-1-ap-south-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.khxbabotbvnyjwvqtumt',
  password: 'zQqau#PVNTZG,m6',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

const migrations = [
  // Task 1
  { name: 'firm_name column', sql: 'ALTER TABLE agents ADD COLUMN IF NOT EXISTS firm_name TEXT;' },
  // DPDP consent timestamp for agent signup
  { name: 'consent_given_at column', sql: 'ALTER TABLE agents ADD COLUMN IF NOT EXISTS consent_given_at TIMESTAMPTZ;' },
  // DPDP grievance request store
  {
    name: 'grievance_requests table',
    sql: `
      CREATE TABLE IF NOT EXISTS grievance_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        request_type TEXT NOT NULL,
        details TEXT NOT NULL,
        submitted_at TIMESTAMPTZ DEFAULT NOW()
      );
    `,
  },
  // Task 5 — Performance Indexes
  { name: 'idx_clients_agent_id',       sql: 'CREATE INDEX IF NOT EXISTS idx_clients_agent_id ON clients(agent_id);' },
  { name: 'idx_clients_status',         sql: 'CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);' },
  { name: 'idx_notifications_agent_id', sql: 'CREATE INDEX IF NOT EXISTS idx_notifications_agent_id ON notifications(agent_id);' },
  { name: 'idx_public_reports_client_id', sql: 'CREATE INDEX IF NOT EXISTS idx_public_reports_client_id ON public_reports(client_id);' },
];

async function run() {
  for (const m of migrations) {
    try {
      await pool.query(m.sql);
      console.log(`✅ ${m.name}`);
    } catch (e) {
      console.error(`❌ ${m.name}:`, e.message);
    }
  }

  // Try batch_uploads table — it may not exist
  try {
    await pool.query('CREATE INDEX IF NOT EXISTS idx_batch_uploads_agent_id ON batch_uploads(agent_id);');
    console.log('✅ idx_batch_uploads_agent_id');
  } catch (e) {
    if (e.message.includes('does not exist')) {
      console.log('⚠️  batch_uploads table does not exist — skipping index');
    } else {
      console.error('❌ idx_batch_uploads_agent_id:', e.message);
    }
  }

  pool.end();
}
run();
