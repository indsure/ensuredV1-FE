-- ═══════════════════════════════════════════════════════════════════════════
-- 010_schema_naming_cleanup.sql          2026-08-14
--
-- Removes 13 abandoned tables and fixes the two naming collisions that have
-- actually cost debugging time:
--
--   1. "leads" vs "agent_leads" — two live tables, one word. "leads" is
--      website inbound (admin-only); "agent_leads" is the agent CRM feature.
--   2. "advisor_page_views" vs "agent_pages" — migration 008 created both
--      halves of one feature under two different vocabularies. Everything
--      else in this schema is agent_*.
--
-- NOT touched here (deliberate):
--   • clients        — holds policy analyses, not people. Correct name is
--                      policy_analyses, but ~50 call sites + RLS make a hard
--                      rename disproportionate. A view is added below instead.
--   • policies, reports, report_shares, public_reports — empty, but still
--     queried by live code. Dropping them turns "returns nothing" into
--     "throws". Fix the queries first (separate patch), then drop.
--
-- Every DROP below was verified: contents inspected, no inbound FK except the
-- one noted, no views, no live code references.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. Drop abandoned tables ─────────────────────────────────────────────
-- Genuinely empty (0 rows) and referenced nowhere outside archived setup
-- scripts and docs/archive/.

DROP TABLE IF EXISTS public.agent_preferences;
DROP TABLE IF EXISTS public.agent_signup_requests;
DROP TABLE IF EXISTS public.audit_logs;          -- superseded by access_audit_log
DROP TABLE IF EXISTS public.credit_packages;
DROP TABLE IF EXISTS public.policy_files;
DROP TABLE IF EXISTS public.policy_report_leads; -- superseded by leads/marketing_leads
DROP TABLE IF EXISTS public.quote_comparisons;   -- superseded by comparison_reports

-- CASCADE drops exactly one dependent object: reports_analysis_job_id_fkey,
-- an FK constraint on the (empty) reports table. The reports table survives.
DROP TABLE IF EXISTS public.public_analysis_jobs CASCADE;

-- Contained only April-2026 test data. Dropped in FK order:
-- credit_transactions and policy_analysis_jobs both reference agent_policies.
DROP TABLE IF EXISTS public.credit_transactions;   -- 0 rows
DROP TABLE IF EXISTS public.policy_analysis_jobs;  -- 5 rows, all FK'd to test policies
DROP TABLE IF EXISTS public.agent_policies;        -- 5 rows: "Test Policy 0/1/2", "bad policy"
DROP TABLE IF EXISTS public.checker_jobs;          -- 2 rows, epoch-string timestamps
DROP TABLE IF EXISTS public.email_notifications;   -- 1 row, unsent localhost:3000 test mail

-- ─── 2. leads → marketing_leads ───────────────────────────────────────────
-- RLS policies follow the table automatically; indexes do not.

ALTER TABLE public.leads RENAME TO marketing_leads;

ALTER INDEX public.leads_pkey            RENAME TO marketing_leads_pkey;
ALTER INDEX public.idx_leads_created_at  RENAME TO idx_marketing_leads_created_at;
ALTER INDEX public.idx_leads_status      RENAME TO idx_marketing_leads_status;
ALTER INDEX public.idx_leads_email       RENAME TO idx_marketing_leads_email;

COMMENT ON TABLE public.marketing_leads IS
  'Inbound leads from the public website (source=policy_report etc). Admin-only. '
  'NOT the agent CRM — that is agent_leads.';

-- Backward-compatibility shim so the currently-deployed EC2 backend keeps
-- working until it is redeployed. Simple views are auto-updatable in Postgres,
-- so the INSERT at routes.ts:3863 still succeeds through this.
-- security_invoker keeps RLS evaluating as the calling role, not the owner.
-- DROP THIS once the backend deploy has landed.
CREATE OR REPLACE VIEW public.leads WITH (security_invoker = true) AS
  SELECT * FROM public.marketing_leads;

COMMENT ON VIEW public.leads IS
  'DEPRECATED compat shim for migration 010. Drop after backend redeploy.';

-- ─── 3. advisor_page_views → agent_page_views ─────────────────────────────
-- No compat view here: the caller uses INSERT ... ON CONFLICT DO UPDATE, which
-- auto-updatable views do not support. The write is already wrapped in a
-- try/catch that only warns (routes.ts:4063), so between this migration and the
-- backend deploy, view counting no-ops silently and visitors are unaffected.

ALTER TABLE public.advisor_page_views RENAME TO agent_page_views;
ALTER INDEX public.advisor_page_views_pkey RENAME TO agent_page_views_pkey;

COMMENT ON TABLE public.agent_page_views IS
  'Per-page/day/source rollup of visits to /a/<slug>. Anonymous: no IP, no UA.';

-- ─── 4. clients: name the thing correctly without moving it ───────────────
-- Read-only alias. Lets new code say what the table actually holds while the
-- existing ~50 call sites keep working untouched.

CREATE OR REPLACE VIEW public.policy_analyses WITH (security_invoker = true) AS
  SELECT * FROM public.clients;

COMMENT ON VIEW public.policy_analyses IS
  'Correctly-named read alias for "clients", which holds one row per uploaded '
  'policy PDF and its analysis — not one row per person. People live in customers.';

COMMENT ON TABLE public.clients IS
  'MISNOMER: holds policy analyses (one row per uploaded PDF), not people. '
  'Actual people are in customers; clients.customer_id points there. '
  'Read via the policy_analyses view in new code.';

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK (structure only — dropped tables held test data and are not
-- recoverable from here; restore from a Supabase PITR snapshot if needed):
--
--   BEGIN;
--   DROP VIEW IF EXISTS public.policy_analyses;
--   DROP VIEW IF EXISTS public.leads;
--   ALTER TABLE public.marketing_leads RENAME TO leads;
--   ALTER INDEX public.marketing_leads_pkey RENAME TO leads_pkey;
--   ALTER INDEX public.idx_marketing_leads_created_at RENAME TO idx_leads_created_at;
--   ALTER INDEX public.idx_marketing_leads_status RENAME TO idx_leads_status;
--   ALTER INDEX public.idx_marketing_leads_email RENAME TO idx_leads_email;
--   ALTER TABLE public.agent_page_views RENAME TO advisor_page_views;
--   ALTER INDEX public.agent_page_views_pkey RENAME TO advisor_page_views_pkey;
--   COMMIT;
-- ═══════════════════════════════════════════════════════════════════════════
