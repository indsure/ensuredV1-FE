-- 026_entitlement_lockdown_down.sql
-- Undo of 026_entitlement_lockdown.sql. RE-OPENS the E8 hole (browser can write its own plan).
-- Use only if the lockdown broke a real screen, and fix that screen instead as soon as possible.
--
-- Restores Supabase's default table grants for anon/authenticated and the 002 consumer policy.
-- If 026_entitlement_lockdown_check.sql showed different grants before the change, restore
-- those exact grants instead of these defaults.

BEGIN;

DROP POLICY IF EXISTS "individuals_read_own_profile" ON public.individual_profiles;
DROP POLICY IF EXISTS "individuals_own_profile" ON public.individual_profiles;
CREATE POLICY "individuals_own_profile" ON public.individual_profiles
  FOR ALL
  USING (id = auth.uid());

GRANT INSERT, UPDATE, DELETE ON public.individual_profiles TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.agent_credits TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.agent_ocr_credits TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.agents TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.teams TO anon, authenticated;

COMMIT;
