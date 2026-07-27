import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: 'postgresql://postgres.khxbabotbvnyjwvqtumt:zQqau#PVNTZG,m6@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const sql = process.argv[2];
  if (!sql) {
    console.error('Please provide any SQL query.');
    process.exit(1);
  }

  try {
    const res = await pool.query(sql);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    pool.end();
  }
}
run();
