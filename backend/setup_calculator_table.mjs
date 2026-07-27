import 'dotenv/config';
import pkg from 'pg';

const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS calculator_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        inputs JSONB NOT NULL,
        result_data JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log("calculator_reports table checked/created.");
    process.exit(0);
  } catch (err) {
    console.error("Error creating calculator_reports table:", err);
    process.exit(1);
  }
}

run();
