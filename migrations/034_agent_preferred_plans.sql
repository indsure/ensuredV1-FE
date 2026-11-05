-- 034: an advisor's preferred list of catalogue health plans.
--
-- "Compare Plans With This Coverage" on a calculator report ranks catalogue plans by
-- completeness (backend/server/services/planCompleteness.ts). Founder decision 2026-11-03:
-- consumers see the top 3 of the whole catalogue; an advisor's picks come from the plans that
-- advisor works with. This table is that list. plan_key matches policy_catalog.plan_key
-- (uin, or uin:variant), and is not a foreign key because catalogue rows are retired and
-- revived by the loader, and an advisor's list should survive a reload.
--
-- The backend reads and writes it with the service role. RLS is on with advisor-own rules in
-- case the portal ever reads it directly. Deleting the advisor deletes the list (CASCADE),
-- and AGENT_TABLES in backend/server/services/accountData.ts exports and deletes it.
--
-- Run BEFORE deploying the backend that reads it. Idempotent. Undo: 034_agent_preferred_plans_down.sql.

CREATE TABLE IF NOT EXISTS public.agent_preferred_plans (
  agent_id   uuid        NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  plan_key   text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (agent_id, plan_key)
);

ALTER TABLE public.agent_preferred_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agents_own_preferred_plans ON public.agent_preferred_plans;
CREATE POLICY agents_own_preferred_plans ON public.agent_preferred_plans
  FOR ALL USING (auth.uid() = agent_id) WITH CHECK (auth.uid() = agent_id);

-- Check:
--   SELECT count(*) FROM public.agent_preferred_plans;   -> 0
--   SELECT policyname FROM pg_policies WHERE tablename = 'agent_preferred_plans';
--   -> agents_own_preferred_plans
