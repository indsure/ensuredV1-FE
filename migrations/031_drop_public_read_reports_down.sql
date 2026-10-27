-- Undo 031. Re-opens public reads of active switch reports; only if something truly needs it.
CREATE POLICY "Public: read reports" ON public.public_reports
  FOR SELECT
  TO public
  USING (is_active = true);
