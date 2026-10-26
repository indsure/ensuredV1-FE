-- 028_payments_down.sql
-- Undo of 028_payments.sql. DELETES every payment record. Export payment_orders first.

BEGIN;
DROP TABLE IF EXISTS public.payment_events;
DROP TABLE IF EXISTS public.payment_orders;
ALTER TABLE public.agents DROP COLUMN IF EXISTS plan_expires_at;
ALTER TABLE public.agents DROP COLUMN IF EXISTS checks_period;
ALTER TABLE public.individual_profiles DROP COLUMN IF EXISTS paid_until;
ALTER TABLE public.individual_profiles DROP COLUMN IF EXISTS paid_billing;
COMMIT;
