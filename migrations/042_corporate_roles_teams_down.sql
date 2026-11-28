-- Undo 042. Stops with an error, changing nothing, while anyone holds a role that is not built in.
BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM corp_members WHERE role NOT IN ('ops', 'accounts', 'admin', 'readonly'))
     OR EXISTS (SELECT 1 FROM corp_invites WHERE role NOT IN ('ops', 'accounts', 'admin', 'readonly') AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now()) THEN
    RAISE EXCEPTION 'someone holds a role that is not built in; not undone';
  END IF;
END $$;
-- Finished invites only: they grant nothing any more.
UPDATE corp_invites SET role = NULL WHERE role NOT IN ('ops', 'accounts', 'admin', 'readonly');
ALTER TABLE corp_members ADD CONSTRAINT corp_members_role_check CHECK (role IN ('ops', 'accounts', 'admin', 'readonly'));
ALTER TABLE corp_invites ADD CONSTRAINT corp_invites_role_check CHECK (role IN ('ops', 'accounts', 'admin', 'readonly'));
ALTER TABLE corp_invites DROP COLUMN IF EXISTS teams;
ALTER TABLE corp_members DROP COLUMN IF EXISTS staff_code;
DROP TABLE IF EXISTS corp_team_members;
DROP TABLE IF EXISTS corp_teams;
DROP TABLE IF EXISTS corp_roles;
COMMIT;
