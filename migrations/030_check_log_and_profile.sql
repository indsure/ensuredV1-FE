-- 030: consumer check log + advisor firm name + grievance table.
-- Run in Supabase SQL editor BEFORE deploying the new backend (the new code reads
-- individual_check_log on every consumer upload). Safe to run twice.

-- 1. Consumer checks RUN, so deleting a policy no longer gives a free check back.
--    Server-only: RLS on with no policies, and no grants to the browser roles.
CREATE TABLE IF NOT EXISTS public.individual_check_log (
  id             bigserial PRIMARY KEY,
  user_id        uuid NOT NULL REFERENCES public.individual_profiles(id) ON DELETE CASCADE,
  insurance_type text NOT NULL,
  policy_id      uuid,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS individual_check_log_user_time
  ON public.individual_check_log (user_id, created_at DESC);
ALTER TABLE public.individual_check_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.individual_check_log FROM anon, authenticated;

-- Count the last year's existing checks, so nobody starts with a fresh allowance.
INSERT INTO public.individual_check_log (user_id, insurance_type, policy_id, created_at)
SELECT p.user_id, p.insurance_type, p.id, p.created_at
  FROM public.individual_policies p
 WHERE p.status <> 'error'
   AND p.created_at > now() - interval '365 days'
   AND p.user_id IN (SELECT id FROM public.individual_profiles)
   AND NOT EXISTS (SELECT 1 FROM public.individual_check_log l WHERE l.policy_id = p.id);

-- 2. My Profile "Firm / Company" said "Profile updated" but had no column to save into.
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS firm_name text;
-- Advisors update their own row from the browser through a column GRANT list (026/027).
GRANT UPDATE (firm_name) ON public.agents TO authenticated;

-- 3. grievance_requests was only ever created by hand; a rebuild from migrations/
--    would bring back the grievance form's 500. No-op where it exists.
CREATE TABLE IF NOT EXISTS public.grievance_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  email        text NOT NULL,
  phone        text,
  request_type text NOT NULL,
  details      text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.grievance_requests ENABLE ROW LEVEL SECURITY;

-- Check:
--   SELECT count(*) FROM individual_check_log;
--   SELECT column_name FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'firm_name';
