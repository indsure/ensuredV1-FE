import pkg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env.local' });

const { Pool } = pkg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const sql = `
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM agents WHERE id = auth.uid();
$$;

DROP POLICY IF EXISTS agents_read_policy ON agents;
CREATE POLICY agents_read_policy ON agents FOR SELECT
USING (
  id = auth.uid() 
  OR get_my_role() IN ('manager', 'admin')
);

DROP POLICY IF EXISTS agents_write_policy ON agents;
CREATE POLICY agents_write_policy ON agents FOR ALL
USING (
  get_my_role() = 'admin'
);

DROP POLICY IF EXISTS policies_read_policy ON policies;
CREATE POLICY policies_read_policy ON policies FOR SELECT
USING (
  assigned_agent_id = auth.uid() 
  OR created_by_agent_id = auth.uid()
  OR get_my_role() IN ('manager', 'admin')
);

DROP POLICY IF EXISTS policies_write_policy ON policies;
CREATE POLICY policies_write_policy ON policies FOR ALL
USING (
  get_my_role() IN ('manager', 'admin')
  OR assigned_agent_id = auth.uid()
  OR created_by_agent_id = auth.uid()
);

DROP POLICY IF EXISTS reports_read_policy ON reports;
CREATE POLICY reports_read_policy ON reports FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM policies p 
    WHERE p.id = reports.policy_id 
    AND (p.assigned_agent_id = auth.uid() OR p.created_by_agent_id = auth.uid())
  )
  OR reviewed_by_agent_id = auth.uid()
  OR get_my_role() IN ('manager', 'admin')
);

DROP POLICY IF EXISTS reports_write_policy ON reports;
CREATE POLICY reports_write_policy ON reports FOR ALL
USING (
  get_my_role() = 'admin'
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
    console.log("RLS infinite recursion FIXED successfully!");
  } catch (error) {
    console.error("Error fixing RLS:", error);
  } finally {
    await pool.end();
  }
}

run();
