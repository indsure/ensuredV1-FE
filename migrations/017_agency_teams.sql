-- ============================================================================
-- 017_agency_teams.sql
-- Agency teams: an owner buys seats, invites advisors by email, and can READ
-- what their team has built — without being able to change or destroy any of it.
--
-- WHAT THIS FILE DELIBERATELY DOES NOT DO: it does not widen a single existing
-- RLS policy. Every agent table still reads exactly one way — `auth.uid() =
-- agent_id`, nobody sees anyone else — and this migration leaves all of them
-- untouched.
--
-- The owner's read of their team's book is served ENTIRELY by the backend
-- (`teamRoutes.ts`), which queries through the service-role pool and therefore
-- never consults RLS. That choice was made over the obvious alternative — an
-- additive `FOR SELECT ... USING (is_team_owner_of(agent_id))` on each table —
-- for three reasons, and they are worth keeping in mind before anyone "simplifies"
-- this by adding those policies later:
--
--   1. THE AUDIT WOULD BE A FICTION. We promise the advisor, on the invite screen
--      and in their portal, that they see every time their owner opens their book.
--      A widened policy is exercised by the browser's anon key, so an owner could
--      read every row through supabase-js and write nothing to team_access_log.
--      An endpoint cannot be bypassed that way: no endpoint, no data, and every
--      endpoint writes the log row as it serves.
--   2. RLS IS ROW-LEVEL, AND TWO EXCLUSIONS HERE ARE COLUMN-LEVEL. The owner may
--      read a policy's analysis but NOT `clients.pdf_url` (the raw uploaded PDF),
--      and may read a claim but NOT its documents. A policy that returns the row
--      returns the whole row; a hand-written SELECT list does not.
--   3. BLAST RADIUS. Widening nine tables means nine chances to get a USING clause
--      subtly wrong on data belonging to people who never consented to a second
--      reader. Zero policies changed is zero chances.
--
-- So the only privilege this migration grants is membership itself.
--
-- WHY OWNERSHIP IS NOT `agents.role`: `get_my_role()` is
-- `SELECT role FROM agents WHERE id = auth.uid()`, and `agents_read_policy`
-- already grants elevated read to 'manager' and 'admin'. Putting 'owner' in the
-- same column would put team ownership one typo away from a privilege tier.
-- Ownership lives in `teams.owner_id` and nowhere else.
--
-- Additive + idempotent. No existing table, column or policy is altered.
-- Run in the Supabase SQL editor or via a runner.
-- ============================================================================

