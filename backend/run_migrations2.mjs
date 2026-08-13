import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Export it or add it to the repo-root .env before running this script.');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: DATABASE_URL
});

async function run() {
  const query = process.argv[2];
  try {
    const res = await pool.query(query);
    console.log("Query executed successfully.", res.command);
  } catch (err) {
    console.error("Query failed:", err);
  } finally {
    pool.end();
  }
}

run();
