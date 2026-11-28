-- Undo 040. Removes the links only; no policy or claim is touched.
BEGIN;
DROP INDEX IF EXISTS public.clients_renewed_from_idx;
DROP INDEX IF EXISTS public.claims_client_id_idx;
ALTER TABLE public.clients DROP COLUMN IF EXISTS renewed_from;
ALTER TABLE public.claims  DROP COLUMN IF EXISTS client_id;
COMMIT;