-- ─── 1. teams ──────────────────────────────────────────────────────────────
-- Provisioned by an admin, never self-serve: the Agency tier has a 5-seat
-- minimum, dedicated onboarding and no self-serve billing (see the note in
-- 004_agent_ocr_allowance.sql), so nobody can conjure paid seats from the portal.
-- `seats` is the ceiling the invite path enforces; it is only ever set by admin.
CREATE TABLE IF NOT EXISTS public.teams (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  owner_id    uuid NOT NULL REFERENCES public.agents(id) ON DELETE RESTRICT,
  seats       integer NOT NULL DEFAULT 5 CHECK (seats >= 1),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.teams IS
  'An agency. Admin-provisioned. owner_id is the single source of truth for team ownership — never agents.role.';
COMMENT ON COLUMN public.teams.seats IS
  'Paid seat ceiling. Members + pending invites may not exceed it. Admin-set only.';

-- ON DELETE RESTRICT on owner_id is deliberate: deleting an agent who still owns
-- a team should fail loudly rather than silently orphan every advisor under them.
CREATE INDEX IF NOT EXISTS teams_owner_idx ON public.teams (owner_id);

-- ─── 2. Team membership on the agent ───────────────────────────────────────
-- One agent belongs to at most one team. NULL — the default and the state of
-- every one of today's agents — means "not in a team", and every existing
-- policy keeps behaving exactly as it does now.
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS agents_team_idx ON public.agents (team_id) WHERE team_id IS NOT NULL;

COMMENT ON COLUMN public.agents.team_id IS
  'Agency membership. NULL = solo agent (the default). Cleared, never deleted, when an owner removes someone.';

-- ─── 3. team_invites ───────────────────────────────────────────────────────
-- Email-bound, single-use, expiring (founder decision, 2026-08-25). The raw
-- token exists in exactly one place — the email we send — and only its SHA-256
-- is stored, so a database read cannot redeem an invite.
--
-- Not built on `invite_codes`: that table is readable AND updatable by any
-- authenticated user (`Authenticated can read invite codes`, USING (true)),
-- which is survivable for a signup gate and not survivable for something that
-- grants an owner read access to a book. This table is backend-only.
CREATE TABLE IF NOT EXISTS public.team_invites (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,

  -- Matched case-insensitively on redemption (no citext in this database).
  email        text NOT NULL,
  invited_name text,

  -- SHA-256 of the token, hex. Never the token itself.
  token_hash   text NOT NULL UNIQUE,

  -- A single-use row in `invite_codes`, minted with this invite.
  --
  -- Agent signup REQUIRES an invite code (SignupStep1.tsx) and a team invitee
  -- has no reason to possess one, so the invite carries its own. This keeps the
  -- product on ONE signup path rather than opening a second, less-guarded door
  -- into agent account creation for the sake of teams.
  signup_code  text,

  invited_by   uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,

  -- 'expired' is written lazily by the redeem path when a pending invite is
  -- past expires_at; there is no sweeper, because an unredeemed invite is inert.
  status       text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),

  expires_at   timestamptz NOT NULL,
  accepted_by  uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  accepted_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- One live invite per address per team. Partial, so a revoked or expired invite
-- does not block re-inviting the same person.
CREATE UNIQUE INDEX IF NOT EXISTS team_invites_one_pending_per_email
  ON public.team_invites (team_id, lower(email))
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS team_invites_team_idx ON public.team_invites (team_id, status);

COMMENT ON TABLE public.team_invites IS
  'Email-bound single-use team invites. Backend-only (service role): RLS denies all direct client access. Only the SHA-256 of the token is stored.';

-- ─── 4. team_access_log ────────────────────────────────────────────────────
-- Every owner read of a member's data, written by the backend at the moment it
-- serves that data. This is what makes "your team owner can see when they open
-- your book" a true sentence rather than a comforting one.
CREATE TABLE IF NOT EXISTS public.team_access_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  owner_id   uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  member_id  uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,

  -- What was opened: 'overview' | 'policies' | 'policy' | 'customers'
  -- | 'customer' | 'leads' | 'claims' | 'claim' | 'calculator'
  surface    text NOT NULL,
  entity_id  uuid,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS team_access_log_member_idx
  ON public.team_access_log (member_id, created_at DESC);

COMMENT ON TABLE public.team_access_log IS
  'Audit of team-owner reads. Written by the backend on every widened read; the advisor reads their own rows.';

-- ─── 5. RLS on the new tables ──────────────────────────────────────────────

-- teams: a member may read the team they are in (the portal shows its name and
-- seat count). Writes are admin/backend only — no policy grants them here.
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_read_own_team" ON public.teams;
CREATE POLICY "members_read_own_team" ON public.teams
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR id = (SELECT team_id FROM public.agents WHERE id = auth.uid())
  );

-- team_invites: backend only. An invite is a bearer grant; nothing about it is
-- safe to expose to the client SDK, including its existence.
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "no_direct_client_access" ON public.team_invites;
CREATE POLICY "no_direct_client_access" ON public.team_invites
  FOR ALL
  USING (false);

-- team_access_log: the advisor reads the rows ABOUT THEM — that is the whole
-- point of the table. The owner may read their own reads. Nobody writes from
-- the client; the backend writes as it serves.
ALTER TABLE public.team_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "member_reads_own_access_log" ON public.team_access_log;
CREATE POLICY "member_reads_own_access_log" ON public.team_access_log
  FOR SELECT TO authenticated
  USING (member_id = auth.uid() OR owner_id = auth.uid());

-- ─── 6. Sanity check after running ─────────────────────────────────────────
-- The point of these three is to prove this migration took NOTHING away from
-- the existing per-agent isolation.
--
--   -- 1. No policy anywhere mentions teams except on the three new tables.
--   SELECT tablename, policyname, cmd FROM pg_policies
--    WHERE schemaname='public' AND qual ILIKE '%team%' ORDER BY tablename;
--   -- expect ONLY: teams, team_access_log, team_invites
--
--   -- 2. The agent tables still read exactly one way.
--   SELECT tablename, policyname, qual FROM pg_policies
--    WHERE schemaname='public'
--      AND tablename IN ('clients','customers','agent_leads','lead_policies',
--                        'calculator_reports','claims','claim_queries',
--                        'claim_events','claim_documents')
--    ORDER BY tablename;
--   -- expect every qual to be (auth.uid() = agent_id) and nothing else
--
--   -- 3. An invite is invisible to the client SDK.
--   SELECT policyname, qual FROM pg_policies
--    WHERE schemaname='public' AND tablename='team_invites';
--   -- expect exactly one row, qual = false
