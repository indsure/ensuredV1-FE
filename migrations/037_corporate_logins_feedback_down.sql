-- Undo 037. This deletes all portal logins except the owner's, and all problem reports.
BEGIN;
DROP TABLE IF EXISTS corp_reminders_sent;
DROP TABLE IF EXISTS corp_feedback;
DROP TABLE IF EXISTS corp_users;
COMMIT;
