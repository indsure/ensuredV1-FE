-- 026_entitlement_lockdown.sql
-- Closes escalation E8 in docs/plans/2026-10-26-cashfree-payments.md: a signed-in browser could
-- write its own plan and check balance with the public anon key.
--
--   * individual_profiles had RLS "FOR ALL USING (id = auth.uid())" (002:34-37), so any consumer
--     could run supabase.from('individual_profiles').update({ plan: 'paid' }) and get unlimited
--     policy checks (checkIndividualQuota returns allowed for 'paid', routes.ts ~892).
--   * agents and agent_credits have no policies in any migration (made in the dashboard), so
--     whether an advisor can write agents.plan / agent_credits.balance is unknown from the repo.
--     Run 026_entitlement_lockdown_check.sql on the live DB first.
--
-- What the browser legitimately writes (verified 2026-10-26 by grep of frontend/client/src):
--   individual_profiles  nothing (all writes go through the backend pool, which bypasses RLS)
--   agent_credits        nothing (AgentContext.tsx only reads)
--   agents               name, full_name, phone, phone_number, location, city, firm_name,
--                        partnered_companies (MyProfile.tsx, SettingsNew.tsx, SignupStep2.tsx)
-- Everything else becomes backend-only. The backend (pg pool as postgres, and supabaseAdmin with
-- the service role) and the admin app (service role) are not affected.
--
-- Live check 2026-10-26 (026_entitlement_lockdown_check.sql, run by Deep):
--   RLS on for all five tables. Browser roles hold full INSERT/UPDATE/DELETE grants on all five.
--   individual_profiles: "individuals_own_profile" FOR ALL  -> the hole is REAL on live.
--   agents: write only via "agents_write_policy" (get_my_role() = 'admin'); agent_credits,
--   agent_ocr_credits, teams: SELECT-only policies. So advisors could NOT self-upgrade; the
--   agents/credits/teams part below is defence in depth (and limits even an admin's browser
--   session to the eight profile columns).
--   Applied on live 2026-10-26; V1-V3 verify queries below passed (6 agents columns granted).
--
-- Shared Supabase: this lands on beta AND prod the moment it runs. Idempotent; safe to re-run.
-- Undo: 026_entitlement_lockdown_down.sql.

BEGIN;

-- ─── 1. individual_profiles: read own row only ─────────────────────────────
DROP POLICY IF EXISTS "individuals_own_profile" ON public.individual_profiles;
DROP POLICY IF EXISTS "individuals_read_own_profile" ON public.individual_profiles;
CREATE POLICY "individuals_read_own_profile" ON public.individual_profiles
  FOR SELECT
  USING (id = auth.uid());

-- Belt and braces: even a future permissive policy cannot write through these roles.
REVOKE INSERT, UPDATE, DELETE ON public.individual_profiles FROM anon, authenticated;

-- ─── 2. agent_credits / agent_ocr_credits: browser reads, never writes ─────
-- (agent_ocr_credits already has a SELECT-only policy from 004; the revoke is belt and braces.)
REVOKE INSERT, UPDATE, DELETE ON public.agent_credits FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.agent_ocr_credits FROM anon, authenticated;

-- ─── 3. agents: only the eight profile columns are browser-writable ────────
-- Column grants only narrow what a row policy already allows; they never widen RLS.
REVOKE INSERT, UPDATE, DELETE ON public.agents FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.agents FROM authenticated;
-- Only columns that exist get the grant. The first live run (2026-10-26) failed with
-- "column phone_number of relation agents does not exist": MyProfile.tsx:217 writes
-- phone_number/firm_name, which live does not have (that write already fails silently).
DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY column_name) INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'agents'
    AND column_name = ANY (ARRAY['name', 'full_name', 'phone', 'phone_number', 'location',
                                 'city', 'firm_name', 'partnered_companies']);
  IF cols IS NULL THEN
    RAISE EXCEPTION 'agents has none of the profile columns; stop and check the table';
  END IF;
  EXECUTE format('GRANT UPDATE (%s) ON public.agents TO authenticated', cols);
  RAISE NOTICE 'agents browser-editable columns: %', cols;
END $$;

-- ─── 4. teams: seat count is backend/admin only (017 already has no write policy)
REVOKE INSERT, UPDATE, DELETE ON public.teams FROM anon, authenticated;

COMMIT;

-- ─── Verify (run after) ─────────────────────────────────────────────────────
-- Expect: individual_profiles has one policy, cmd = SELECT.
--   SELECT tablename, policyname, cmd, qual FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'individual_profiles';
-- Expect: no INSERT/UPDATE/DELETE rows for anon or authenticated on these tables.
--   SELECT table_name, grantee, privilege_type FROM information_schema.role_table_grants
--   WHERE table_schema = 'public' AND grantee IN ('anon','authenticated')
--     AND table_name IN ('individual_profiles','agent_credits','agent_ocr_credits','agents','teams')
--     AND privilege_type IN ('INSERT','UPDATE','DELETE');
-- Expect: exactly the eight agents columns with UPDATE for authenticated.
--   SELECT column_name FROM information_schema.column_privileges
--   WHERE table_schema = 'public' AND table_name = 'agents'
--     AND grantee = 'authenticated' AND privilege_type = 'UPDATE' ORDER BY 1;
