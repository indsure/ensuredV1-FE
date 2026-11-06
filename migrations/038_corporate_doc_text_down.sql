-- Undo 038. Text already moved here would be lost, so restore a backup that contains it first.
BEGIN;
DROP TABLE IF EXISTS corp_doc_text;
COMMIT;
