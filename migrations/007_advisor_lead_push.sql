-- 007_advisor_lead_push.sql
-- Links an advisor request to the agent_leads row it was pushed into, so the
-- admin dashboard can move it (on re-assign) or remove it (on un-assign) without
-- creating duplicates in an agent's pipeline.
--
-- When the founder assigns an advisor request to an agent, the admin tool inserts
-- a row into agent_leads (stamped with that agent_id, via the service-role key)
-- so it surfaces in that agent's /agent/leads. pushed_lead_id remembers which row.
--
-- Additive and nullable — safe to run live, no impact on existing rows.

ALTER TABLE public.agent_connect_requests
  ADD COLUMN IF NOT EXISTS pushed_lead_id UUID
    REFERENCES public.agent_leads(id) ON DELETE SET NULL;
