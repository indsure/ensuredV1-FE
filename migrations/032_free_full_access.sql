-- 032: agents.free_full_access, for the new limited Free plan (founder, 2026-11-02).
-- New Free = 3 health policy checks + 20 policy scans, everything else paid. Every advisor that
-- exists when this runs keeps today's Free: the column is added with DEFAULT true (so every
-- existing row gets true in the same statement, no gap), then the default switches to false
-- for accounts created afterwards. create-profile also sets it true for signups with a valid
-- invite code or a login made before FREE_TIER_CUTOFF.
-- NOT added to the browser UPDATE grant list (026), so a browser cannot set it.
-- Plan: docs/plans/2026-11-02-free-tier-paywall.md. Undo: 032_free_full_access_down.sql
-- (revert the backend FIRST, then run the undo; the backend fails open without the column).

BEGIN;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS free_full_access boolean NOT NULL DEFAULT true;
ALTER TABLE public.agents ALTER COLUMN free_full_access SET DEFAULT false;
COMMIT;

-- Checks (run after):
--   SELECT count(*) FILTER (WHERE free_full_access) AS kept, count(*) AS total FROM public.agents;
--     -> kept = total
--   SELECT column_default FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='agents' AND column_name='free_full_access';
--     -> false
--   SELECT has_column_privilege('authenticated','public.agents','free_full_access','SELECT');
--     -> true (the portal reads agents.*)
--   SELECT has_column_privilege('authenticated','public.agents','free_full_access','UPDATE');
--     -> false (browser cannot grant itself access)
