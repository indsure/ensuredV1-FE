import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: "postgresql://postgres:zQqau%23PVNTZG%2Cm6@db.khxbabotbvnyjwvqtumt.supabase.co:5432/postgres"
});

async function inspect() {
  try {
    const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log('All Tables:', tables.rows.map(r => r.table_name));
    
    // Check if agents table exists and has data
    const res = await pool.query("SELECT COUNT(*) FROM agents");
    console.log('Agents Count:', res.rows[0].count);

    if (parseInt(res.rows[0].count) === 0) {
        console.log('Seeding an admin user for testing...');
        const adminId = '00000000-0000-0000-0000-000000000000'; // Mocking a UUID
        await pool.query(`
            INSERT INTO agents (id, email, full_name, city, is_admin)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (id) DO UPDATE SET is_admin = true
        `, [adminId, 'admin@indsure.com', 'Super Admin', 'Bangalore', true]);
        console.log('Admin user seeded: admin@indsure.com');
    } else {
        const admin = await pool.query("SELECT id, email FROM agents LIMIT 1");
        await pool.query("UPDATE agents SET is_admin = true WHERE id = $1", [admin.rows[0].id]);
        console.log(`Promoted ${admin.rows[0].email} to Admin.`);
    }

    process.exit(0);
  } catch (err) {
    console.error('Failed:', err);
    process.exit(1);
  }
}

inspect();
