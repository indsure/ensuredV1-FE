-- Undo 036. This deletes every record entered in the /corporate portal.
BEGIN;
DROP TABLE IF EXISTS corp_files;
DROP TABLE IF EXISTS corp_book_versions;
DROP TABLE IF EXISTS corp_book;
COMMIT;
