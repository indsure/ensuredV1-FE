-- Undo 039. Drops the renewal outcomes advisors recorded on Home (spoken / renewed / lost).
-- The portal keeps working without the table; the Outcome column just disappears.
BEGIN;
DROP TABLE IF EXISTS public.policy_renewals;
DROP FUNCTION IF EXISTS public.policy_renewals_touch();
COMMIT;
