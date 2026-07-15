-- 003: user-editable nickname on consumer policies ("Papa's health plan").
-- Purely additive; displayed as the card title when set.
ALTER TABLE public.individual_policies ADD COLUMN IF NOT EXISTS nickname TEXT;
