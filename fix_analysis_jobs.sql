-- ===================================================
-- FIX: analysis_jobs schema vs code mismatch
-- Applied to the live Supabase on 2026-06-16 (additive, safe).
-- The Express job store (persistJob/loadJobFromDB) writes columns/enum values
-- that the table didn't have, so every analyze logged "Failed to persist job".
-- ===================================================

-- 1) The code writes job.createdAt (epoch ms) to created_at; column was missing.
ALTER TABLE analysis_jobs ADD COLUMN IF NOT EXISTS created_at bigint;

-- 2) The code writes status values 'pending'/'processing'/'completed' but the
--    job_status enum only had queued/running/succeeded/failed/cancelled.
ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'processing';
ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'completed';

-- NOTE (not fixed in SQL): analysis_jobs.policy_id has FK
-- analysis_jobs_policy_id_fkey1 -> policies(id), but the code stores a
-- clients.id there. The mapping UPDATE is now wrapped in try/catch in
-- routes.ts so it can't abort uploads. Proper fix = repoint/drop that FK or
-- align the jobs schema with the clients-based flow.
