-- ============================================================================
-- 020_pending_upload_signup_email.sql
--
-- Lets a parked upload be recovered by the address that signed up for it, so
-- opening the confirmation email somewhere else stops destroying the upload.
--
-- THE BUG
-- Upload-before-signup parks the file and hands the browser an opaque token,
-- held in sessionStorage. sessionStorage is per tab. The confirmation email
-- routinely opens in a different tab, a different browser, or on a phone, and
-- at that moment the only handle on the file is gone. The row sits unclaimed
-- until the 24h sweep deletes it, and the visitor is told to upload again with
-- no explanation of why.
--
-- WHY NOT PUT THE TOKEN IN THE CONFIRMATION LINK
-- It was the smaller change and it is the wrong one. That link sits in an inbox,
-- is scanned by mail providers, is logged by anything in the delivery path, and
-- gets forwarded. The token is a bearer capability over a health insurance
-- document. Confirming the email already proves ownership of the address, so the
-- address is a better key than a secret that has to travel.
--
-- WHAT THIS COLUMN IS NOT
-- It is not an alternative way in. Claiming by email requires an authenticated
-- session whose address is CONFIRMED in auth.users and matches, case-insensitively.
-- An unconfirmed account cannot claim anything, which is the property that makes
-- the address safe to key on. The token path is unchanged and still works.
--
-- PRIVACY
-- These rows already hold an identifiable insurance document for someone with no
-- account. Adding the address they used raises nothing materially: it is the same
-- person, in a row that still expires in 24 hours and is still swept. The address
-- is cleared on claim, below, so it does not outlive its purpose.
-- ============================================================================

BEGIN;

ALTER TABLE public.pending_uploads
  ADD COLUMN IF NOT EXISTS signup_email text;

COMMENT ON COLUMN public.pending_uploads.signup_email IS
  'Address used at signup while this upload was held, so a confirmation email opened in another tab can still claim it. Only ever matched against a CONFIRMED auth.users email. Cleared when the row is claimed.';

-- Lookup is: unclaimed rows for this address, newest first. Partial, because a
-- claimed row must never be found by it, and because unclaimed rows are the
-- small minority over time.
CREATE INDEX IF NOT EXISTS pending_uploads_signup_email_idx
  ON public.pending_uploads (lower(signup_email), created_at DESC)
  WHERE claimed_by IS NULL AND signup_email IS NOT NULL;

COMMIT;

-- Verification, after applying:
--
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='pending_uploads'
--      AND column_name='signup_email';
--
--   SELECT indexname FROM pg_indexes
--    WHERE tablename='pending_uploads' AND indexname='pending_uploads_signup_email_idx';
--
-- Existing rows keep signup_email NULL and remain claimable by token exactly as
-- before. The partial index excludes NULLs, so they are never matched by the
-- email path.
