import pkg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pkg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    await pool.query(`ALTER TABLE analysis_jobs ADD COLUMN IF NOT EXISTS result JSONB;`);
    console.log("Successfully added result column to analysis_jobs");
  } catch(e) {
    console.error("DB Alter Error:", e);
  } finally {
    await pool.end();
  }
}
run();
