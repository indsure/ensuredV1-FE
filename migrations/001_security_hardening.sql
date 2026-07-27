-- Security hardening migration
-- Run this in Supabase SQL editor or via psql

-- ─── 1. marketing_consent column on agents ────────────────────────────────
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN NOT NULL DEFAULT false;

-- ─── 2. RLS on notifications ──────────────────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Agents can only see their own notifications
CREATE POLICY "agents_own_notifications" ON public.notifications
  FOR ALL
  USING (agent_id = auth.uid());

-- ─── 3. RLS on public_reports ─────────────────────────────────────────────
ALTER TABLE public.public_reports ENABLE ROW LEVEL SECURITY;

-- Agents can only read/write their own public reports
CREATE POLICY "agents_own_public_reports" ON public.public_reports
  FOR ALL
  USING (agent_id = auth.uid());

-- Anyone can read an active public report (for shared report links)
CREATE POLICY "public_read_active_reports" ON public.public_reports
  FOR SELECT
  USING (is_active = true);

-- ─── 4. RLS on agent_signup_requests ──────────────────────────────────────
-- This table is managed by the backend service role only.
-- No anon or authenticated user should read it directly via the client SDK.
ALTER TABLE public.agent_signup_requests ENABLE ROW LEVEL SECURITY;

-- Only the service role (backend) can access this table — deny all anon/authed direct access
CREATE POLICY "no_direct_client_access" ON public.agent_signup_requests
  FOR ALL
  USING (false);

-- ─── 5. RLS on email_notifications ───────────────────────────────────────
ALTER TABLE public.email_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "no_direct_client_access" ON public.email_notifications
  FOR ALL
  USING (false);
