-- 033: let a consumer own a cover calculation.
--
-- calculator_reports.agent_id is a foreign key to agents(id), so it can only ever hold an
-- advisor. A consumer who presses "Check My Existing Policy" on a calculator report now signs
-- in and the calculation is saved to their account, so the portfolio can show ideal cover
-- against the cover they hold. That needs its own owner column pointing at auth.users.
--
-- It also fixes a live failure: /api/calculator/save-report stamped ANY bearer token into
-- agent_id, so a signed-in consumer saving a calculation hit the agents foreign key and got
-- "Failed to save report". The backend now stamps advisors into agent_id and consumers into
-- user_id. Deleting the account deletes the row (ON DELETE CASCADE), which matches
-- INDIVIDUAL_TABLES in backend/server/services/accountData.ts.
--
-- Run BEFORE deploying the backend that reads it. Idempotent. Undo: 033_calculator_reports_user_id_down.sql.

ALTER TABLE public.calculator_reports
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS calculator_reports_user_id_created_idx
  ON public.calculator_reports (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- Check:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'calculator_reports' AND column_name = 'user_id';
--   -> user_id
