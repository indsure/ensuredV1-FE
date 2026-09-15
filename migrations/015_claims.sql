-- ============================================================================
-- 015_claims.sql
-- The Claims desk: an advisor tracks a customer's health claim from the first
-- consultation to the settlement letter, and the sensitive paperwork deletes
-- itself on a clock the customer is told about before they hand anything over.
--
-- WHAT THIS LANE IS NOT: it is not an analysis lane. Nothing here calls Gemini —
-- no OCR, no extraction, no scoring. Every field is typed by the advisor. The
-- upload route deliberately does NOT import the extraction pipeline, so adding a
-- model call later takes a visible new import rather than a quiet flag flip.
-- Claims are the cheapest feature in the product to run; keep them that way.
--
-- RETENTION (the reason this migration has four tables and not two):
-- Uploaded documents live 30 days from the FIRST upload, extendable ONCE by 30
-- more if the claim is still open, with an absolute ceiling of 60 days. A daily
-- sweep in the backend deletes the bucket objects and the claim_documents rows,
-- then stamps documents_purged_at.
--
-- What survives a purge is the CASE RECORD — insurer, hospital, ailment, claimed
-- vs settled amount, dates, turnaround — because after the files are gone those
-- columns describe a case, not a person. That record is what feeds the advisor's
-- claims track record, and it is why the schema separates document from record.
--
-- The ONE exception is outcome proof (the settlement or repudiation letter). The
-- advisor wants it to show future customers; it also carries a name, a policy
-- number and an amount. So it outlives the clock ONLY when proof_consent_at is
-- stamped — i.e. the customer agreed, on the record, at the moment of upload.
-- No consent, no exception: it burns with everything else.
--
-- Idempotent. Safe to run more than once. Purely additive: no existing table,
-- column, policy or bucket is touched.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- claims — one ticket per claim event.
--
-- customer_id is NULLABLE with ON DELETE SET NULL, and there is deliberately NO
-- denormalised copy of the claimant's name. Two consequences, both wanted:
-- deleting a customer erases their name from the claims desk immediately (the
-- claim then reads "Customer removed"), and the row still counts toward the
-- track record, because the aggregate never needed the name. The API requires a
-- customer_id on insert; the null state exists only for the post-deletion case.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.claims (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id             uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  customer_id          uuid REFERENCES public.customers(id) ON DELETE SET NULL,

  -- Drives which document checklist the ticket asks for. Health claims split
  -- this way in practice: cashless wants a pre-auth and a TPA card,
  -- reimbursement wants bills, receipts and a signed Part B.
  claim_type           text NOT NULL DEFAULT 'reimbursement'
                         CHECK (claim_type IN ('cashless', 'reimbursement')),

  -- Resting states only. 'query_resolved' is an EVENT, not a resting state:
  -- resolving the last open query returns the claim to 'under_process'.
  status               text NOT NULL DEFAULT 'opened'
                         CHECK (status IN ('opened', 'docs_received', 'submitted',
                                           'under_process', 'query_raised',
                                           'settled', 'rejected')),

  insurer              text,
  tpa                  text,
  policy_number        text,
  hospital             text,
  ailment              text,

  claimed_amount       numeric(12,2),
  settled_amount       numeric(12,2),

  admitted_on          date,
  discharged_on        date,

  -- Retention. The clock starts on the FIRST upload, not on ticket creation —
  -- an empty ticket holds nothing worth counting down. Both stay null until
  -- then, and a null purge_at is invisible to the sweep.
  retention_started_at timestamptz,
  purge_at             timestamptz,
  extension_used       boolean NOT NULL DEFAULT false,
  extension_granted_at timestamptz,
  documents_purged_at  timestamptz,

  -- Null means the outcome proof is purged with everything else.
  proof_consent_at     timestamptz,

  closed_at            timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.claims IS
  'Health claim tickets. Uploaded documents are purged at purge_at (30 days from first upload, extendable once to 60); the row itself survives and feeds the agent claims track record. Zero AI in this lane.';

-- ─────────────────────────────────────────────────────────────────────────────
-- claim_queries — one row per insurer query ROUND. Created before
-- claim_documents because documents reference it.
--
-- Insurers routinely raise two or three rounds and a messy claim can run to
-- five, so this is a list with no cap, not a flag on the claim. Each round keeps
-- its own question, dates and reply papers. The claim reads 'query_raised' for
-- as long as ANY row here has resolved_on IS NULL — several can be open at once,
-- because a TPA and an insurer can both query the same claim.
--
-- seq is the advisor-facing round number ("Round 3"). It is assigned as
-- max(seq)+1 per claim and never reused, so deleting a mis-logged round leaves a
-- gap rather than renumbering history under the advisor's feet.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.claim_queries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id        uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  agent_id        uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,

  seq             integer NOT NULL,
  question        text NOT NULL,
  -- Editable: a query often arrives by phone days before anyone logs it.
  raised_on       date NOT NULL DEFAULT CURRENT_DATE,
  raised_by       text,
  resolved_on     date,
  resolution_note text,

  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT claim_queries_seq_unique UNIQUE (claim_id, seq),
  -- A round cannot be resolved before it was raised.
  CONSTRAINT claim_queries_dates_sane CHECK (resolved_on IS NULL OR resolved_on >= raised_on)
);

