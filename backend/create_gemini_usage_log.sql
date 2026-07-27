-- Gemini usage / cost ledger.
-- One row per Gemini API call, written from the backend service connection.
-- Contains NO policy text and NO personal data: anonymous callers are recorded
-- as a salted hash of their IP (pseudonymous, DPDP-friendly), agents as their id.
-- Token counts come straight from Gemini's usageMetadata, so cost is exact
-- (tokens x the rate you configure via GEMINI_PRICE_INPUT/OUTPUT_PER_M).

CREATE TABLE IF NOT EXISTS gemini_usage_log (
  id             BIGSERIAL PRIMARY KEY,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  feature        TEXT NOT NULL,            -- policy_audit | wording_extract | data_entry | image_ocr | sach_ai | portfolio_insights | switch_reco | ai_generate
  route          TEXT,                     -- e.g. /api/analyze, /api/agent/trigger-batch-process
  model          TEXT NOT NULL,
  source_type    TEXT,                     -- anonymous | agent | system
  actor_id       TEXT,                     -- agent uuid  OR  sha256(ip+salt)[0:16]  OR null
  job_id         TEXT,
  client_id      TEXT,
  input_hash     TEXT,                     -- sha256(prompt+content): identical hash = duplicate spend
  prompt_tokens  INTEGER,
  output_tokens  INTEGER,
  total_tokens   INTEGER,
  est_cost_usd   NUMERIC(12,6),
  status         TEXT NOT NULL DEFAULT 'ok', -- ok | error
  attempt        INTEGER DEFAULT 1,        -- retry attempt number (see AIService MAX_RETRIES)
  latency_ms     INTEGER,
  error_message  TEXT
);

CREATE INDEX IF NOT EXISTS idx_gul_created_at ON gemini_usage_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gul_feature    ON gemini_usage_log (feature);
CREATE INDEX IF NOT EXISTS idx_gul_actor      ON gemini_usage_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_gul_input_hash ON gemini_usage_log (input_hash);
