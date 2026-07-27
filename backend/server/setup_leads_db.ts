import pkg from "pg";
const { Pool } = pkg;
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from root .env file
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set in environment variables");
}

async function setup() {
  const pool = new Pool({ connectionString });

  try {
    console.log("🔧 Setting up leads table...");

    // Drop existing table if it exists (for clean setup)
    await pool.query(`DROP TABLE IF EXISTS leads CASCADE;`);

    await pool.query(`
      CREATE TABLE leads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        city TEXT,
        source TEXT DEFAULT 'policy_report',
        status TEXT DEFAULT 'new',
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        contacted_at TIMESTAMPTZ,
        contacted_by TEXT
      );
    `);

    console.log("✅ Leads table created successfully");

    // Create index for faster queries
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
      CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
    `);

    console.log("✅ Indexes created successfully");

    // Enable RLS (Row Level Security)
    await pool.query(`
      ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
    `);

    console.log("✅ RLS enabled");

    // Create policy for authenticated users to insert leads
    await pool.query(`
      DROP POLICY IF EXISTS "Allow public insert" ON leads;
      CREATE POLICY "Allow public insert" ON leads
        FOR INSERT
        TO anon, authenticated
        WITH CHECK (true);
    `);

    console.log("✅ Insert policy created");

    // Create policy for authenticated users to view leads
    await pool.query(`
      DROP POLICY IF EXISTS "Allow authenticated read" ON leads;
      CREATE POLICY "Allow authenticated read" ON leads
        FOR SELECT
        TO authenticated
        USING (true);
    `);

    console.log("✅ Read policy created");

    // Create policy for service role to do everything
    await pool.query(`
      DROP POLICY IF EXISTS "Service role all access" ON leads;
      CREATE POLICY "Service role all access" ON leads
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
    `);

    console.log("✅ Service role policy created");

    console.log("\n🎉 Leads database setup complete!");
  } catch (error) {
    console.error("❌ Error setting up leads table:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

setup();
