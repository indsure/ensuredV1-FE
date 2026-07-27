import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({
  host: 'aws-1-ap-south-1.pooler.supabase.com', port: 6543,
  database: 'postgres', user: 'postgres.khxbabotbvnyjwvqtumt',
  password: 'zQqau#PVNTZG,m6', ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    console.log("=== Testing Policy Detail Query ===\n");
    
    // Get a sample policy
    const policies = await pool.query(`
      SELECT id, name, insurer, policy_name, status, score, created_at, 
             error_message, expiry_date, sum_insured, policyholder_name
      FROM clients 
      WHERE agent_id = '7d485457-27f0-4aba-9022-b22c1aa55156'
      ORDER BY created_at DESC 
      LIMIT 3
    `);
    
    if (policies.rows.length === 0) {
      console.log("No policies found for this agent");
      await pool.end();
      return;
    }
    
    console.log(`Found ${policies.rows.length} policies:\n`);
    
    for (const policy of policies.rows) {
      console.log(`Policy ID: ${policy.id}`);
      console.log(`  Name: ${policy.policyholder_name || policy.name || 'N/A'}`);
      console.log(`  Insurer: ${policy.insurer || 'N/A'}`);
      console.log(`  Policy Name: ${policy.policy_name || 'N/A'}`);
      console.log(`  Status: ${policy.status}`);
      console.log(`  Score: ${policy.score || 'N/A'}`);
      console.log(`  Expiry: ${policy.expiry_date || 'N/A'}`);
      console.log(`  Sum Insured: ${policy.sum_insured || 'N/A'}`);
      console.log(`  Error: ${policy.error_message || 'None'}`);
      console.log(`  Created: ${policy.created_at}`);
      console.log('');
    }
    
    // Test a specific policy with full data
    const testPolicy = policies.rows[0];
    console.log(`\n=== Full Data for Policy ${testPolicy.id} ===\n`);
    
    const fullData = await pool.query(`
      SELECT id, name, insurer, policy_name, status, score, created_at,
             error_message, expiry_date, sum_insured, flaws, report_data, policyholder_name
      FROM clients 
      WHERE id = $1
    `, [testPolicy.id]);
    
    if (fullData.rows.length > 0) {
      const data = fullData.rows[0];
      console.log("Has report_data:", !!data.report_data);
      console.log("Has flaws:", !!data.flaws);
      
      if (data.report_data) {
        console.log("\nReport Data Keys:", Object.keys(data.report_data));
        if (data.report_data.final_verdict) {
          console.log("Final Verdict Summary:", data.report_data.final_verdict.summary?.substring(0, 100) + "...");
        }
      }
      
      if (data.flaws) {
        console.log("\nFlaws Count:", Array.isArray(data.flaws) ? data.flaws.length : 'Not an array');
      }
    }
    
    await pool.end();
  } catch (err) {
    console.error("Error:", err.message);
    await pool.end();
  }
}

run();
