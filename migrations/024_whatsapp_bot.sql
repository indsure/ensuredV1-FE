-- 024_whatsapp_bot.sql
-- The WhatsApp channel for advisors (beta). Plan: docs/plans/2026-09-25-whatsapp-bot-beta.md
--
-- ADDITIVE ONLY. Five new tables, no change to any existing table or column. Beta and prod
-- share one Supabase, so this lands on prod the moment it runs; being additive is what makes
-- that safe, and dropping these five tables is the whole rollback.
--
-- WhatsApp is a new CHANNEL on the same data. Policies stay in `clients`, people in
-- `customers`, balances in `agent_credits`. Nothing here forks them.
--
-- RLS is enabled with NO policies on every table: only the service-role pool (the backend)
-- can read or write them. The browser's anon key can never see a linked phone number or a
-- message log, including the advisor's own; the portal reads link status through the API.

-- Beta gate by ACCOUNT, not by phone number: the number arrives through linking.
CREATE TABLE IF NOT EXISTS wa_allowlist (
  agent_id   uuid PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  note       text,
  added_at   timestamptz NOT NULL DEFAULT now()
);

-- One row per link attempt. A pending row holds the code; linking flips it to active.
-- The code is stored as a sha256 hash, never in clear.
CREATE TABLE IF NOT EXISTS whatsapp_link (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id         uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  wa_number        text NOT NULL,                       -- E.164 digits, e.g. 919812345678
  status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'active', 'revoked')),
  link_code_hash   text,
  code_expires_at  timestamptz,
  code_attempts    int NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  linked_at        timestamptz,
  revoked_at       timestamptz
);
-- One live link per advisor, and one advisor per number.
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_link_one_active_agent
  ON whatsapp_link (agent_id) WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_link_one_active_number
  ON whatsapp_link (wa_number) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS whatsapp_link_number ON whatsapp_link (wa_number, status);

CREATE TABLE IF NOT EXISTS wa_conversation (
  agent_id          uuid PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  state             text NOT NULL DEFAULT 'IDLE',
  current_client_id uuid,
  pending_context   jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Every inbound and outbound message, redacted. The UNIQUE key on wa_message_id is the
-- dedupe: a re-delivered message fails the insert and gets no second reply.
CREATE TABLE IF NOT EXISTS wa_message (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_message_id  text UNIQUE,
  agent_id       uuid REFERENCES agents(id) ON DELETE CASCADE,  -- null for unknown senders
  direction      text NOT NULL CHECK (direction IN ('in', 'out')),
  type           text NOT NULL CHECK (type IN ('text', 'document', 'media', 'system')),
  body_redacted  text,
  media_sha256   text,
  intent         text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wa_message_agent_time ON wa_message (agent_id, created_at DESC);

CREATE TABLE IF NOT EXISTS wa_job (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id         uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  wa_message_id    text,
  client_id        uuid,
  analysis_job_id  text,
  file_sha256      text NOT NULL,
  insurance_type   text,
  status           text NOT NULL DEFAULT 'queued'
                     CHECK (status IN ('queued', 'processing', 'done', 'failed', 'needs_attention', 'skipped')),
  failure_reason   text,
  queued_at        timestamptz NOT NULL DEFAULT now(),
  started_at       timestamptz,
  finished_at      timestamptz
);
CREATE INDEX IF NOT EXISTS wa_job_agent_hash ON wa_job (agent_id, file_sha256);
CREATE INDEX IF NOT EXISTS wa_job_open ON wa_job (status) WHERE status IN ('queued', 'processing');

ALTER TABLE wa_allowlist    ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_link   ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_conversation ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_message      ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_job          ENABLE ROW LEVEL SECURITY;

-- First beta advisor. Inserted by email so the migration never hard-codes an id; inserts
-- nothing if that address is not an agent account.
INSERT INTO wa_allowlist (agent_id, note)
SELECT a.id, 'beta #1 (Deep)'
FROM agents a
JOIN auth.users u ON u.id = a.id
WHERE lower(u.email) = 'deepshah399@gmail.com'
ON CONFLICT (agent_id) DO NOTHING;
