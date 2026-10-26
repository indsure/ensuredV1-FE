-- 027_agents_self_profile_down.sql
-- Undo 027: advisors can no longer save their own profile from the browser.
DROP POLICY IF EXISTS "agents_update_own_profile" ON public.agents;
