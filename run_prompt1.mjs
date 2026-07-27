import pkg from 'pg';
const { Client } = pkg;

const connectionString = 'postgresql://postgres.khxbabotbvnyjwvqtumt:zQqau%23PVNTZG%2Cm6@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=no-verify';

const sql = `
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS analysis_jobs CASCADE;
DROP TABLE IF EXISTS policy_files CASCADE;
DROP TABLE IF EXISTS policies CASCADE;
DROP TABLE IF EXISTS report_shares CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;

DO $$ BEGIN
    CREATE TYPE agent_role AS ENUM ('admin', 'manager', 'agent', 'test');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE agent_status AS ENUM ('active', 'inactive', 'test');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE policy_status AS ENUM ('queued','processing','needs_review','done','failed','archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE policy_priority AS ENUM ('low','normal','high');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE policy_file_type AS ENUM ('policy_pdf','supporting_doc');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE analysis_job_status AS ENUM ('queued','running','succeeded','failed','cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE report_status AS ENUM ('pending_review','approved','rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS agents (
    id uuid PRIMARY KEY REFERENCES auth.users(id),
    email text,
    name text,
    role agent_role,
    status agent_status,
    location text,
    experience_years int,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Force add columns if table agents already existed and was missing them
DO $$ BEGIN ALTER TABLE agents ADD COLUMN email text; EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE agents ADD COLUMN name text; EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE agents ADD COLUMN role agent_role; EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE agents ADD COLUMN status agent_status; EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE agents ADD COLUMN location text; EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE agents ADD COLUMN experience_years int; EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE agents ADD COLUMN created_at timestamptz; EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE agents ADD COLUMN updated_at timestamptz; EXCEPTION WHEN duplicate_column THEN null; END $$;

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
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    policy_start_date date,
    policy_end_date date,
    last_analyzed_at timestamptz
);

CREATE TABLE IF NOT EXISTS policy_files (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id uuid REFERENCES policies(id),
    file_path text,
    file_type policy_file_type,
    uploaded_by_agent_id uuid REFERENCES agents(id),
    uploaded_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analysis_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id uuid REFERENCES policies(id),
    triggered_by_agent_id uuid REFERENCES agents(id),
    status analysis_job_status,
    pipeline_version text,
    model_name text,
    queued_at timestamptz DEFAULT now(),
    started_at timestamptz,
    finished_at timestamptz,
    error_type text,
    error_message text,
    retry_of_job_id uuid REFERENCES analysis_jobs(id)
);

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
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    reviewed_by_agent_id uuid REFERENCES agents(id),
    reviewed_at timestamptz
);

CREATE TABLE IF NOT EXISTS report_shares (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id uuid REFERENCES reports(id),
    token text UNIQUE CHECK (length(token) = 64),
    expires_at timestamptz,
    created_by_agent_id uuid REFERENCES agents(id),
    created_at timestamptz DEFAULT now(),
    revoked_at timestamptz,
    last_accessed_at timestamptz
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type text,
    actor_agent_id uuid REFERENCES agents(id),
    entity_type text,
    entity_id uuid,
    metadata jsonb,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_policies_status_agent ON policies(status, assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_policies_created_at ON policies(created_at);
CREATE INDEX IF NOT EXISTS idx_policies_insurer ON policies(insurer_name);

CREATE INDEX IF NOT EXISTS idx_reports_policy_id ON reports(policy_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status_policy ON analysis_jobs(status, policy_id);

CREATE OR REPLACE FUNCTION block_report_delete()
RETURNS TRIGGER AS $f$
BEGIN
    RAISE EXCEPTION 'Cannot hard delete reports. Please archive them instead.';
END;
$f$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_block_report_delete ON reports;
CREATE TRIGGER trg_block_report_delete
BEFORE DELETE ON reports
FOR EACH ROW
EXECUTE FUNCTION block_report_delete();

-- RLS POLICIES
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION auth_agent_role() RETURNS text AS $f$
  SELECT role::text FROM agents WHERE id = auth.uid();
$f$ LANGUAGE sql SECURITY DEFINER;

-- agents
DROP POLICY IF EXISTS agents_read_own ON agents;
CREATE POLICY agents_read_own ON agents FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS agents_manager_read_all ON agents;
CREATE POLICY agents_manager_read_all ON agents FOR SELECT USING (auth_agent_role() = 'manager');

DROP POLICY IF EXISTS agents_admin_all ON agents;
CREATE POLICY agents_admin_all ON agents FOR ALL USING (auth_agent_role() = 'admin');

-- policies
DROP POLICY IF EXISTS policies_own_assigned_created ON policies;
CREATE POLICY policies_own_assigned_created ON policies FOR ALL USING (
    assigned_agent_id = auth.uid() OR created_by_agent_id = auth.uid()
);

DROP POLICY IF EXISTS policies_manager_read_all ON policies;
CREATE POLICY policies_manager_read_all ON policies FOR SELECT USING (auth_agent_role() = 'manager');

DROP POLICY IF EXISTS policies_admin_all ON policies;
CREATE POLICY policies_admin_all ON policies FOR ALL USING (auth_agent_role() = 'admin');

-- reports
DROP POLICY IF EXISTS reports_owner_reviewer_read ON reports;
CREATE POLICY reports_owner_reviewer_read ON reports FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM policies p WHERE p.id = reports.policy_id AND 
        (p.assigned_agent_id = auth.uid() OR p.created_by_agent_id = auth.uid())
    ) OR reviewed_by_agent_id = auth.uid()
);

DROP POLICY IF EXISTS reports_manager_read ON reports;
CREATE POLICY reports_manager_read ON reports FOR SELECT USING (auth_agent_role() = 'manager');

DROP POLICY IF EXISTS reports_admin_all ON reports;
CREATE POLICY reports_admin_all ON reports FOR ALL USING (auth_agent_role() = 'admin');
`;

async function setup() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to database.');
    await client.query(sql);
    console.log('SQL setup script executed successfully.');
  } catch (err) {
    console.error('Error executing setup script:', err);
  } finally {
    await client.end();
  }
}

setup();
