import pkg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function investigate() {
  try {
    console.log('\n=== Investigating I4: analysis_jobs table ===');
    
    // Check the status column type
    const statusType = await pool.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns 
      WHERE table_name = 'analysis_jobs' 
      AND column_name = 'status'
    `);
    console.log('Status column info:', statusType.rows[0]);
    
    // Check what values exist
    const statusValues = await pool.query(`
      SELECT status, COUNT(*) 
      FROM analysis_jobs 
      GROUP BY status
    `);
    console.log('\nStatus values in table:');
    statusValues.rows.forEach(r => console.log(`  ${r.status}: ${r.count}`));
    
    // Check if there's a created_at column and its type
    const createdAtType = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'analysis_jobs' 
      AND column_name = 'created_at'
    `);
    console.log('\nCreated_at column:', createdAtType.rows[0]);
    
    console.log('\n=== Investigating I5: Report data structure ===');
    
    // Get a sample report to see its structure
    const sampleReport = await pool.query(`
      SELECT 
        id,
        status,
        score,
        jsonb_typeof(report_data) as report_type,
        jsonb_pretty(report_data) as report_sample
      FROM clients 
      WHERE status = 'done' 
      AND report_data IS NOT NULL
      LIMIT 1
    `);
    
    if (sampleReport.rows.length > 0) {
      const report = sampleReport.rows[0];
      console.log(`\nSample report ID: ${report.id}`);
      console.log(`Status: ${report.status}`);
      console.log(`Score: ${report.score}`);
      console.log(`Report data type: ${report.report_type}`);
      console.log('\nReport structure (first 500 chars):');
      console.log(report.report_sample.substring(0, 500));
      
      // Try to access the final_verdict
      const verdictCheck = await pool.query(`
        SELECT 
          report_data->'final_verdict' as final_verdict_obj,
          jsonb_typeof(report_data->'final_verdict') as verdict_type
        FROM clients 
        WHERE id = $1
      `, [report.id]);
      
      console.log('\nFinal verdict object type:', verdictCheck.rows[0].verdict_type);
      if (verdictCheck.rows[0].final_verdict_obj) {
        const verdictObj = verdictCheck.rows[0].final_verdict_obj;
        console.log('Final verdict object:', JSON.stringify(verdictObj, null, 2));
      }
    } else {
      console.log('No completed reports found');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

investigate();
