-- Undo 034. Revert the backend first: /api/compare/recommend reads this table for any advisor
-- session and would fail for them without it. Dropping it loses every advisor's list.
DROP TABLE IF EXISTS public.agent_preferred_plans;
