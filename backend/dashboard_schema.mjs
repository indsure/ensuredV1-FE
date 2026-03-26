import pkg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pkg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const sql = `
-- 0. Setup Enums
DO $$ BEGIN CREATE TYPE agent_role AS ENUM ('admin','manager','agent','test'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE agent_status AS ENUM ('active','inactive','test'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE policy_status AS ENUM ('queued','processing','needs_review','done','failed','archived'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE policy_priority AS ENUM ('low','normal','high'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE file_type_enum AS ENUM ('policy_pdf','supporting_doc'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE job_status AS ENUM ('queued','running','succeeded','failed','cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE report_status AS ENUM ('pending_review','approved','rejected'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 1. agents (extend existing)
CREATE TABLE IF NOT EXISTS agents (
    id uuid PRIMARY KEY
);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS role agent_role DEFAULT 'agent';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS status agent_status DEFAULT 'active';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS experience_years int;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT NOW();
-- Note: 'created_at' already exists usually, let's add safely
DO $$ BEGIN ALTER TABLE agents ADD COLUMN created_at timestamptz DEFAULT NOW(); EXCEPTION WHEN duplicate_column THEN null; END $$;

-- 2. policies
CREATE TABLE IF NOT EXISTS policies (
   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
   client_name text,
   client_identifier text,
   insurer_name text,
   product_name text,
   policy_number text UNIQUE,
   status policy_status,
   score numeric(3,2),
   flaws_count int DEFAULT 0,
   priority policy_priority DEFAULT 'normal',
   assigned_agent_id uuid REFERENCES agents(id),
   created_by_agent_id uuid REFERENCES agents(id),
   created_at timestamptz DEFAULT NOW(),
   updated_at timestamptz DEFAULT NOW(),
   policy_start_date date,
   policy_end_date date,
   last_analyzed_at timestamptz
);

-- 3. policy_files
CREATE TABLE IF NOT EXISTS policy_files (
   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
   policy_id uuid REFERENCES policies(id),
   file_path text,
   file_type file_type_enum,
   uploaded_by_agent_id uuid REFERENCES agents(id),
   uploaded_at timestamptz DEFAULT NOW()
);

-- We rename the old analysis_jobs to avoid destroying public route data, because old uses text id
DO $$ BEGIN ALTER TABLE analysis_jobs RENAME TO public_analysis_jobs; EXCEPTION WHEN undefined_table THEN null; WHEN duplicate_table THEN null; END $$;

-- 4. analysis_jobs
CREATE TABLE IF NOT EXISTS analysis_jobs (
   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
   policy_id uuid REFERENCES policies(id),
   triggered_by_agent_id uuid REFERENCES agents(id),
   status job_status,
   pipeline_version text,
   model_name text,
   queued_at timestamptz DEFAULT NOW(),
   started_at timestamptz,
   finished_at timestamptz,
   error_type text,
   error_message text,
   retry_of_job_id uuid
);

-- 5. reports
CREATE TABLE IF NOT EXISTS reports (
   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
   policy_id uuid REFERENCES policies(id),
   analysis_job_id uuid REFERENCES analysis_jobs(id),
   version int,
   status report_status,
   score numeric(3,2),
   flaws_count int,
   summary text,
   report_json jsonb,
   report_markdown text,
   export_pdf_path text,
   created_at timestamptz DEFAULT NOW(),
   updated_at timestamptz DEFAULT NOW(),
   reviewed_by_agent_id uuid REFERENCES agents(id),
   reviewed_at timestamptz
);

-- 6. report_shares
CREATE TABLE IF NOT EXISTS report_shares (
   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
   report_id uuid REFERENCES reports(id),
   token text UNIQUE,
   expires_at timestamptz,
   created_by_agent_id uuid REFERENCES agents(id),
   created_at timestamptz DEFAULT NOW(),
   revoked_at timestamptz,
   last_accessed_at timestamptz
);

-- 7. audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
   event_type text,
   actor_agent_id uuid REFERENCES agents(id),
   entity_type text,
   entity_id uuid,
   metadata jsonb,
   created_at timestamptz DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_policies_status_assigned ON policies(status, assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_policies_created_at ON policies(created_at);
CREATE INDEX IF NOT EXISTS idx_policies_insurer_name ON policies(insurer_name);

CREATE INDEX IF NOT EXISTS idx_reports_policy_id ON reports(policy_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status_policy ON analysis_jobs(status, policy_id);

-- TRIGGER FOR REPORTS DELETE
CREATE OR REPLACE FUNCTION block_report_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Hard deletes are not allowed on the reports table.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS block_report_delete_trigger ON reports;
CREATE TRIGGER block_report_delete_trigger
BEFORE DELETE ON reports
FOR EACH ROW
EXECUTE FUNCTION block_report_delete();

-- RLS POLICIES
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Agents RLS
DROP POLICY IF EXISTS agents_read_policy ON agents;
CREATE POLICY agents_read_policy ON agents FOR SELECT
USING (
  id = auth.uid() 
  OR (SELECT role FROM agents WHERE id = auth.uid()) IN ('manager', 'admin')
);

DROP POLICY IF EXISTS agents_write_policy ON agents;
CREATE POLICY agents_write_policy ON agents FOR ALL
USING (
  (SELECT role FROM agents WHERE id = auth.uid()) = 'admin'
);

-- Policies RLS
DROP POLICY IF EXISTS policies_read_policy ON policies;
CREATE POLICY policies_read_policy ON policies FOR SELECT
USING (
  assigned_agent_id = auth.uid() 
  OR created_by_agent_id = auth.uid()
  OR (SELECT role FROM agents WHERE id = auth.uid()) IN ('manager', 'admin')
);

DROP POLICY IF EXISTS policies_write_policy ON policies;
CREATE POLICY policies_write_policy ON policies FOR ALL
USING (
  (SELECT role FROM agents WHERE id = auth.uid()) IN ('manager', 'admin')
  OR assigned_agent_id = auth.uid()
  OR created_by_agent_id = auth.uid()
);

-- Reports RLS
DROP POLICY IF EXISTS reports_read_policy ON reports;
CREATE POLICY reports_read_policy ON reports FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM policies p 
    WHERE p.id = reports.policy_id 
    AND (p.assigned_agent_id = auth.uid() OR p.created_by_agent_id = auth.uid())
  )
  OR reviewed_by_agent_id = auth.uid()
  OR (SELECT role FROM agents WHERE id = auth.uid()) IN ('manager', 'admin')
);

DROP POLICY IF EXISTS reports_write_policy ON reports;
CREATE POLICY reports_write_policy ON reports FOR ALL
USING (
  (SELECT role FROM agents WHERE id = auth.uid()) = 'admin'
  OR 
  EXISTS (
    SELECT 1 FROM policies p 
    WHERE p.id = reports.policy_id 
    AND (p.assigned_agent_id = auth.uid() OR p.created_by_agent_id = auth.uid())
  )
);
`;

async function run() {
  try {
    await pool.query(sql);
    console.log("Dashboard schema created successfully!");
  } catch (error) {
    console.error("Error creating schema:", error);
  } finally {
    await pool.end();
  }
}

run();
