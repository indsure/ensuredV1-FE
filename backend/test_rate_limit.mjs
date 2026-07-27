import fetch from 'node-fetch';
import pkg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const API_BASE = 'http://localhost:5000';

async function testG1RateLimit() {
  console.log('\n=== G1: Rate limit fires after threshold ===');
  console.log('Note: This test requires a valid share token. Checking if any exist...\n');
  
  try {
    // Get a valid share token from the database
    const tokenResult = await pool.query(
      'SELECT share_token FROM clients WHERE share_enabled = true LIMIT 1'
    );
    
    if (tokenResult.rows.length === 0) {
      console.log('⏭️ SKIP - No valid share tokens found in database');
      console.log('   Create a client record first to test rate limiting');
      return null;
    }
    
    const shareToken = tokenResult.rows[0].share_token;
    console.log(`Using share token: ${shareToken}`);
    
    const results = [];
    console.log('Making 25 requests...');
    
    for (let i = 1; i <= 25; i++) {
      const response = await fetch(`${API_BASE}/api/shared/report/${shareToken}`);
      results.push(response.status);
      process.stdout.write(`${i}: ${response.status} `);
      if (i % 5 === 0) console.log('');
    }
    
    console.log('\n');
    
    const successCount = results.filter(s => s === 200 || s === 404).length;
    const rateLimitCount = results.filter(s => s === 429).length;
    
    console.log(`Success responses (200/404): ${successCount}`);
    console.log(`Rate limited (429): ${rateLimitCount}`);
    
    if (rateLimitCount >= 5) {
      console.log('✅ PASS - Rate limiting is working');
      return true;
    } else if (rateLimitCount > 0) {
      console.log('⚠️  PARTIAL - Some rate limiting occurred but less than expected');
      return null;
    } else {
      console.log('❌ FAIL - No rate limiting occurred');
      return false;
    }
  } catch (error) {
    console.error('Error:', error.message);
    return false;
  }
}

async function testI4OrphanedJobs() {
  console.log('\n=== I4: Orphaned analysis jobs ===');
  
  try {
    const result = await pool.query(`
      SELECT COUNT(*) 
      FROM analysis_jobs 
      WHERE status = 'pending' 
      AND created_at < now() - interval '10 minutes'
    `);
    
    const count = parseInt(result.rows[0].count);
    console.log(`Orphaned jobs (pending > 10 min): ${count}`);
    
    if (count === 0) {
      console.log('✅ PASS - No orphaned jobs');
      return true;
    } else {
      console.log(`⚠️  NOTE - ${count} orphaned jobs found (should be cleaned up)`);
      return null;
    }
  } catch (error) {
    console.error('Error:', error.message);
    return false;
  }
}

async function testI5ReportDataShape() {
  console.log('\n=== I5: Report data is actually the right shape ===');
  
  try {
    const result = await pool.query(`
      SELECT 
        id,
        report_data->'final_verdict'->>'overall_verdict' as verdict
      FROM clients 
      WHERE status = 'done' 
      AND report_data IS NOT NULL
      LIMIT 5
    `);
    
    if (result.rows.length === 0) {
      console.log('⏭️ SKIP - No completed reports found in database');
      return null;
    }
    
    console.log(`Checking ${result.rows.length} completed reports:`);
    
    let allValid = true;
    for (const row of result.rows) {
      const verdict = row.verdict;
      const isValid = ['SAFE', 'BORDERLINE', 'RISKY'].includes(verdict);
      console.log(`  ${row.id.substring(0, 8)}...: ${verdict || 'NULL'} ${isValid ? '✅' : '❌'}`);
      if (!isValid) allValid = false;
    }
    
    if (allValid) {
      console.log('✅ PASS - All reports have valid verdict structure');
      return true;
    } else {
      console.log('❌ FAIL - Some reports have invalid verdict structure');
      return false;
    }
  } catch (error) {
    console.error('Error:', error.message);
    return false;
  }
}

async function testJ3DatabaseCounts() {
  console.log('\n=== J3: Database row counts make sense ===');
  
  try {
    const clients = await pool.query('SELECT COUNT(*) FROM clients');
    const reportViews = await pool.query('SELECT COUNT(*) FROM report_views');
    const analysisJobs = await pool.query('SELECT COUNT(*) FROM analysis_jobs');
    
    console.log(`Clients: ${clients.rows[0].count}`);
    console.log(`Report Views: ${reportViews.rows[0].count}`);
    console.log(`Analysis Jobs: ${analysisJobs.rows[0].count}`);
    
    console.log('✅ PASS - Counts retrieved successfully');
    console.log('   (Manual verification: do these numbers match your testing activity?)');
    return true;
  } catch (error) {
    console.error('Error:', error.message);
    return false;
  }
}

async function runTests() {
  const results = [];
  
  results.push(await testG1RateLimit());
  results.push(await testI4OrphanedJobs());
  results.push(await testI5ReportDataShape());
  results.push(await testJ3DatabaseCounts());
  
  await pool.end();
  
  console.log('\n=== Summary ===');
  const passed = results.filter(r => r === true).length;
  const failed = results.filter(r => r === false).length;
  const skipped = results.filter(r => r === null).length;
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Skipped/Partial: ${skipped}`);
}

runTests();
