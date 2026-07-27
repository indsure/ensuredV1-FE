import { Pool } from 'pg';
const pool = new Pool({
  connectionString: "postgresql://postgres:zQqau%23PVNTZG%2Cm6@db.khxbabotbvnyjwvqtumt.supabase.co:5432/postgres"
});

import fs from 'fs';
async function main() {
  const result = await pool.query("SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agents'");
  fs.writeFileSync('policies.json', JSON.stringify(result.rows, null, 2));
  process.exit(0);
}
main();
