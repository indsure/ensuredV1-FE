-- IndSure Commercial (/corporate): records and the list of original files.
-- New tables only; nothing existing changes. RLS on with no policies, so browsers cannot reach them.
-- Only the backend's service connection can.
BEGIN;

CREATE TABLE IF NOT EXISTS corp_book (
  id integer PRIMARY KEY CHECK (id = 1),
  version integer NOT NULL,
  data jsonb NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS corp_book_versions (
  version integer PRIMARY KEY,
  data jsonb NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now(),
  note text
);

CREATE TABLE IF NOT EXISTS corp_files (
  id text PRIMARY KEY,
  name text NOT NULL,
  size integer NOT NULL,
  ext text NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE corp_book ENABLE ROW LEVEL SECURITY;
ALTER TABLE corp_book_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE corp_files ENABLE ROW LEVEL SECURITY;

COMMIT;
