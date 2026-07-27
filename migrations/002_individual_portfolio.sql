-- ============================================================================
-- 002_individual_portfolio.sql
-- D2C "My Portfolio": individuals (not agents) sign up, analyze their own
-- policies, and keep a personal insurance portfolio.
--
-- Two tables, both keyed to the Supabase auth user (auth.uid()):
--   individual_profiles  — one row per consumer account (plan + trial clock)
--   individual_policies  — the consumer's uploaded/analyzed policies
--
-- Backend writes via the service-role pool (bypasses RLS). RLS below is
-- defense-in-depth for any direct client-SDK access: a user can only ever
-- see their own rows.
--
-- Run in the Supabase SQL editor or via run_migrations.mjs.
-- ============================================================================

-- ─── 1. individual_profiles ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.individual_profiles (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name         TEXT,
  email             TEXT,
  phone             TEXT,
  -- 'free' | 'paid'. Only 'paid' lifts the per-type slot cap and the trial gate.
  plan              TEXT NOT NULL DEFAULT 'free',
  -- 30-day full-access clock starts on first bootstrap (signup / first login).
  trial_started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  marketing_consent BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.individual_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "individuals_own_profile" ON public.individual_profiles;
CREATE POLICY "individuals_own_profile" ON public.individual_profiles
  FOR ALL
  USING (id = auth.uid());

-- ─── 2. individual_policies ────────────────────────────────────────────────
-- Column shape mirrors what the agent analyze pipeline writes to `clients`
-- (routes.ts ~2278-2476), scoped to a consumer user_id instead of agent_id.
CREATE TABLE IF NOT EXISTS public.individual_policies (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.individual_profiles(id) ON DELETE CASCADE,
  -- Links the background analysis job to this policy row (status polling).
  job_id            UUID,
  insurance_type    TEXT NOT NULL DEFAULT 'health',
  status            TEXT NOT NULL DEFAULT 'pending',   -- pending | processing | done | error
  filename          TEXT,
  file_size         BIGINT,
  pdf_url           TEXT,
  report_data       JSONB,        -- full forensic report (health scoring lane)
  extracted_data    JSONB,        -- structured fields (OCR/data-entry lane)
  score             INTEGER,
  insurer           TEXT,
  policy_name       TEXT,
  -- TEXT (not DATE/NUMERIC): the analysis pipeline emits free-form values;
  -- mirrors how the agent `clients` path stores them without parse failures.
  expiry_date       TEXT,
  sum_insured       TEXT,
  flaws             JSONB,
  policyholder_name TEXT,
  error_message     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_individual_policies_user      ON public.individual_policies(user_id);
CREATE INDEX IF NOT EXISTS idx_individual_policies_job       ON public.individual_policies(job_id);
CREATE INDEX IF NOT EXISTS idx_individual_policies_user_type ON public.individual_policies(user_id, insurance_type);

ALTER TABLE public.individual_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "individuals_own_policies" ON public.individual_policies;
CREATE POLICY "individuals_own_policies" ON public.individual_policies
  FOR ALL
  USING (user_id = auth.uid());

-- ─── 3. Retention note ─────────────────────────────────────────────────────
-- individual_policies holds consumer PII (their own policy documents). It is
-- subject to the same lifecycle-aware DPDP retention as agent client data.
-- created_at/updated_at above give the retention sweep the timestamps it needs;
-- wire this table into the existing retention job (see project retention SQL).
