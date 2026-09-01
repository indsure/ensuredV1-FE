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

async function run() {
  try {
    const res = await pool.query("INSERT INTO invite_codes (code) VALUES ('INDSURE-TESTING') ON CONFLICT DO NOTHING");
    console.log("Invite code added.");
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
