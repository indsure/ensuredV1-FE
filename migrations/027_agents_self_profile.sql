-- 027_agents_self_profile.sql
-- Lets an advisor save their own profile from the portal again (or for the first time).
--
-- The only write policy on live agents is "agents_write_policy" (get_my_role() = 'admin'),
-- recorded by the 026 live check. So My Profile, Settings and the partnered-companies picker
-- have never saved anything for an advisor: an UPDATE that RLS filters to zero rows returns no
-- error, and the page showed "Profile updated" over an unchanged row. Found 2026-10-26 when an
-- advisor's sidebar kept the name he had just "saved" over.
--
-- Safe because of 026: the browser role can only UPDATE the profile columns granted there
-- (name, full_name, phone, location, city, partnered_companies, plus phone_number/firm_name
-- where they exist). plan, role, team_id, credits and everything else stay backend/admin only,
-- whatever this policy allows. If 026 has not run, do NOT run this: without the column grants
-- this would let an advisor write their own plan and role.
--
-- Shared Supabase: this lands on beta AND prod the moment it runs. Idempotent; safe to re-run.
-- Undo: 027_agents_self_profile_down.sql.

BEGIN;

-- Refuse to run without 026's column lockdown in place.
DO $$
BEGIN
  IF has_table_privilege('authenticated', 'public.agents', 'UPDATE') THEN
    RAISE EXCEPTION 'authenticated still holds table-wide UPDATE on agents; run 026 first';
  END IF;
  IF has_column_privilege('authenticated', 'public.agents', 'plan', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.agents', 'role', 'UPDATE') THEN
    RAISE EXCEPTION 'authenticated can UPDATE agents.plan or agents.role; run 026 first';
  END IF;
END $$;

DROP POLICY IF EXISTS "agents_update_own_profile" ON public.agents;
CREATE POLICY "agents_update_own_profile" ON public.agents
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

COMMIT;

-- ─── Verify (run after) ─────────────────────────────────────────────────────
-- V1. Expect agents_update_own_profile (UPDATE) next to agents_write_policy.
--   SELECT policyname, cmd, roles, qual, with_check FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'agents' ORDER BY cmd;
-- V2. Expect only the profile columns (and never plan, role, team_id).
--   SELECT column_name FROM information_schema.column_privileges
--   WHERE table_schema = 'public' AND table_name = 'agents'
--     AND grantee = 'authenticated' AND privilege_type = 'UPDATE' ORDER BY 1;
-- V3. In the portal: change the name on My Profile, Save, and the sidebar changes at once.
