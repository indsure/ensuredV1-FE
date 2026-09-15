-- ============================================================================
-- 021_policy_name_provenance.sql
--
-- Lets a policy say "we could not read the plan name" instead of inventing one.
--
-- THE BUG
-- clients.policy_name was a plain string with no record of where it came from.
-- The extractor had four rules for producing it, three of which read the
-- document and one of which guessed from an alias list, and the guess was
-- stored exactly like a reading. A Tata AIG MediCare Premier policy came out as
-- "Optima Restore" - a rival insurer's product - because the document mentions
-- a "Restore Benefit", which most health policies have. That name was then
-- printed on the customer-facing shared report as fact.
--
-- WHAT CHANGES
-- policy_name now holds only names actually found in the policy document.
-- When the name cannot be read, policy_name is left NULL and the best guess
-- goes to policy_name_suggested, which the advisor is offered and must accept
-- before it becomes the policy's name. A suggestion is never shown to a
-- customer and never leaves the agent portal.
--
-- WHY A SEPARATE COLUMN RATHER THAN A CONFIDENCE FLAG
-- A flag still leaves the wrong name sitting in the field every reader already
-- trusts - reports, exports, search, the customer's PDF. Every one of those
-- would need to learn about the flag, and any that forgot would keep printing
-- the guess. Moving the guess out of the field is the change that cannot be
-- forgotten downstream.
--
-- Existing rows are untouched: they keep whatever name they were given, and
-- policy_name_source stays NULL, meaning "recorded before we tracked this".
-- Re-running a policy's analysis is what re-derives it under the new rule.
-- ============================================================================

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS policy_name_suggested text,
  ADD COLUMN IF NOT EXISTS policy_name_source    text;

COMMENT ON COLUMN clients.policy_name IS
  'Plan name READ FROM the policy document. Never a guess. NULL means we could not read it - check policy_name_suggested.';
COMMENT ON COLUMN clients.policy_name_suggested IS
  'Best guess at the plan name when it could not be read from the document. Agent-facing only; must be accepted before it becomes policy_name.';
COMMENT ON COLUMN clients.policy_name_source IS
  'Which extraction rule produced the name: CIS Product Name, Plan Name, Product name, UIN, Alias Map Fallback. NULL for rows written before provenance was tracked.';
