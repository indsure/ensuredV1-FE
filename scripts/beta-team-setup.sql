-- ============================================================================
-- Beta setup — agency teams. One-off, 2026-08-25.
--
-- Paste this whole file into the Supabase SQL editor and Run. It is:
--   • idempotent — safe to run twice; it will not create a second team
--   • additive — no existing table, column or RLS policy is altered
--
-- It does four things:
--   1. migration 017 — teams, team_invites, team_access_log, agents.team_id
--   2. migration 018 — team_requests (the "I'm an agency" answer at signup)
--   3. is_admin on the admin account, so the admin panel opens at all
--   4. a team for deep@msalphacapital.com, 6 seats
--
-- To undo 3 and 4:
--   UPDATE agents SET is_admin = false WHERE email = 'deepshah399@gmail.com';
--   UPDATE agents SET team_id = NULL, plan = 'free' WHERE email = 'deep@msalphacapital.com';
--   DELETE FROM teams WHERE name = 'MS Alpha Capital';
-- ============================================================================

-- ─── 1. migration 017 ──────────────────────────────────────────────────────
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

-- ─── 2. migration 018 ──────────────────────────────────────────────────────
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

-- ─── 3. Open the admin panel ───────────────────────────────────────────────
-- Both the panel's gate and every /api/admin/* route check `is_admin`, which is
-- currently false on every account — including this one, whose `role` is
-- 'admin'. They are different columns; only is_admin is checked.
UPDATE agents SET is_admin = true WHERE lower(email) = lower('deepshah399@gmail.com');

-- ─── 4. The founder's own team ─────────────────────────────────────────────
-- Guarded so a second run is a no-op rather than a second team.
INSERT INTO teams (name, owner_id, seats)
SELECT 'MS Alpha Capital', a.id, 6
  FROM agents a
 WHERE lower(a.email) = lower('deep@msalphacapital.com')
   AND NOT EXISTS (SELECT 1 FROM teams t WHERE t.owner_id = a.id);

UPDATE agents a
   SET team_id = t.id, plan = 'agency', updated_at = now()
  FROM teams t
 WHERE t.owner_id = a.id
   AND lower(a.email) = lower('deep@msalphacapital.com');

-- Seed the month's checks without overwriting a balance already there.
INSERT INTO agent_credits (agent_id, balance)
SELECT id, 10 FROM agents WHERE lower(email) = lower('deep@msalphacapital.com')
ON CONFLICT (agent_id) DO NOTHING;

-- ─── What you should see ───────────────────────────────────────────────────
SELECT a.email, a.plan, a.is_admin, t.name AS team, t.seats,
       (t.owner_id = a.id) AS is_owner, COALESCE(cr.balance, 0) AS checks
  FROM agents a
  LEFT JOIN teams t ON t.id = a.team_id
  LEFT JOIN agent_credits cr ON cr.agent_id = a.id
 WHERE lower(a.email) IN ('deep@msalphacapital.com', 'deepshah399@gmail.com');