COMMENT ON TABLE public.claim_queries IS
  'Insurer query rounds on a claim. Unlimited per claim; seq is the advisor-facing round number and is never reused. A claim is query_raised while any row has resolved_on IS NULL.';

-- ─────────────────────────────────────────────────────────────────────────────
-- claim_documents — the files, and the only thing the sweep destroys.
--
-- category is what the sweep keys on: 'personal' and 'case' always go at
-- purge_at; 'outcome' goes too UNLESS the claim carries proof_consent_at.
--
-- NO signed URL is stored. The lead-policy route mints a one-year URL into its
-- row — tolerable for a prospect's own policy PDF, not for an Aadhaar scan, and
-- it would quietly outlive the incineration it is meant to be subject to. Here
-- we keep the path and mint a ten-minute URL on demand, audited each time.
--
-- query_id null means the file belongs to the original submission; set means it
-- went in to answer that round. Without it a claim with three rounds becomes an
-- undifferentiated pile and nobody can reconstruct what satisfied whom.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.claim_documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id     uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  agent_id     uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  query_id     uuid REFERENCES public.claim_queries(id) ON DELETE SET NULL,

  category     text NOT NULL CHECK (category IN ('personal', 'case', 'outcome')),
  doc_type     text,

  storage_path text NOT NULL,
  filename     text NOT NULL,
  file_size    integer,
  mime_type    text,

  uploaded_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.claim_documents IS
  'Files on a claim, in the policy-pdfs bucket under {agentId}/claims/{claimId}/. Destroyed by the daily sweep at claims.purge_at; outcome proof survives only when claims.proof_consent_at is set. Path only — signed URLs are minted on demand for 10 minutes.';

-- ─────────────────────────────────────────────────────────────────────────────
-- claim_events — append-only timeline. Survives the purge, so a claim stays
-- reconstructable even in the worst case (a live claim hitting the 60-day
-- ceiling on its fourth query round).
--
-- status is intentionally unconstrained: it records event types the claims
-- CHECK does not allow as resting states, notably 'query_raised',
-- 'query_resolved' and 'documents_purged'.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.claim_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id    uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  agent_id    uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,

  status      text NOT NULL,
  note        text,
  -- Editable: the advisor may be logging yesterday's phone call.
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.claim_events IS
  'Append-only claim timeline. Survives document purge so the claim history stays intact.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS claims_agent_status_idx
  ON public.claims (agent_id, status);

CREATE INDEX IF NOT EXISTS claims_agent_created_idx
  ON public.claims (agent_id, created_at DESC);

-- The sweep's index. Partial: a claim already purged, or with nothing uploaded
-- yet, is not a candidate and should not sit in the index.
CREATE INDEX IF NOT EXISTS claims_purge_due_idx
  ON public.claims (purge_at)
  WHERE documents_purged_at IS NULL AND purge_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS claim_documents_claim_idx
  ON public.claim_documents (claim_id);

CREATE INDEX IF NOT EXISTS claim_queries_claim_idx
  ON public.claim_queries (claim_id);

-- Finds open rounds for the "is this claim still queried?" check.
CREATE INDEX IF NOT EXISTS claim_queries_open_idx
  ON public.claim_queries (claim_id)
  WHERE resolved_on IS NULL;

CREATE INDEX IF NOT EXISTS claim_events_claim_idx
  ON public.claim_events (claim_id, occurred_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS. Every route already goes through the backend pool with an agent_id
-- filter, so this is defence in depth rather than the primary control — but it
-- matches agent_pages and it means a stray anon key can never read a claim.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.claims          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_queries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_events    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agents_own_claims" ON public.claims;
CREATE POLICY "agents_own_claims" ON public.claims
  FOR ALL
  TO authenticated
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

DROP POLICY IF EXISTS "agents_own_claim_queries" ON public.claim_queries;
CREATE POLICY "agents_own_claim_queries" ON public.claim_queries
  FOR ALL
  TO authenticated
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

DROP POLICY IF EXISTS "agents_own_claim_documents" ON public.claim_documents;
CREATE POLICY "agents_own_claim_documents" ON public.claim_documents
  FOR ALL
  TO authenticated
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

DROP POLICY IF EXISTS "agents_own_claim_events" ON public.claim_events;
CREATE POLICY "agents_own_claim_events" ON public.claim_events
  FOR ALL
  TO authenticated
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());
