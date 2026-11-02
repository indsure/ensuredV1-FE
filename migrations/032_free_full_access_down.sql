-- Undo 032. Revert the backend first (it fails open without the column, but the portal would
-- otherwise read a column that no longer exists only as undefined, which is also treated as
-- not limited). Dropping it puts every advisor back on today's Free.
ALTER TABLE public.agents DROP COLUMN IF EXISTS free_full_access;
