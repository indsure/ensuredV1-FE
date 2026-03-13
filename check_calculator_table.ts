import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: "postgresql://postgres:zQqau%23PVNTZG%2Cm6@db.khxbabotbvnyjwvqtumt.supabase.co:5432/postgres"
});

async function checkCalculatorTable() {
  try {
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'calculator_reports'
    `);
    
    if (res.rows.length === 0) {
      console.log('TABLE NOT FOUND: calculator_reports');
    } else {
      console.log('TABLE FOUND: calculator_reports');
      const cols = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'calculator_reports'
      `);
      console.table(cols.rows);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkCalculatorTable();
