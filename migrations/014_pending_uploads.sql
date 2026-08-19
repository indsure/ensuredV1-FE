-- ============================================================================
-- 014_pending_uploads.sql
-- Holds a policy PDF uploaded by someone who does not have an account yet.
--
-- The consumer funnel used to demand a signup before the visitor could upload
-- anything, so the first thing a stranger met was a wall. This table moves the
-- wall one step later: upload, then sign up to see the result. The file has to
-- survive the round trip through signup, so it is parked here and in the
-- policy-pdfs bucket under pending/<token>, then claimed once an account exists.
--
-- WHAT THIS TABLE IS NOT: it is not a queue and not an analysis record. Nothing
-- here has been through Gemini. The quota check and the spend both happen at
-- CLAIM time, in the authenticated path, exactly as they did before — an
-- anonymous upload must never be able to cost money. If a future change moves
-- the quota check earlier, that property is gone.
--
-- PRIVACY (DPDP): these are identifiable insurance documents, frequently health
-- policies, belonging to people who have not created an account or accepted
-- terms. That is a weaker basis than anything else we store, so the row is
-- deliberately short-lived: expires_at defaults to 24 hours out, and an hourly
-- sweep in the backend deletes the bucket object and the row for anything past
-- expiry that was never claimed. The upload screen tells the visitor this in
-- plain language before they choose a file. Do not extend the TTL without
-- revisiting that copy.
--
--   • token       — opaque, unguessable, what the browser holds and later
--                   presents. Not a database id, so enumeration buys nothing.
--   • storage_path— object key inside the policy-pdfs bucket.
--   • claimed_by  — set once, to the account that claimed it. A non-null value
--                   makes the row inert: a token cannot be claimed twice, so a
--                   leaked token cannot attach a stranger's file to an account
--                   after the fact.
--   • ip_hash     — hashed, never the raw address. Abuse triage only.
--
-- No foreign key on claimed_by: consumer identities live in Supabase Auth, and
-- individual_profiles is populated lazily by /api/me/bootstrap, so a FK here
-- would fire on accounts that are legitimately mid-creation.
--
-- Idempotent. Safe to run more than once.
-- ============================================================================

CREATE TABLE IF NOT EXISTS pending_uploads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token         text NOT NULL UNIQUE,
  storage_path  text NOT NULL,
  filename      text NOT NULL,
  file_size     integer NOT NULL,
  mime_type     text NOT NULL,
  insurance_type text NOT NULL DEFAULT 'health',
  ip_hash       text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  claimed_by    uuid,
  claimed_at    timestamptz
);

-- No separate index on token: the UNIQUE constraint in the table definition
-- already backs it with pending_uploads_token_key, which is what the claim
-- lookup uses. Adding one here built a second, identical unique index — every
-- insert paid to maintain both. Dropped below for tables created before this
-- was noticed.
DROP INDEX IF EXISTS pending_uploads_token_idx;

-- The hourly sweep scans for expired, unclaimed rows. Partial, because claimed
-- rows are never swept and there is no reason to carry them in the index.
CREATE INDEX IF NOT EXISTS pending_uploads_sweep_idx
  ON pending_uploads (expires_at)
  WHERE claimed_by IS NULL;

COMMENT ON TABLE pending_uploads IS
  'Policy PDFs uploaded before signup. Never analysed while here — quota and Gemini spend happen at claim time in the authenticated path. Unclaimed rows and their bucket objects are swept hourly after expires_at (24h).';
