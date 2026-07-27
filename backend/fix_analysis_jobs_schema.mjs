import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixSchema() {
  console.log('Fixing analysis_jobs table schema...\n');
  
  try {
    // Check current schema
    const schemaCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'analysis_jobs'
      ORDER BY ordinal_position
    `);
    
    console.log('Current columns:');
    schemaCheck.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
    // Add missing columns if they don't exist
    const columnsToAdd = [
      { name: 'result', type: 'JSONB', default: null },
      { name: 'error', type: 'TEXT', default: null },
      { name: 'completed_at', type: 'BIGINT', default: null },
      { name: 'extraction_started_at', type: 'BIGINT', default: null },
      { name: 'extraction_ended_at', type: 'BIGINT', default: null },
      { name: 'fetch_started_at', type: 'BIGINT', default: null },
      { name: 'fetch_ended_at', type: 'BIGINT', default: null },
      { name: 'ai_started_at', type: 'BIGINT', default: null },
      { name: 'ai_ended_at', type: 'BIGINT', default: null },
      { name: 'prompt_version', type: 'TEXT', default: null },
    ];
    
    console.log('\nAdding missing columns...');
    
    for (const col of columnsToAdd) {
      try {
        await pool.query(`
          ALTER TABLE analysis_jobs 
          ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}
        `);
        console.log(`✅ Added column: ${col.name}`);
      } catch (err) {
        console.log(`⚠️  Column ${col.name} might already exist or error: ${err.message}`);
      }
    }
    
    console.log('\n✅ Schema fix complete!');
    
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await pool.end();
  }
}

fixSchema();
