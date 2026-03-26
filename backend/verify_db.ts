
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from "dotenv";
dotenv.config({ path: "d:/IndSureV1-FE/backend/.env.local" });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function verify() {
  try {
    console.log("--- TABLE STRUCTURE ---");
    const columns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'public_reports';
    `);
    console.log(JSON.stringify(columns.rows, null, 2));

    console.log("\n--- RLS POLICIES ---");
    const policies = await pool.query(`
      SELECT * FROM pg_policies WHERE tablename = 'public_reports';
    `);
    console.log(JSON.stringify(policies.rows, null, 2));

    console.log("\n--- UUID CHECK ---");
    const report = await pool.query(`
      SELECT id, client_id, agent_id, is_active 
      FROM public_reports 
      WHERE id = 'a8bb4278-9b42-4dc7-bfdd-da328dc40ffd';
    `);
    console.log(JSON.stringify(report.rows, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

verify();
