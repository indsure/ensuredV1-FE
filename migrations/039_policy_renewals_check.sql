-- Read-only checks after running 039. Each one says what to expect.

-- 1. The table exists and is empty. Expect: 0
SELECT count(*) AS rows FROM public.policy_renewals;

-- 2. RLS is on. Expect: true
SELECT relrowsecurity FROM pg_class WHERE oid = 'public.policy_renewals'::regclass;

-- 3. Exactly one policy, for authenticated, and BOTH sides check the policy is the advisor's own.
-- Expect one row: agents_own_policy_renewals | ALL | {authenticated}
--   qual and with_check both contain "agent_id = auth.uid()" AND "EXISTS ( SELECT 1 FROM clients c"
SELECT policyname, cmd, roles, qual, with_check FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'policy_renewals';

-- 4. Grants. Expect exactly: authenticated DELETE, INSERT, SELECT, UPDATE (4 rows), nothing for anon.
SELECT grantee, privilege_type FROM information_schema.role_table_grants
 WHERE table_schema = 'public' AND table_name = 'policy_renewals' AND grantee IN ('anon', 'authenticated')
 ORDER BY grantee, privilege_type;

-- 5. The touch trigger is in place. Expect: policy_renewals_touch
SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.policy_renewals'::regclass AND NOT tgisinternal;
