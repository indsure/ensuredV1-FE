-- 031: drop "Public: read reports" on public_reports.
-- Found after 029 ran on 2026-10-27: a second public read rule, created by hand in Supabase
-- (it was in no migration), let anyone with the public anon key read every active switch
-- report: roles {public}, SELECT, USING (is_active = true). Shared report links read through
-- the backend (/api/public-report/:uuid), which these rules do not apply to.
-- RUN on the shared database 2026-10-27. Idempotent. Undo: 031_drop_public_read_reports_down.sql.

DROP POLICY IF EXISTS "Public: read reports" ON public.public_reports;

-- Check: only advisor-own rules remain.
--   SELECT policyname FROM pg_policies WHERE tablename = 'public_reports';
--   -> Agent: manage own reports, agents_own_public_reports
