-- ============================================================================
-- 016_claims_amounts_and_reopen.sql
--
-- Two small corrections to the claims desk, both found in real use on beta.
--
-- 1. AMOUNT OVERFLOW. claimed_amount/settled_amount were numeric(12,2), which
--    tops out at 9,999,999,999.99. That is generous for a health claim, but the
--    field takes free text from a human on a phone, and anything longer than
--    ten integer digits reached Postgres and came back as
--    "numeric field overflow" — surfaced to the advisor as a bare 500 while he
--    was trying to close a claim. Widened to numeric(14,2); the route now also
--    sanitises the input and answers 400 with something readable, so the column
--    width is a backstop rather than the guard.
--
-- 2. REOPENING. A claim could enter settled/rejected and never leave. Closing
--    is a human judgement made from a letter, and letters get misread, so the
--    state has to be reversible. No schema change is needed for the status
--    itself — the CHECK already allows under_process — but closed_at has to be
--    clearable, which it is. What this migration adds is the comment recording
--    that reopening is intended behaviour rather than an oversight.
--
-- Idempotent and additive. ALTER TYPE on a numeric widening rewrites no rows
-- that would lose data: every existing value fits the wider type by definition.
-- ============================================================================

ALTER TABLE public.claims
  ALTER COLUMN claimed_amount TYPE numeric(14,2),
  ALTER COLUMN settled_amount TYPE numeric(14,2);

COMMENT ON COLUMN public.claims.claimed_amount IS
  'What was asked for. numeric(14,2) is a backstop — the route sanitises free-text input (strips currency symbols and separators) and rejects nonsense with a 400 before it reaches here.';

COMMENT ON COLUMN public.claims.settled_amount IS
  'What actually landed. Cleared when a closed claim is reopened, because the settlement no longer stands.';

COMMENT ON COLUMN public.claims.closed_at IS
  'When the claim entered settled/rejected. Cleared on reopen — closing is a human judgement read off a letter, so it has to be reversible.';

COMMENT ON COLUMN public.claims.documents_purged_at IS
  'When the personal and case documents were destroyed — either by the retention sweep at purge_at, or immediately on closing the claim. Outcome proof is NOT covered by this stamp: it survives, and uploading further outcome proof stays allowed after the stamp is set.';
