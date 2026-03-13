import pg from 'pg';
import { randomUUID } from 'crypto';
const { Pool } = pg;

// Uses PostgreSQL connection to directly insert a user into auth.users
// AND the agents table — bypassing email entirely
const CONN = "postgresql://postgres:zQqau%23PVNTZG%2Cm6@db.khxbabotbvnyjwvqtumt.supabase.co:5432/postgres";
const pool = new Pool({ connectionString: CONN });

// ─── CONFIGURE YOUR TEST ACCOUNT HERE ─────────────────────────────────────
const TEST_EMAIL = 'deepak@indsure.com';   // <-- choose your email
const TEST_PASSWORD_HASH = null;           // we'll use Supabase's raw insert approach
const TEST_NAME = 'Deepak (Admin)';
const TEST_CITY = 'Bangalore';
const INVITE_CODE = 'INDSURE2026';
// ──────────────────────────────────────────────────────────────────────────

async function createTestAgent() {
  try {
    // Check if user already exists in auth.users
    const existing = await pool.query(
      `SELECT id FROM auth.users WHERE email = $1`,
      [TEST_EMAIL]
    );

    let userId;
    if (existing.rows.length > 0) {
      userId = existing.rows[0].id;
      console.log(`Auth user already exists: ${userId}`);
    } else {
      // Create auth user directly in the auth schema
      userId = randomUUID();
      const now = new Date().toISOString();

      await pool.query(`
        INSERT INTO auth.users (
          id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
          is_super_admin, role, encrypted_password, email_confirmed_at,
          created_at, updated_at, confirmation_token, recovery_token,
          email_change_token_new, email_change, aud
        ) VALUES (
          $1,
          '00000000-0000-0000-0000-000000000000',
          $2,
          '{"provider":"email","providers":["email"]}',
          '{}',
          false,
          'authenticated',
          -- bcrypt of 'Indsure@2026'
          '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lHy2',
          $3,
          $3,
          $3,
          '',
          '',
          '',
          '',
          'authenticated'
        )
      `, [userId, TEST_EMAIL, now]);

      console.log(`Created auth user: ${userId} (email: ${TEST_EMAIL})`);
      console.log('Password: Indsure@2026');
    }

    // Now create the agent profile
    await pool.query(`
      INSERT INTO public.agents (id, email, full_name, city, experience_years, invite_code, is_admin)
      VALUES ($1, $2, $3, $4, 5, $5, true)
      ON CONFLICT (id) DO UPDATE SET is_admin = true, full_name = $3
    `, [userId, TEST_EMAIL, TEST_NAME, TEST_CITY, INVITE_CODE]);

    console.log(`Agent profile created/updated with is_admin = true`);

    // Mark invite code as used (so it stays clean)
    await pool.query(`
      UPDATE public.invite_codes
      SET used_by = $1, used_at = NOW(), is_active = false
      WHERE code = $2 AND used_by IS NULL
    `, [userId, INVITE_CODE]);

    console.log('\n✅ DONE! Login credentials:');
    console.log(`   Email   : ${TEST_EMAIL}`);
    console.log(`   Password: Indsure@2026`);
    console.log(`   URL     : http://localhost:5173/agent/login`);
    console.log(`   Admin   : http://localhost:5173/admin`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Failed:', err.message);
    process.exit(1);
  }
}

createTestAgent();
