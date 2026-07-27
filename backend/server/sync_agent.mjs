import pg from 'pg';
const { Pool } = pg;

// Use the pooler connection we just fixed in routes.ts
const pool = new Pool({
  host: 'aws-1-ap-south-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.khxbabotbvnyjwvqtumt',
  password: 'zQqau#PVNTZG,m6',
  ssl: { rejectUnauthorized: false },
});

async function syncAgent() {
  try {
    // 1. Get all users from auth.users
    const authUsers = await pool.query('SELECT auth.users.id, auth.users.email, raw_user_meta_data->>\'full_name\' as full_name FROM auth.users');
    
    // 2. Insert into agents if missing
    for (const user of authUsers.rows) {
      const { id, email, full_name } = user;
      
      const check = await pool.query('SELECT id FROM agents WHERE id = $1', [id]);
      if (check.rows.length === 0) {
        console.log(`Missing agent found: ${email} (${id}). Inserting...`);
        await pool.query(`
          INSERT INTO agents (id, email, full_name, is_admin, upload_limit) 
          VALUES ($1, $2, $3, true, 20)
        `, [id, email, full_name || 'Admin User']);
        console.log(`✅ Successfully synced agent: ${email}`);
      }
    }
    console.log('Done syncing. You can upload policies now.');
  } catch (err) {
    console.error('Error syncing agent:', err);
  } finally {
    pool.end();
  }
}

syncAgent();
