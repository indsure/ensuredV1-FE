-- 040_policy_links.sql
-- Two optional links, both additive and nullable:
--   clients.renewed_from : the policy this one replaced, so the old one leaves the renewal lists.
--   claims.client_id     : the policy a claim is made on.
-- Beta and prod share one Supabase. Nothing existing reads these columns; the portal and the
-- server keep working without them (the link is simply not stored). Undo: 040_policy_links_down.sql
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS renewed_from uuid REFERENCES public.clients(id) ON DELETE SET NULL;
ALTER TABLE public.claims  ADD COLUMN IF NOT EXISTS client_id    uuid REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS clients_renewed_from_idx ON public.clients (renewed_from) WHERE renewed_from IS NOT NULL;
CREATE INDEX IF NOT EXISTS claims_client_id_idx     ON public.claims (client_id)     WHERE client_id IS NOT NULL;

COMMIT;

-- Verify (expect 2 rows):
--   SELECT table_name, column_name FROM information_schema.columns
--   WHERE table_schema = 'public' AND (table_name, column_name) IN (('clients','renewed_from'), ('claims','client_id'));
