import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: "postgresql://postgres:zQqau%23PVNTZG%2Cm6@db.khxbabotbvnyjwvqtumt.supabase.co:5432/postgres"
});

async function main() {
  const result = await pool.query("SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agents'");
  console.log(JSON.stringify(result.rows, null, 2));
  process.exit(0);
}
main();
