-- After 043: expect 3 rows, each with rls = true.
SELECT c.relname AS table_name, c.relrowsecurity AS rls
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relname IN ('lic_uploads', 'lic_due_rows', 'lic_paid_rows')
 ORDER BY c.relname;
