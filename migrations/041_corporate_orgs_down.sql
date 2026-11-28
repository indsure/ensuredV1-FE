-- Undo 041. Stops with an error, changing nothing, if any organisation other than the first has records.
BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM corp_book WHERE id <> 1) OR EXISTS (SELECT 1 FROM corp_book_versions WHERE org_id <> 1) THEN
    RAISE EXCEPTION 'another organisation has records; not undone';
  END IF;
END $$;
ALTER TABLE corp_feedback DROP COLUMN IF EXISTS org_id;
ALTER TABLE corp_book_versions DROP CONSTRAINT IF EXISTS corp_book_versions_pkey;
ALTER TABLE corp_book_versions DROP COLUMN IF EXISTS org_id;
ALTER TABLE corp_book_versions ADD CONSTRAINT corp_book_versions_pkey PRIMARY KEY (version);
ALTER TABLE corp_book ADD CONSTRAINT corp_book_id_check CHECK (id = 1);
DROP TABLE IF EXISTS corp_auth_events;
DROP TABLE IF EXISTS corp_invites;
DROP TABLE IF EXISTS corp_members;
DROP TABLE IF EXISTS corp_orgs;
COMMIT;
