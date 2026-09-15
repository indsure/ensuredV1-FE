-- ============================================================================
-- 018_enterprise_signup.sql
-- Agent signup asks whether the person is a solo advisor or an agency, and an
-- agency's answer has to go SOMEWHERE. This is that somewhere.
--
-- WHY A REQUEST AND NOT A TEAM: picking "Enterprise" on a signup form does not
-- create a team. The Agency tier has a five-seat minimum, dedicated onboarding
-- and no self-serve billing (004_agent_ocr_allowance.sql), so a form that
-- minted teams would hand out paid seats to anyone who ticked a box. The signup
-- captures the ASK; an admin provisions the team against it.
--
-- Until that happens the person is an ordinary advisor with an ordinary
-- account: nothing about their signup is left half-finished, and nothing they
-- do is blocked. The only difference is that we know to call them.
--
-- Additive + idempotent. Depends on 017 (teams).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.team_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- One live request per advisor. Enforced by the partial index below rather
  -- than a plain UNIQUE, so a declined request does not block asking again.
  agent_id      uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,

  agency_name   text NOT NULL,

  -- What they asked for, not what they get. The seat count that bills is
  -- teams.seats, set by whoever provisions — this column never becomes a
  -- promise, and the signup copy is careful not to read like a quote.
  seats_wanted  integer CHECK (seats_wanted IS NULL OR seats_wanted >= 1),

  contact_phone text,
  note          text,

  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'provisioned', 'declined')),

  -- Filled in when an admin provisions, so the request row keeps a pointer to
  -- what came of it. ON DELETE SET NULL: deleting a team must not erase the
  -- record that someone once asked for one.
  team_id       uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  handled_by    uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  handled_at    timestamptz,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS team_requests_one_pending_per_agent
  ON public.team_requests (agent_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS team_requests_status_idx
  ON public.team_requests (status, created_at DESC);

COMMENT ON TABLE public.team_requests IS
  'An advisor said "agency" at signup. Captures the ask; an admin provisions the team. Never grants a seat by itself.';
COMMENT ON COLUMN public.team_requests.seats_wanted IS
  'What was asked for. The number that bills is teams.seats, set at provisioning time.';

-- ─── RLS ───────────────────────────────────────────────────────────────────
-- The advisor may read their own request — the portal tells them it is being
-- set up, and that sentence needs a source. Writes are backend-only: the
-- signup path inserts through the service role after verifying the auth user,
-- and provisioning is an admin action.
ALTER TABLE public.team_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agents_read_own_team_request" ON public.team_requests;
CREATE POLICY "agents_read_own_team_request" ON public.team_requests
  FOR SELECT TO authenticated
  USING (agent_id = auth.uid());

-- ─── Sanity check after running ────────────────────────────────────────────
--   SELECT policyname, cmd, qual FROM pg_policies
--    WHERE schemaname='public' AND tablename='team_requests';
--   -- expect exactly one row: SELECT, (agent_id = auth.uid())
--
--   -- and, as in 017, no existing table gained a second reader:
--   SELECT count(*) FROM pg_policies
--    WHERE schemaname='public' AND qual ILIKE '%team%'
--      AND tablename NOT IN ('teams','team_invites','team_access_log','team_requests');
--   -- expect 0
