-- 006_lead_allocation.sql
-- Adds founder-side allocation to consumer advisor requests.
--
-- "Talk to an advisor" submissions land in agent_connect_requests (migration 005)
-- with status = 'new' and nobody assigned. This lets the local admin dashboard
-- tag which agent should handle each lead. Purely additive and nullable, so it is
-- safe to run against the live database with zero impact on existing rows or the
-- consumer-facing flow.

ALTER TABLE public.agent_connect_requests
  ADD COLUMN IF NOT EXISTS assigned_agent_id UUID
    REFERENCES public.agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

-- Fast lookup of everything allocated to a given agent.
CREATE INDEX IF NOT EXISTS idx_agent_connect_requests_assigned
  ON public.agent_connect_requests(assigned_agent_id);

-- No new RLS policy needed: the admin dashboard reads/writes with the Supabase
-- service-role key, which bypasses row-level security. The existing
-- "individuals_own_connect_requests" policy still limits consumers to their own rows.
