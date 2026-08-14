import pkg from 'pg';
const { Pool } = pkg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Export it or add it to the repo-root .env before running this script.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
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
