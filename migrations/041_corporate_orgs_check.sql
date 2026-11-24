-- Read-only checks after running 041.

-- 1. Organisation 1 exists. Expect one row: 1 | IC10001
SELECT id, code FROM public.corp_orgs ORDER BY id;

-- 2. The existing records are untouched: the same version numbers as before. Expect one row with id 1.
SELECT id, version FROM public.corp_book;

-- 3. RLS is on for all four new tables. Expect 4 rows, all true.
SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('corp_orgs', 'corp_members', 'corp_invites', 'corp_auth_events') ORDER BY relname;

-- 4. Versions are kept per organisation. Expect: PRIMARY KEY (org_id, version)
SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'corp_book_versions_pkey';
