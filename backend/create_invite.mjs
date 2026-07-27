import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({
  host: 'aws-1-ap-south-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.khxbabotbvnyjwvqtumt',
  password: 'zQqau#PVNTZG,m6',
  ssl: { rejectUnauthorized: false },
});

async function run() {
  try {
    await pool.query("INSERT INTO invite_codes (code, is_active, used_by) VALUES ('TEST2026', true, null) ON CONFLICT (code) DO UPDATE SET is_active = true, used_by = null, used_at = null;");
    const agents = await pool.query('SELECT email FROM agents LIMIT 1');
    console.log('AGENT_EMAIL:', agents.rows[0]?.email);
    console.log('INVITE_CODE: TEST2026');
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
run();
