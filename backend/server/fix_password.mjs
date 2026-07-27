import pg from 'pg';
import { createHash } from 'crypto';
const { Pool } = pg;

const CONN = "postgresql://postgres:zQqau%23PVNTZG%2Cm6@db.khxbabotbvnyjwvqtumt.supabase.co:5432/postgres";
const pool = new Pool({ connectionString: CONN });

// The password we want to set
const TEST_EMAIL = 'deepak@indsure.com';
const NEW_PASSWORD = 'Indsure@2026';

async function fixPassword() {
  try {
    // Use Supabase's crypt function to set the password properly
    // Supabase uses PostgreSQL's crypt() + gen_salt() for password hashing
    const res = await pool.query(`
      UPDATE auth.users
      SET encrypted_password = crypt($1, gen_salt('bf'))
      WHERE email = $2
      RETURNING id, email
    `, [NEW_PASSWORD, TEST_EMAIL]);

    if (res.rows.length === 0) {
      console.log('❌ User not found:', TEST_EMAIL);
      process.exit(1);
    }

    console.log('✅ Password updated successfully for:', res.rows[0].email);
    console.log('   User ID:', res.rows[0].id);
    console.log('\nLogin credentials:');
    console.log('   Email   :', TEST_EMAIL);
    console.log('   Password:', NEW_PASSWORD);
    console.log('   URL     : http://localhost:5412/agent/login');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

fixPassword();
