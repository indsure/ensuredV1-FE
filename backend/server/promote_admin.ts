import pg from 'pg';
const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Export it or add it to the repo-root .env before running this script.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL
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
