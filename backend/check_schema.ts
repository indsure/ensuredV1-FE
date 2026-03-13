import "./server/loadEnv";
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkSchema() {
  try {
    const listTables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('TABLES_IN_PUBLIC:' + JSON.stringify(listTables.rows.map(r => r.table_name)));

    const columnsRes = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'public_reports'
    `);
    console.log('ALL_COLUMNS_JSON:' + JSON.stringify(columnsRes.rows));

    const reportsRes = await pool.query('SELECT * FROM public_reports LIMIT 1');
    if (reportsRes.rows.length > 0) {
        console.log('SAMPLE_ROW_JSON:' + JSON.stringify(reportsRes.rows[0]));
    }

  } catch (err: any) {
    console.error('ERROR:', err.message);
  } finally {
    await pool.end();
  }
}

checkSchema();
