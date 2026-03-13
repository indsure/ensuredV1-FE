import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: 'aws-1-ap-south-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.khxbabotbvnyjwvqtumt',
  password: 'zQqau#PVNTZG,m6',
  ssl: { rejectUnauthorized: false },
});

async function checkErrors() {
  try {
    const res = await pool.query(`
      SELECT id, status, error_message 
      FROM clients 
      WHERE status = 'error'
      ORDER BY created_at DESC 
      LIMIT 2
    `);
    console.log("Errors JSON:");
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

checkErrors();
