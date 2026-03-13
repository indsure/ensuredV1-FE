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
    const agents = await pool.query('SELECT email FROM agents LIMIT 1');
    console.log('TEST_AGENT_EMAIL:', agents.rows[0]?.email);
    const codes = await pool.query('SELECT code FROM invite_codes WHERE is_used = false LIMIT 1');
    console.log('UNUSED_INVITE_CODE:', codes.rows[0]?.code);
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
run();
