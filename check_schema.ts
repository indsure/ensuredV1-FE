import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: "postgresql://postgres:zQqau%23PVNTZG%2Cm6@db.khxbabotbvnyjwvqtumt.supabase.co:5432/postgres"
});

async function checkSchema() {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'agents'
    `);
    console.log('AGENTS COLUMNS:');
    console.table(res.rows);

    const inviteRes = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'invite_codes'
    `);
    console.log('INVITE_CODES COLUMNS:');
    console.table(inviteRes.rows);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkSchema();
