import pg from 'pg';
import fs from 'fs';

const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres.khxbabotbvnyjwvqtumt:zQqau%23PVNTZG%2Cm6@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=no-verify'
});

async function runMigration() {
  try {
    console.log('Reading migration file...');
    const sql = fs.readFileSync('../setup_signup_approval.sql', 'utf8');
    
    console.log('Connecting to database...');
    const client = await pool.connect();
    
    console.log('Running migration...');
    await client.query(sql);
    
    console.log('✅ Migration completed successfully!');
    
    // Verify tables were created
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('agent_signup_requests', 'notifications')
    `);
    
    console.log('\nTables created:');
    result.rows.forEach(row => console.log('  -', row.table_name));
    
    client.release();
    await pool.end();
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.error(err);
    process.exit(1);
  }
}

runMigration();
