import pkg from 'pg';
import fs from 'fs';
const { Client } = pkg;

const connectionString = 'postgresql://postgres.khxbabotbvnyjwvqtumt:zQqau%23PVNTZG%2Cm6@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=no-verify';

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
