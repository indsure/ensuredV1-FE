-- IndSure Commercial (/corporate): individual logins, problem reports, and which reminders were sent.
-- New tables only; nothing existing changes. RLS on with no policies, so browsers cannot reach them.
BEGIN;

CREATE TABLE IF NOT EXISTS corp_users (
  email text PRIMARY KEY,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('ops', 'accounts', 'admin', 'readonly')),
  password_hash text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  last_login timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS corp_feedback (
  id bigserial PRIMARY KEY,
  kind text NOT NULL,
  message text NOT NULL,
  page text,
  who_name text,
  who_email text,
  who_role text,
  browser text,
  file_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS corp_reminders_sent (
  key text PRIMARY KEY,
  sent_to text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE corp_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE corp_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE corp_reminders_sent ENABLE ROW LEVEL SECURITY;

COMMIT;
