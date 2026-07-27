import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: "postgresql://postgres:zQqau%23PVNTZG%2Cm6@db.khxbabotbvnyjwvqtumt.supabase.co:5432/postgres"
});

async function findAndPromote() {
  try {
    const res = await pool.query("SELECT id, email, full_name FROM agents LIMIT 5");
    console.log('Recent Agents:', JSON.stringify(res.rows, null, 2));
    
    if (res.rows.length > 0) {
      const firstUser = res.rows[0];
      await pool.query("UPDATE agents SET is_admin = true WHERE id = $1", [firstUser.id]);
      console.log(`PROMOTED ${firstUser.full_name} (${firstUser.email}) to Admin.`);
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Failed:', err);
    process.exit(1);
  }
}

findAndPromote();
