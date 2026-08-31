-- ============================================================================
-- 019_backfill_partnered_companies.sql
--
-- An agent picks their insurers at signup. That answer lands in `empanelments`
-- and is read by the admin dashboard and nothing else. The cover calculator
-- reads `agents.partnered_companies`, which only the profile page writes. So
-- until an agent re-entered the same insurers by hand, the calculator behaved as
-- though they had no partners at all.
--
-- Going forward SignupStep2 writes both. This backfills the agents who signed up
-- before that: 11 agents have empanelments, 1 has partnered_companies, so 10 are
-- carrying an answer the product ignores.
--
-- HEALTH ONLY, AND BY AN EXPLICIT LIST.
-- The two vocabularies are not two spellings of one thing. Signup offers 24
-- insurers across life, health and general; the profile selector is 28 health
-- insurers. Normalising names and matching on tokens looks like it works and is
-- wrong in the worst way:
--
--     'SBI Life'              -> 'SBI Health Insurance'           different company
--     'Bajaj Allianz Life'    -> 'Bajaj Allianz Health Insurance' different company
--     'Bajaj Allianz General' -> 'Bajaj Allianz Health Insurance' different line
--     'Reliance General'      -> 'Reliance Health Insurance'      different line
--
-- An agent recorded as partnering with SBI Health when they sell SBI Life gets
-- recommendations they cannot place, and nothing about the output looks wrong.
-- So only the seven insurers with a true counterpart are mapped, and life and
-- general selections stay in `empanelments`, which remains the record of
-- everything an agent sells. Mirrors frontend/client/src/lib/data/
-- signup-insurer-map.ts; change both together.
--
-- SAFETY
--   * Only fills rows where partnered_companies is NULL or empty. An agent who
--     has already curated their profile list is never overwritten.
--   * Reads empanelments, writes agents. Deletes nothing.
--   * Idempotent: re-running changes nothing once the column is populated.
--   * An agent whose empanelments hold only life or general insurers is left
--     empty rather than given a wrong partner. Correct, and the same outcome
--     they have today.
-- ============================================================================

BEGIN;

-- The map, as a literal so the migration is self-contained and auditable.
CREATE TEMP TABLE signup_to_partner (signup_name text PRIMARY KEY, partner_name text NOT NULL)
  ON COMMIT DROP;

INSERT INTO signup_to_partner (signup_name, partner_name) VALUES
  ('Star Health',           'Star Health and Allied Insurance'),
  ('Niva Bupa',             'Niva Bupa Health Insurance'),
  ('Care Health Insurance', 'Care Health Insurance'),
  ('HDFC Ergo Health',      'HDFC Ergo Health Insurance'),
  ('ICICI Lombard Health',  'ICICI Lombard Health Insurance'),
  ('Aditya Birla Health',   'Aditya Birla Health Insurance'),
  ('Manipal Cigna',         'ManipalCigna Health Insurance');

WITH mapped AS (
  SELECT e.agent_id,
         array_agg(DISTINCT m.partner_name ORDER BY m.partner_name) AS partners
    FROM empanelments e
    JOIN signup_to_partner m ON m.signup_name = btrim(e.insurer_name)
   GROUP BY e.agent_id
)
UPDATE agents a
   SET partnered_companies = mapped.partners
  FROM mapped
 WHERE a.id = mapped.agent_id
   AND (a.partnered_companies IS NULL OR cardinality(a.partnered_companies) = 0);

COMMIT;

-- Verification, after applying:
--
--   SELECT count(*) FILTER (WHERE cardinality(partnered_companies) > 0) AS with_partners,
--          count(*)                                                     AS total
--     FROM agents;
--
-- Agents left empty are those whose empanelments contain no health insurer.
-- That is the intended result, not a failure:
--
--   SELECT e.agent_id, array_agg(e.insurer_name) AS unmapped
--     FROM empanelments e
--     JOIN agents a ON a.id = e.agent_id
--    WHERE a.partnered_companies IS NULL OR cardinality(a.partnered_companies) = 0
--    GROUP BY e.agent_id;
