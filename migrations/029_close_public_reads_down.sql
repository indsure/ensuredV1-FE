-- 029_close_public_reads_down.sql
-- Undo 029: puts back the 001 public read on public_reports and the 002 FOR ALL policy on
-- individual_policies (which reopens both holes 029 describes).
BEGIN;

CREATE POLICY "public_read_active_reports" ON public.public_reports
  FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "individuals_read_own_policies" ON public.individual_policies;
DROP POLICY IF EXISTS "individuals_own_policies" ON public.individual_policies;
CREATE POLICY "individuals_own_policies" ON public.individual_policies
  FOR ALL
  USING (user_id = auth.uid());

GRANT INSERT, UPDATE, DELETE ON public.individual_policies TO authenticated;

COMMIT;
