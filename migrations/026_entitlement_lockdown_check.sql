-- 026_entitlement_lockdown_check.sql
-- READ-ONLY. Run in the Supabase SQL editor BEFORE 026_entitlement_lockdown.sql and paste the
-- results back. Nothing here changes data. Each query says what a bad answer looks like.

-- Q1. Row policies on the money tables.
--     BAD: individual_profiles with cmd = ALL or UPDATE/INSERT; any UPDATE/INSERT/ALL policy on
--     agent_credits or teams; an agents UPDATE/ALL policy (expected: advisors edit their profile,
--     which is why 026 narrows it by column instead of dropping it).
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('individual_profiles', 'agent_credits', 'agent_ocr_credits', 'agents', 'teams')
ORDER BY tablename, cmd;

-- Q2. Is RLS actually on?  BAD: any row with rowsecurity = false.
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('individual_profiles', 'agent_credits', 'agent_ocr_credits', 'agents', 'teams');

-- Q3. Write grants the browser roles hold today (keep this output: it is what the down
--     migration should restore if ever needed).
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
  AND table_name IN ('individual_profiles', 'agent_credits', 'agent_ocr_credits', 'agents', 'teams')
  AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
ORDER BY table_name, grantee, privilege_type;

-- Q4. Has anyone already used the hole? No payment flow exists, so every consumer on 'paid'
--     was either set by us by hand or set themselves.
--     BAD: any row you do not recognise.
SELECT id, email, plan, created_at, updated_at
FROM public.individual_profiles
WHERE plan <> 'free'
ORDER BY updated_at DESC;

-- Q5. Same question for advisors: anyone on a paid plan, or holding more checks than the
--     admin app ever gave out. BAD: a name you did not put on that plan or balance.
SELECT a.id, a.email, a.plan, a.billing_cycle, c.balance, c.total_used
FROM public.agents a
LEFT JOIN public.agent_credits c ON c.agent_id = a.id
WHERE COALESCE(a.plan, 'free') <> 'free' OR COALESCE(c.balance, 0) > 25
ORDER BY c.balance DESC NULLS LAST;
