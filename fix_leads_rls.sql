-- ===================================================
-- FIX: leads table RLS — restrict SELECT to admins only
-- Run this in the Supabase SQL Editor.
--
-- WHY: The existing policy "Allow authenticated read" on public.leads is
--   FOR SELECT TO authenticated USING (true)
-- which lets ANY logged-in agent read EVERY lead (name/email/phone) directly
-- via the public anon key — a BOLA that bypasses the backend entirely.
--
-- This replaces it with an admin-only read policy. Public lead submission
-- (anon INSERT) and the service-role backend keep working unchanged.
-- ===================================================

DROP POLICY IF EXISTS "Allow authenticated read" ON public.leads;

CREATE POLICY "Admins can read leads"
ON public.leads
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.agents
    WHERE agents.id = auth.uid() AND agents.is_admin = true
  )
);

-- Sanity check after running:
--   SELECT policyname, cmd, roles::text, qual FROM pg_policies
--   WHERE schemaname='public' AND tablename='leads';
