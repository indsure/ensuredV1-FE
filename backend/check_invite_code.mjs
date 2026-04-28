import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkCode() {
  try {
    const code = process.argv[2] || 'INDSURE2026';
    
    console.log(`\n🔍 Checking invite code: ${code}\n`);

    const result = await pool.query(`
      SELECT code, is_active, max_uses, current_uses, expires_at, created_at
      FROM invite_codes 
      WHERE code = $1
    `, [code]);

    if (result.rows.length === 0) {
      console.log('❌ Code not found in database');
      console.log('\n💡 Available codes:');
      const allCodes = await pool.query(`
        SELECT code, is_active, max_uses, current_uses 
        FROM invite_codes 
        ORDER BY created_at DESC 
        LIMIT 5
      `);
      console.table(allCodes.rows);
    } else {
      console.log('✅ Code found:');
      console.table(result.rows);
      
      const row = result.rows[0];
      console.log('\n📊 Status:');
      console.log(`  Active: ${row.is_active ? '✅ Yes' : '❌ No'}`);
      console.log(`  Max Uses: ${row.max_uses === null ? '♾️  Unlimited' : row.max_uses}`);
      console.log(`  Current Uses: ${row.current_uses || 0}`);
      console.log(`  Expires: ${new Date(row.expires_at).toLocaleDateString()}`);
      
      if (!row.is_active) {
        console.log('\n⚠️  Code is INACTIVE - this is why it shows "not found"');
      }
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkCode();
