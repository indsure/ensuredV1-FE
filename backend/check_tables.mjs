import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkTables() {
  console.log('Checking database tables...\n');
  
  try {
    // Check clients table
    console.log('=== CLIENTS TABLE ===');
    const clientsResult = await pool.query(`
      SELECT id, name, insurer, status, agent_id, created_at 
      FROM clients 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    console.log(`Found ${clientsResult.rows.length} clients:`);
    clientsResult.rows.forEach(row => {
      console.log(`  - ${row.name} (${row.insurer}) - Status: ${row.status}`);
    });
    
    // Check policies table
    console.log('\n=== POLICIES TABLE ===');
    const policiesResult = await pool.query(`
      SELECT id, client_name, insurer_name, status, created_by_agent_id, created_at 
      FROM policies 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    console.log(`Found ${policiesResult.rows.length} policies:`);
    policiesResult.rows.forEach(row => {
      console.log(`  - ${row.client_name} (${row.insurer_name}) - Status: ${row.status}`);
    });
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkTables();
