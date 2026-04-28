import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({
  host: 'aws-1-ap-south-1.pooler.supabase.com', port: 6543,
  database: 'postgres', user: 'postgres.khxbabotbvnyjwvqtumt',
  password: 'zQqau#PVNTZG,m6', ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    // Get all tables
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log("=== TABLES IN DATABASE ===");
    for (const table of tables.rows) {
      console.log(`\nTable: ${table.table_name}`);
      
      // Get columns for each table
      const columns = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [table.table_name]);
      
      for (const col of columns.rows) {
        console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
      }
    }
    
    await pool.end();
  } catch (err) {
    console.error("Error:", err.message);
    await pool.end();
  }
}
run();
