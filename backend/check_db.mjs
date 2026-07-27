import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({
  host: 'aws-1-ap-south-1.pooler.supabase.com', port: 6543,
  database: 'postgres', user: 'postgres.khxbabotbvnyjwvqtumt',
  password: 'zQqau#PVNTZG,m6', ssl: { rejectUnauthorized: false }
});

async function run() {
  const r = await pool.query('SELECT status, error_message, score, report_data FROM clients ORDER BY created_at DESC LIMIT 1');
  const row = r.rows[0];
  if (!row) {
    console.log("No rows");
    return;
  }
  console.log(`STATUS: ${row.status} | SCORE: ${row.score} | ERR: ${row.error_message}`);
  
  if (row.status === 'done' && row.report_data) {
    console.log("\n--- EXCERPT OF REPORT DATA ---");
    console.log(JSON.stringify(row.report_data, null, 2).substring(0, 1500) + "\n...[truncated]");
  }
  await pool.end();
}
run();
