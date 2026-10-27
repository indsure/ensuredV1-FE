-- Undo 030. Run only after rolling the backend back to a version without individual_check_log.
DROP TABLE IF EXISTS public.individual_check_log;
REVOKE UPDATE (firm_name) ON public.agents FROM authenticated;
ALTER TABLE public.agents DROP COLUMN IF EXISTS firm_name;
-- grievance_requests is left alone: it holds statutory records.
