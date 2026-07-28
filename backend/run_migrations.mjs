import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import pkg from 'pg';
const { Pool } = pkg;

// Load DATABASE_URL from the repo-root .env (gitignored), regardless of the
// directory this script is run from. Existing shell env vars take precedence.
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env') });

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set. Add it to the repo-root .env (or export it) before running migrations.');
  process.exit(1);
}

// Supabase's pooler presents a self-signed cert chain; newer pg treats the
// URL's sslmode=require as verify-full and rejects it, so strip sslmode and
// hand pg an explicit relaxed ssl config (TLS is still negotiated).
const connectionString = process.env.DATABASE_URL
  .replace(/([?&])sslmode=[^&]*/gi, '$1')
  .replace(/[?&]+$/, '');

const pool = new Pool({
  connectionString,
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
