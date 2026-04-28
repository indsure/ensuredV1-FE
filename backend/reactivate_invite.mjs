import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Reactivates an existing invite code and makes it reusable
 * 
 * Usage:
 *   node backend/reactivate_invite.mjs INDSURE2026 unlimited
 *   node backend/reactivate_invite.mjs INDSURE-TESTING 5
 */

async function reactivateInvite() {
  try {
    const code = process.argv[2];
    const maxUsesArg = process.argv[3] || 'unlimited';

    if (!code) {
      console.error('\n❌ Error: Please provide an invite code');
      console.log('\nUsage:');
      console.log('  node backend/reactivate_invite.mjs <CODE> [max_uses]');
      console.log('\nExamples:');
      console.log('  node backend/reactivate_invite.mjs INDSURE2026 unlimited');
      console.log('  node backend/reactivate_invite.mjs INDSURE-TESTING 10');
      process.exit(1);
    }

    const maxUses = maxUsesArg === 'unlimited' ? null : parseInt(maxUsesArg);

    console.log(`\n🔄 Reactivating invite code...`);
    console.log(`   Code: ${code.toUpperCase()}`);
    console.log(`   Max uses: ${maxUses === null ? 'unlimited' : maxUses}`);

    // Check if columns exist, add if needed
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'invite_codes' 
      AND column_name IN ('max_uses', 'current_uses')
    `);

    if (columnCheck.rows.length < 2) {
      console.log('\n⚠️  Adding max_uses and current_uses columns...');
      await pool.query(`
        ALTER TABLE invite_codes 
        ADD COLUMN IF NOT EXISTS max_uses INTEGER DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS current_uses INTEGER DEFAULT 0
      `);
      console.log('✅ Columns added');
    }

    // Check if code exists
    const existing = await pool.query(
      'SELECT * FROM invite_codes WHERE code = $1',
      [code.toUpperCase()]
    );

    if (existing.rows.length === 0) {
      console.log('\n❌ Code not found. Creating new code instead...');
      const result = await pool.query(`
        INSERT INTO invite_codes (code, is_active, max_uses, current_uses, expires_at)
        VALUES ($1, true, $2, 0, NOW() + INTERVAL '10 years')
        RETURNING *
      `, [code.toUpperCase(), maxUses]);
      
      console.log('\n✅ New invite code created!');
      console.table(result.rows);
    } else {
      // Reactivate existing code
      const result = await pool.query(`
        UPDATE invite_codes 
        SET 
          is_active = true,
          max_uses = $2,
          current_uses = 0,
          used_by = NULL,
          used_at = NULL,
          expires_at = NOW() + INTERVAL '10 years'
        WHERE code = $1
        RETURNING *
      `, [code.toUpperCase(), maxUses]);

      console.log('\n✅ Invite code reactivated successfully!');
      console.table(result.rows);
    }

    console.log('\n💡 This code can now be used', maxUses === null ? 'unlimited times' : `${maxUses} times`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

reactivateInvite();
