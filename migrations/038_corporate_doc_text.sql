-- IndSure Commercial (/corporate): each document's text, kept out of the main record so saves stay small.
-- New table only; nothing existing changes. RLS on with no policies, so browsers cannot reach it.
BEGIN;

CREATE TABLE IF NOT EXISTS corp_doc_text (
  id text PRIMARY KEY,
  lines jsonb NOT NULL
);

ALTER TABLE corp_doc_text ENABLE ROW LEVEL SECURITY;

COMMIT;
