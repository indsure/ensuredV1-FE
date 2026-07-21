-- ============================================================================
-- 004_agent_ocr_allowance.sql
-- Meter the agent OCR / data-entry lanes (motor / life / term / travel /
-- property). These lanes run a paid Gemini OCR call but were previously
-- unlimited-free — a cost leak. They are now drawn from a per-agent balance,
-- refilled monthly by plan + billing cycle (see refillOcrAllowance in
-- backend/server/index.ts):
--
--   free            → flat 20, lifetime (never refilled)
--   agent / monthly → reset to 50 each month (no carryover)
--   agent / annual  → +50 each month, capped at 600 (carryover); the bank is
--                     wiped back to 50 in the agent's signup-anniversary month
--   agency          → treated like agent / annual, per seat
--
-- Additive + idempotent. Run in the Supabase SQL editor or via a runner.
-- ============================================================================

-- ─── 1. Plan + billing cycle on the agent ──────────────────────────────────
-- Admin-set today (no self-serve billing yet), same manual model as credits.
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free';          -- 'free' | 'agent' | 'agency'
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT NOT NULL DEFAULT 'monthly'; -- 'monthly' | 'annual'

-- ─── 2. OCR allowance balance (mirrors agent_credits) ──────────────────────
CREATE TABLE IF NOT EXISTS public.agent_ocr_credits (
  agent_id    UUID PRIMARY KEY REFERENCES public.agents(id) ON DELETE CASCADE,
  balance     INTEGER NOT NULL DEFAULT 0,
  total_used  INTEGER NOT NULL DEFAULT 0,
  -- Calendar month the current balance belongs to ('YYYY-MM'). The refill job
  -- only touches a row whose period differs from the current month, so it is
  -- safe to run on a coarse interval. NULL for free rows (never refilled).
  period      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 3. RLS: an agent may read (only) their own allowance row ───────────────
-- Backend writes via the service-role pool (bypasses RLS). The agent portal
-- reads the balance directly through supabase-js, so it needs a SELECT policy,
-- mirroring agent_credits.
ALTER TABLE public.agent_ocr_credits ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY agent_ocr_credits_select_own
    ON public.agent_ocr_credits FOR SELECT
    USING (auth.uid() = agent_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
