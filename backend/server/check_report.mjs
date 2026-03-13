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

async function checkReportData() {
  try {
    const res = await pool.query(`
      SELECT id, status, score, flaws, 
             CASE WHEN report_data IS NULL THEN 'MISSING' ELSE 'PRESENT' END as has_report
      FROM clients 
      WHERE id = '8f78b4f7-eb9f-4bb3-b7e7-db47dc3959cc'
    `);
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

checkReportData();
