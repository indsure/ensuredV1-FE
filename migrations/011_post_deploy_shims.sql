-- ═══════════════════════════════════════════════════════════════════════════
-- 011_post_deploy_shims.sql              2026-08-14
--
-- Follow-up to 010, run immediately after the EC2 backend deploy landed.
-- Two shim adjustments, in opposite directions:
--
--   • DROP the `leads` view — the backend is now deployed and writes
--     `marketing_leads` directly. Verified: nothing reads the leads table via
--     supabase-js; all access goes through /api/leads on the backend.
--
--   • ADD an `advisor_page_views` read shim — the Vercel FRONTEND deploys
--     separately and is still shipping `.from("advisor_page_views")` in
--     fetchPageViews(). Read-only is enough (the upsert lives in the backend,
--     already on the new name). Without this the My Page views panel silently
--     renders empty on prod (MyPage.tsx catches and falls back to []).
--
-- DROP the advisor_page_views shim once the frontend is redeployed to Vercel.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DROP VIEW IF EXISTS public.leads;

CREATE OR REPLACE VIEW public.advisor_page_views WITH (security_invoker = true) AS
  SELECT page_id, viewed_on, utm_source, views, app, device
  FROM public.agent_page_views;

COMMENT ON VIEW public.advisor_page_views IS
  'DEPRECATED read-only shim (migration 011) for the not-yet-redeployed Vercel '
  'frontend. Drop after the frontend deploy. Writes go to agent_page_views.';

COMMIT;

-- After the Vercel frontend deploy:
--   DROP VIEW public.advisor_page_views;
