-- 025_policy_document_rules.sql
-- Policy terms read from the policy document by deterministic product parsers, and the
-- advisor's review of them. Plan: docs/plans/2026-10-01-policy-document-rules.md
--
-- ADDITIVE ONLY: five new tables, no change to any existing table or column. Beta and prod
-- share one Supabase, so this lands on prod the moment it runs. Do not run it without the
-- backup / dry-run / approval steps in docs/plans/2026-10-01-policy-document-rules-deploy.md.
--
-- Access: RLS is enabled with NO policies on every table, as in 024. Only the backend's
-- service connection can read or write them; the browser's keys see nothing, not even the
-- advisor's own rows. The backend scopes every query to the JWT-verified agent through a
-- join to clients.agent_id (services/policyDocStore.ts, tested on PGlite).
--
-- Customer data: per-policy tables hang off clients(id) with ON DELETE CASCADE, so deleting a
-- policy (or an account, through clients) removes its document records, parses, facts and
-- review events. product_rule_sets holds no customer data by construction (see
-- buildProductRuleCandidate) and is not linked to any policy.

-- One row per distinct document file per policy. The file itself stays in the existing
-- private storage bucket; storage_ref is "bucket/path", never a URL.
CREATE TABLE IF NOT EXISTS policy_source_documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  sha256       text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  byte_size    integer NOT NULL CHECK (byte_size > 0),
  page_count   integer NOT NULL CHECK (page_count > 0),
  storage_ref  text CHECK (storage_ref IS NULL OR storage_ref !~ '^https?://'),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, sha256),
  UNIQUE (id, client_id)
);

-- One row per (document, extractor version, adapter version). A retry of the same file with
-- the same code finds the existing row instead of adding another.
CREATE TABLE IF NOT EXISTS policy_document_parses (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id        uuid NOT NULL,
  client_id          uuid NOT NULL,
  extractor_id       text NOT NULL,
  extractor_version  text NOT NULL,
  adapter_id         text,
  adapter_version    text,
  status             text NOT NULL CHECK (status IN ('supported', 'unsupported', 'needs_review', 'failed')),
  reasons            jsonb NOT NULL DEFAULT '[]'::jsonb,
  page_methods       jsonb NOT NULL DEFAULT '[]'::jsonb,
  flags              jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (document_id, client_id) REFERENCES policy_source_documents (id, client_id) ON DELETE CASCADE,
  UNIQUE (id, client_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS policy_document_parses_once
  ON policy_document_parses (document_id, extractor_version, COALESCE(adapter_id, ''), COALESCE(adapter_version, ''));
CREATE INDEX IF NOT EXISTS policy_document_parses_client ON policy_document_parses (client_id, created_at DESC);

-- Append-only revisions of each field, per policy. The document's reading is kept on every
-- revision; an advisor correction sits beside it, never over it.
CREATE TABLE IF NOT EXISTS policy_rule_facts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        uuid NOT NULL,
  parse_id         uuid NOT NULL,
  field_key        text NOT NULL CHECK (field_key ~ '^[a-z_]+\.[a-z0-9_]+$'),
  revision         integer NOT NULL CHECK (revision >= 1),
  state            text NOT NULL CHECK (state IN ('document_pending', 'reviewed', 'corrected', 'rejected', 'conflicting')),
  document_field   jsonb NOT NULL,
  corrected_value  jsonb,
  parser_version   text NOT NULL,
  actor_id         uuid,
  reason           text CHECK (reason IS NULL OR length(reason) <= 1000),
  created_at       timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (parse_id, client_id) REFERENCES policy_document_parses (id, client_id) ON DELETE CASCADE,
  UNIQUE (client_id, field_key, revision),
  CHECK ((state = 'corrected') = (corrected_value IS NOT NULL) OR state = 'conflicting'),
  CHECK (state = 'document_pending' OR state = 'conflicting' OR actor_id IS NOT NULL)
);

-- Versioned product rules, reusable across policies. No customer data. A row starts as a
-- draft; nothing in the app promotes a draft to reviewed (that is an explicit admin step,
-- not built yet), and uploading a document never writes here.
CREATE TABLE IF NOT EXISTS product_rule_sets (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insurer          text NOT NULL,
  uin              text NOT NULL CHECK (uin ~ '^[0-9]{3}[A-Z][0-9]{3}V[0-9]{2}$'),
  plan_option      text NOT NULL,
  benefit_variant  text NOT NULL,
  applicability    jsonb NOT NULL DEFAULT '{}'::jsonb,
  rules            jsonb NOT NULL,
  provenance       jsonb NOT NULL,
  review_status    text NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft', 'reviewed', 'withdrawn')),
  revision         integer NOT NULL CHECK (revision >= 1),
  supersedes       uuid REFERENCES product_rule_sets(id),
  created_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (insurer, uin, plan_option, benefit_variant, revision)
);

-- Who did what, when, to exactly which revision. Idempotency key makes a double-click or a
-- retried request a no-op.
CREATE TABLE IF NOT EXISTS rule_review_events (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id            uuid REFERENCES clients(id) ON DELETE CASCADE,
  product_rule_set_id  uuid REFERENCES product_rule_sets(id),
  parse_id             uuid,
  actor_id             uuid NOT NULL,
  action               text NOT NULL CHECK (action IN ('confirm', 'correct', 'reject', 'resolve_flag')),
  field_key            text,
  flag_id              text,
  choice               text,
  from_revision        integer,
  to_revision          integer,
  reason               text CHECK (reason IS NULL OR length(reason) <= 1000),
  idempotency_key      text NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 100),
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (actor_id, idempotency_key),
  CHECK ((client_id IS NULL) <> (product_rule_set_id IS NULL))
);
CREATE INDEX IF NOT EXISTS rule_review_events_client ON rule_review_events (client_id, created_at);

-- History is not editable. Rows go away only with the policy they belong to.
CREATE OR REPLACE FUNCTION policy_rules_no_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$;
DROP TRIGGER IF EXISTS policy_rule_facts_no_update ON policy_rule_facts;
CREATE TRIGGER policy_rule_facts_no_update BEFORE UPDATE ON policy_rule_facts
  FOR EACH ROW EXECUTE FUNCTION policy_rules_no_update();
DROP TRIGGER IF EXISTS rule_review_events_no_update ON rule_review_events;
CREATE TRIGGER rule_review_events_no_update BEFORE UPDATE ON rule_review_events
  FOR EACH ROW EXECUTE FUNCTION policy_rules_no_update();

ALTER TABLE policy_source_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_document_parses  ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_rule_facts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_rule_sets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_review_events      ENABLE ROW LEVEL SECURITY;
