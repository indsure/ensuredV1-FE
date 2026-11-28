-- Undo 043. Deletes every uploaded LIC sheet and its rows.
BEGIN;
DROP TABLE IF EXISTS lic_paid_rows;
DROP TABLE IF EXISTS lic_due_rows;
DROP TABLE IF EXISTS lic_uploads;
COMMIT;
