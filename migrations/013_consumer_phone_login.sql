-- ============================================================================
-- 013_consumer_phone_login.sql
-- Lets a consumer log in with their mobile number instead of their email.
--
-- Supabase Auth is email+password only, so a mobile login has to resolve the
-- number to the account's email first. That resolution must be unambiguous, so
-- the number has to be unique across consumer accounts.
--
-- PARTIAL index, deliberately:
--   • `WHERE phone IS NOT NULL` — mobile capture only shipped 2026-08-14, so the
--     accounts that predate it have no number. A plain UNIQUE would treat every
--     one of those NULLs as distinct anyway, but spelling the predicate out
--     documents the intent and keeps the index small.
--   • A NOT NULL constraint on the column is NOT possible for the same reason:
--     the existing rows would violate it instantly. The "mobile is required"
--     rule therefore lives in the API, applied only when a profile row is first
--     created — /api/me/bootstrap also runs on every login and on entry to /app,
--     and enforcing it there unconditionally would lock existing users out of
--     their own portfolio.
--
-- Verified before writing: 6 consumer accounts, 0 with a phone, 0 duplicates,
-- 0 format inconsistencies, and no agent sharing a number with a consumer. So
-- this index applies with no cleanup and no backfill.
--
-- Idempotent. Safe to run more than once.
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS individual_profiles_phone_unique
  ON public.individual_profiles (phone)
  WHERE phone IS NOT NULL;

COMMENT ON INDEX public.individual_profiles_phone_unique IS
  'Makes mobile login unambiguous: one consumer account per number. Partial, because accounts created before 2026-08-14 have no phone.';

-- ============================================================================
-- Rollback:
--   DROP INDEX IF EXISTS public.individual_profiles_phone_unique;
-- ============================================================================
