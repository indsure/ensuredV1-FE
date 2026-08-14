import pkg from 'pg';
import fs from 'fs';
const { Client } = pkg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Export it or add it to the repo-root .env before running this script.');
  process.exit(1);
}

const connectionString = DATABASE_URL;

async function check() {
  const client = new Client({ connectionString });
  await client.connect();
  const res = await client.query(`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name IN ('analysis_jobs', 'reports', 'policies', 'policy_files', 'agents');
  `);
  fs.writeFileSync('db_schema.json', JSON.stringify(res.rows, null, 2));
  await client.end();
}
check();
