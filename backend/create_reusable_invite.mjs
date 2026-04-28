import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Creates a reusable invite code that can be used multiple times
 * 
 * Usage:
 *   node backend/create_reusable_invite.mjs INDSURE2026 10
 *   (creates code "INDSURE2026" with 10 uses)
 * 
 *   node backend/create_reusable_invite.mjs INDSURE2026 unlimited
 *   (creates code with unlimited uses)
 */

async function createReusableInvite() {
  try {
    const code = process.argv[2] || 'INDSURE2026';
    const maxUsesArg = process.argv[3] || 'unlimited';
    const maxUses = maxUsesArg === 'unlimited' ? null : parseInt(maxUsesArg);

    console.log(`\n🔑 Creating reusable invite code...`);
    console.log(`   Code: ${code}`);
    console.log(`   Max uses: ${maxUses === null ? 'unlimited' : maxUses}`);

    // First, check if the table has max_uses column
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'invite_codes' 
      AND column_name = 'max_uses'
    `);

    if (columnCheck.rows.length === 0) {
      console.log('\n⚠️  Adding max_uses column to invite_codes table...');
      await pool.query(`
        ALTER TABLE invite_codes 
        ADD COLUMN IF NOT EXISTS max_uses INTEGER DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS current_uses INTEGER DEFAULT 0
      `);
      console.log('✅ Columns added successfully');
    }

    // Insert or update the invite code
    const result = await pool.query(`
      INSERT INTO invite_codes (code, is_active, max_uses, current_uses, used_by, used_at, expires_at)
      VALUES ($1, true, $2, 0, NULL, NULL, NOW() + INTERVAL '10 years')
      ON CONFLICT (code) 
      DO UPDATE SET 
        is_active = true,
        max_uses = $2,
        current_uses = 0,
        used_by = NULL,
        used_at = NULL,
        expires_at = NOW() + INTERVAL '10 years'
      RETURNING *
    `, [code.toUpperCase(), maxUses]);

    console.log('\n✅ Reusable invite code created/updated successfully!');
    console.log('\n📋 Code details:');
    console.table(result.rows);

    console.log('\n💡 Usage instructions:');
    console.log(`   - This code can be used ${maxUses === null ? 'unlimited times' : `${maxUses} times`}`);
    console.log(`   - Share it with advisors: ${code.toUpperCase()}`);
    console.log(`   - Current uses: 0`);
    
    if (maxUses !== null) {
      console.log(`   - Remaining uses: ${maxUses}`);
    }

  } catch (error) {
    console.error('\n❌ Error creating invite code:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

createReusableInvite();
