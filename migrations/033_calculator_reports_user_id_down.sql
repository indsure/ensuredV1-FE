-- Undo 033. Revert the backend first: it writes and reads user_id, and the save route would
-- fail for signed-in consumers again without it. Dropping the column loses which consumer
-- owns which calculation; the calculations themselves stay.
DROP INDEX IF EXISTS public.calculator_reports_user_id_created_idx;
ALTER TABLE public.calculator_reports DROP COLUMN IF EXISTS user_id;
