import 'dotenv/config';
import pkg from 'pg';
import crypto from 'crypto';

const { Pool } = pkg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Export it or add it to the repo-root .env before running this script.');
  process.exit(1);
}
// Default to local Supabase running on 5412, or whatever is in DATABASE_URL
const connectionString = DATABASE_URL;

const pool = new Pool({
  connectionString
});

async function run() {
  try {
    console.log("Connecting to postgres to update schema...");
    
    // 1. Create or replace the archive_old_reports function and trigger
    console.log("Creating function archive_old_reports_func...");
    await pool.query(`
      CREATE OR REPLACE FUNCTION archive_old_reports_func()
      RETURNS trigger AS $$
      BEGIN
        IF NEW.created_at < (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - INTERVAL '12 months' THEN
          NEW.status = 'archived';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    console.log("Creating trigger archive_old_reports...");
    await pool.query(`
      DROP TRIGGER IF EXISTS archive_old_reports ON reports;
      CREATE TRIGGER archive_old_reports
      BEFORE INSERT OR UPDATE ON reports
      FOR EACH ROW
      EXECUTE FUNCTION archive_old_reports_func();
    `);

    // 2. Verify block_report_delete_trigger is installed (creating it just in case)
    console.log("Verifying block_report_delete_trigger...");
    await pool.query(`
      CREATE OR REPLACE FUNCTION prevent_report_deletion()
      RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'Reports cannot be hard deleted. Use soft-delete or archiving instead.';
      END;
      $$ LANGUAGE plpgsql;
      
      DROP TRIGGER IF EXISTS block_report_delete_trigger ON reports;
      CREATE TRIGGER block_report_delete_trigger
      BEFORE DELETE ON reports
      FOR EACH ROW
      EXECUTE FUNCTION prevent_report_deletion();
    `);

    // 3. Insert storage bucket policy-files without a lifecycle constraint
    console.log("Inserting policy-files storage bucket...");
    await pool.query(`
      INSERT INTO storage.buckets (id, name, public)
      VALUES ('policy-files', 'policy-files', false)
      ON CONFLICT (id) DO NOTHING;
    `);

    console.log("Schema updates completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Error applying schema updates:", error);
    process.exit(1);
  }
}

run();
