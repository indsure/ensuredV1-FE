import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres.khxbabotbvnyjwvqtumt:Indsure_V1_2026@aws-0-ap-south-1.pooler.supabase.com:6543/postgres'
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
