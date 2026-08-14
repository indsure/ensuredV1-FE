import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Export it or add it to the repo-root .env before running this script.');
  process.exit(1);
}
const pool = new Pool({
  connectionString: DATABASE_URL
});

import fs from 'fs';
async function main() {
  const result = await pool.query("SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agents'");
  fs.writeFileSync('policies.json', JSON.stringify(result.rows, null, 2));
  process.exit(0);
}
main();
