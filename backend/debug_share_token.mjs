import pkg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function debug() {
  try {
    console.log('\n=== Checking Share Token Format ===\n');
    
    // Show all available share tokens
    console.log('All share tokens in database:');
    const allTokens = await pool.query(
      `SELECT 
        share_token, 
        id, 
        status, 
        share_enabled, 
        policyholder_name,
        report_data IS NOT NULL as has_report
      FROM clients 
      ORDER BY created_at DESC 
      LIMIT 10`
    );
    
    if (allTokens.rows.length === 0) {
      console.log('❌ No clients found in database');
    } else {
      allTokens.rows.forEach((r, i) => {
        console.log(`\n${i + 1}. Share Token: ${r.share_token}`);
        console.log(`   Client ID: ${r.id}`);
        console.log(`   Status: ${r.status}`);
        console.log(`   Share Enabled: ${r.share_enabled}`);
        console.log(`   Has Report: ${r.has_report}`);
        console.log(`   Client Name: ${r.policyholder_name || 'N/A'}`);
        
        if (r.share_enabled && r.status === 'done' && r.has_report) {
          console.log(`   ✅ This link should work!`);
          console.log(`   URL: http://localhost:5419/shared/report/${r.share_token}`);
        } else {
          const issues = [];
          if (!r.share_enabled) issues.push('not enabled');
          if (r.status !== 'done') issues.push(`status: ${r.status}`);
          if (!r.has_report) issues.push('no report data');
          console.log(`   ❌ Issues: ${issues.join(', ')}`);
        }
      });
    }
    
    // Check the URL format from the screenshot
    console.log('\n\n=== Analyzing URL from Screenshot ===');
    console.log('URL shown: localhost:5419/agent/Y3J3dHY5-i6fn-4c5f-9ae4-0c2f0b448309');
    console.log('\nIssues identified:');
    console.log('1. ❌ Path is /agent/ but should be /shared/report/');
    console.log('2. ❌ Token format looks wrong (not a valid UUID)');
    console.log('\nCorrect URL format should be:');
    console.log('   http://localhost:5419/shared/report/<valid-uuid>');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

debug();
