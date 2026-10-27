-- 029_close_public_reads.sql
-- Closes two holes the 2026-10-27 go-live audit found in browser (anon key) access.
--
-- 1. public_reports: "public_read_active_reports" (001) let ANYONE holding the public anon key
--    run `select * from public_reports` and read every active switch report in full, with the
--    agent_id and client_id of each. Nothing in the browser reads this table: the share page
--    goes through the backend (/api/public-report/:uuid), which uses its own DB role and is
--    not affected by this policy. Agents keep "agents_own_public_reports" for their own rows.
--
-- 2. individual_policies: "individuals_own_policies" (002) is FOR ALL, so a consumer could
--    UPDATE their own rows from the browser: set status = 'error' (which frees quota slots)
--    or point pdf_url at someone else's file. Nothing in the browser writes this table; every
--    consumer edit (nickname, renewal date, reminders, delete) goes through /api/me/*. This
--    leaves consumers read access to their own rows and removes browser writes.
--
-- 3. invite_codes: any signed-in browser could UPDATE any code (017 notes the table is
--    "readable AND updatable by any authenticated user"), so a spent code could be switched
--    back on and advisor signup reopened. The backend now spends the code itself inside
--    /api/agent/create-profile, and the admin app writes with the service role, so no
--    browser write is needed. Reads stay, because the signup page checks a code as it is typed.
--
-- Shared Supabase: this lands on beta AND prod the moment it runs. Idempotent; safe to re-run.
-- Undo: 029_close_public_reads_down.sql.

BEGIN;

DROP POLICY IF EXISTS "public_read_active_reports" ON public.public_reports;

DROP POLICY IF EXISTS "individuals_own_policies" ON public.individual_policies;
DROP POLICY IF EXISTS "individuals_read_own_policies" ON public.individual_policies;
CREATE POLICY "individuals_read_own_policies" ON public.individual_policies
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE ON public.individual_policies FROM anon, authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.invite_codes FROM anon, authenticated;

COMMIT;

-- Check (read-only), expect no row named public_read_active_reports or individuals_own_policies:
--   SELECT tablename, policyname, cmd, roles FROM pg_policies
--    WHERE tablename IN ('public_reports', 'individual_policies');
-- and expect only SELECT for anon/authenticated on invite_codes:
--   SELECT grantee, privilege_type FROM information_schema.role_table_grants
--    WHERE table_name = 'invite_codes' AND grantee IN ('anon', 'authenticated');
