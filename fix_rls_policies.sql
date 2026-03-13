-- ===================================================
-- FIX: RLS Policies for Agent Signup Flow
-- Run this in your Supabase SQL Editor
-- ===================================================

-- 1. Allow authenticated users to INSERT their own agent profile
-- (The row's id must match their auth.uid())
CREATE POLICY "Agents can insert own profile"
ON public.agents
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- 2. Allow authenticated users to SELECT their own profile
CREATE POLICY "Agents can read own profile"
ON public.agents
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- 3. Allow authenticated users to UPDATE their own profile
CREATE POLICY "Agents can update own profile"
ON public.agents
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- 4. Allow the service role (backend) to do anything
-- (This should already exist but just to be safe)
CREATE POLICY "Service role has full access"
ON public.agents
FOR ALL
TO service_role
USING (true);

-- 5. Allow any authenticated user to read invite codes (needed for validation)
-- (Already likely exists but ensure it)
CREATE POLICY "Authenticated can read invite codes"
ON public.invite_codes
FOR SELECT
TO authenticated
USING (true);

-- 6. Allow authenticated users to update invite codes (to mark as used)
CREATE POLICY "Authenticated can update invite codes"
ON public.invite_codes
FOR UPDATE
TO authenticated
USING (true);
