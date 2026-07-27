-- ============================================================================
-- 005_portfolio_upgrade.sql
-- Consumer portfolio upgrade: renewal reminders, a real renewal date the user
-- can confirm, download tracking, and a consented "connect me to an agent" flow.
--
-- Additive + idempotent. Safe to run against the live DB more than once.
-- Run in the Supabase SQL editor or via run_migrations.mjs.
-- ============================================================================

-- ─── 1. Renewal reminders opt-in (account level) ───────────────────────────
-- Default ON: people who upload a policy generally WANT to be told before it
-- lapses. The toggle in the portfolio lets them turn it off.
ALTER TABLE public.individual_profiles
  ADD COLUMN IF NOT EXISTS renewal_reminders_enabled BOOLEAN NOT NULL DEFAULT true;

-- ─── 2. A trustworthy renewal date + send-once guard (policy level) ─────────
-- expiry_date is free-form OCR TEXT and unreliable; renewal_date is a real DATE
-- the user can confirm/edit, and the daily reminder job keys off it.
-- reminder_sent_at stops us emailing the same upcoming renewal twice.
ALTER TABLE public.individual_policies
  ADD COLUMN IF NOT EXISTS renewal_date    DATE,
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

-- The reminder job scans by renewal_date; index it.
CREATE INDEX IF NOT EXISTS idx_individual_policies_renewal
  ON public.individual_policies(renewal_date)
  WHERE renewal_date IS NOT NULL;

-- ─── 3. Consented "connect me to an agent" requests ────────────────────────
-- A consumer explicitly asks to be contacted by a licensed advisor. This is the
-- ONLY place a signed-in consumer is ever lead-captured, and only with an
-- explicit consent checkbox they tick themselves.
CREATE TABLE IF NOT EXISTS public.agent_connect_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.individual_profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL,
  email       TEXT,
  -- What they want help with (e.g. "renew", "new-cover", "claim", "review").
  topic       TEXT,
  message     TEXT,
  -- Recorded proof the consumer agreed to be contacted / to have this stored.
  consent     BOOLEAN NOT NULL DEFAULT false,
  -- new | contacted | closed — worked by the team, not the consumer.
  status      TEXT NOT NULL DEFAULT 'new',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_connect_requests_user
  ON public.agent_connect_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_connect_requests_status
  ON public.agent_connect_requests(status);

ALTER TABLE public.agent_connect_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "individuals_own_connect_requests" ON public.agent_connect_requests;
CREATE POLICY "individuals_own_connect_requests" ON public.agent_connect_requests
  FOR ALL
  USING (user_id = auth.uid());
