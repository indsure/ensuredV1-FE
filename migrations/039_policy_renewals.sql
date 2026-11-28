-- 039_policy_renewals.sql
-- What happened to each renewal on Home: the advisor spoke to the family, it renewed, or it
-- was lost. Plan: docs/plans/2026-11-19-advisor-home.md ("Renewal outcome").
--
-- ADDITIVE ONLY: one new table, no change to any existing table or column. Beta and prod
-- share one Supabase, so this lands on prod the moment it runs. The portal reads it in a
-- side query and keeps working (Outcome column hidden) until it exists.
--
-- One row per advisor, policy and due date. A health or motor policy renews once a year, a
-- life policy may fall due every month; keying on the due date means last year's "renewed"
-- can never mark this year's renewal as done. agent_id is in the key so a policy moved to
-- another advisor starts clean for them instead of colliding with the old advisor's row.
--
-- Access: the browser writes it under RLS, like lead_policies. Rows are the advisor's own AND
-- the policy must still be theirs, on read and on write (a moved policy stops showing the old
-- advisor's outcomes). The clients subquery runs under clients RLS, which is the same
-- auth.uid() = agent_id rule. The Free-plan read-only rule is the portal's assertCrmWritable(),
-- as for Customers, Leads and Renewals.
--
-- Customer data: none beyond a status and a date. Hangs off clients(id) ON DELETE CASCADE,
-- so deleting a policy (or an account) removes its renewal rows.
BEGIN;

-- The FKs take a short lock on clients and agents. Give up rather than queue behind a long
-- transaction on the live database; just run it again.
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.policy_renewals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  client_id   uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  due_date    date NOT NULL,
  status      text NOT NULL CHECK (status IN ('spoken', 'renewed', 'lost')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, client_id, due_date)
);

CREATE INDEX IF NOT EXISTS policy_renewals_agent_due_idx
  ON public.policy_renewals (agent_id, due_date);

-- The server's clock, not the browser's, decides when a row last changed.
CREATE OR REPLACE FUNCTION public.policy_renewals_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' THEN NEW.created_at := now(); END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS policy_renewals_touch ON public.policy_renewals;
CREATE TRIGGER policy_renewals_touch
  BEFORE INSERT OR UPDATE ON public.policy_renewals
  FOR EACH ROW EXECUTE FUNCTION public.policy_renewals_touch();

ALTER TABLE public.policy_renewals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agents_own_policy_renewals" ON public.policy_renewals;
CREATE POLICY "agents_own_policy_renewals" ON public.policy_renewals
  FOR ALL
  TO authenticated
  USING (
    agent_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.agent_id = auth.uid())
  )
  WITH CHECK (
    agent_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.agent_id = auth.uid())
  );

-- Supabase's default privileges hand authenticated ALL (TRUNCATE ignores RLS). Start from
-- nothing and grant only the four row operations.
REVOKE ALL ON public.policy_renewals FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.policy_renewals TO authenticated;
REVOKE ALL ON FUNCTION public.policy_renewals_touch() FROM PUBLIC, anon, authenticated;

COMMIT;
