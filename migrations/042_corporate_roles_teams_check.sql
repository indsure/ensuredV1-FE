-- Expect three rows, all true, then two rows (staff_code, teams), then 0.
SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('corp_roles', 'corp_teams', 'corp_team_members') ORDER BY 1;
SELECT table_name, column_name FROM information_schema.columns WHERE (table_name, column_name) IN (('corp_members', 'staff_code'), ('corp_invites', 'teams'));
SELECT count(*) AS old_role_checks FROM pg_constraint WHERE conname IN ('corp_members_role_check', 'corp_invites_role_check');
