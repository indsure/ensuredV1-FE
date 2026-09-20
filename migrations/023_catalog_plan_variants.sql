-- 023_catalog_plan_variants.sql
-- Lets one policy wording produce more than one catalogue row.
--
-- A plan sold as Classic / Select / Elite, or Silver / Gold / Platinum, is filed under a single
-- IRDAI UIN. policy_catalog has UNIQUE (uin), so the catalogue holds one row and one ranked
-- value per axis for what are commercially several different products.
--
-- Where the variants differ on an axis the comparison ranks, that single value is wrong for at
-- least one of them. Measured across the live catalogue on 2026-09-20, 42 of 220 comparable
-- plans (19%) carry variant language on a ranked axis. Two examples, both live:
--
--   ReAssure 3.0  room_rent  ranked ordinal 3, display "Variant-based (Classic: General Ward;
--                            Select: Single Private; Elite: Any room)". Classic is really a 1-2
--                            and Elite a 5, so whichever way it is scored it is wrong for one.
--   Health Guard  maternity  ranked exists = TRUE, note "Not covered under Silver Plan". An
--                            advisor comparing for a Silver client is told maternity is included.
--
-- The count is a floor, not a ceiling: it only finds plans whose extraction MENTIONED the split.
-- One that silently picked a variant looks clean in the data and is the more dangerous case.
--
-- WHAT THIS DOES
--   variant   text NOT NULL DEFAULT ''   '' means the product has no variants, which is the
--                                         common case and what every existing row becomes.
--   plan_key  text GENERATED             uin when there is no variant, else uin || ':' || variant.
--
-- plan_key exists so the compare API can keep taking a flat list of strings. Callers that still
-- send a bare UIN resolve to the base variant, so saved comparison_reports rows and any client
-- that has not been updated keep working.
--
-- Additive. Existing rows get variant '' and a plan_key identical to their uin, so nothing that
-- reads this table today changes behaviour.

BEGIN;

ALTER TABLE policy_catalog
  ADD COLUMN IF NOT EXISTS variant text NOT NULL DEFAULT '';

-- Generated rather than maintained by the loader: it cannot drift out of step with its parts.
ALTER TABLE policy_catalog
  ADD COLUMN IF NOT EXISTS plan_key text
  GENERATED ALWAYS AS (CASE WHEN variant = '' THEN uin ELSE uin || ':' || variant END) STORED;

-- UNIQUE (uin) is the thing that makes variants impossible, so it goes. The replacement still
-- refuses two rows for the same variant of the same product.
ALTER TABLE policy_catalog DROP CONSTRAINT IF EXISTS policy_catalog_uin_key;

ALTER TABLE policy_catalog
  ADD CONSTRAINT policy_catalog_uin_variant_key UNIQUE (uin, variant);

-- The compare endpoint looks plans up by this, two to four at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_plan_key ON policy_catalog (plan_key);

-- Resolving a bare UIN to its base variant, and listing the variants of a product, are both
-- hot paths in the picker.
CREATE INDEX IF NOT EXISTS idx_catalog_uin ON policy_catalog (uin);

COMMIT;
