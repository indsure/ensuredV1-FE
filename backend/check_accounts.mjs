import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkAccounts() {
  console.log('Checking agent accounts...\n');
  
  const result = await pool.query(`
    SELECT id, email, created_at, invite_code 
    FROM agents 
    ORDER BY created_at DESC 
    LIMIT 10
  `);
  
  console.log('Recent accounts:');
  result.rows.forEach(row => {
    console.log(`- ${row.email} (created: ${row.created_at}, invite: ${row.invite_code})`);
  });
  
  await pool.end();
}

checkAccounts().catch(console.error);
