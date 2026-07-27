import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({
  host: 'aws-1-ap-south-1.pooler.supabase.com', port: 6543,
  database: 'postgres', user: 'postgres.khxbabotbvnyjwvqtumt',
  password: 'zQqau#PVNTZG,m6', ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    console.log("=== Finding Completed Policies ===\n");
    
    // Get completed policies with data
    const policies = await pool.query(`
      SELECT id, name, insurer, policy_name, status, score, 
             policyholder_name, expiry_date, sum_insured
      FROM clients 
      WHERE status = 'done' AND score IS NOT NULL
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    if (policies.rows.length === 0) {
      console.log("No completed policies found");
      
      // Check all statuses
      const statusCount = await pool.query(`
        SELECT status, COUNT(*) as count
        FROM clients
        GROUP BY status
      `);
      
      console.log("\nPolicy Status Breakdown:");
      for (const row of statusCount.rows) {
        console.log(`  ${row.status}: ${row.count}`);
      }
    } else {
      console.log(`Found ${policies.rows.length} completed policies:\n`);
      
      for (const policy of policies.rows) {
        console.log(`Policy ID: ${policy.id}`);
        console.log(`  Name: ${policy.policyholder_name || policy.name || 'N/A'}`);
        console.log(`  Insurer: ${policy.insurer || 'N/A'}`);
        console.log(`  Score: ${policy.score}`);
        console.log(`  Expiry: ${policy.expiry_date || 'N/A'}`);
        console.log(`  Sum Insured: ${policy.sum_insured || 'N/A'}`);
        console.log('');
      }
    }
    
    await pool.end();
  } catch (err) {
    console.error("Error:", err.message);
    await pool.end();
  }
}

run();
