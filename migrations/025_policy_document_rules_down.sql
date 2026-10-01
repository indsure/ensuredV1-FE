-- 025_policy_document_rules_down.sql
-- Reverses 025_policy_document_rules.sql exactly. Touches ONLY the five new tables and the
-- trigger function; clients, extracted_data and stored PDFs are untouched.
--
-- IRREVERSIBLE for advisor reviews and corrections recorded in these tables. Only run before
-- any production review data exists, or after exporting it (see the deploy notes).

DROP TABLE IF EXISTS rule_review_events;
DROP TABLE IF EXISTS policy_rule_facts;
DROP TABLE IF EXISTS policy_document_parses;
DROP TABLE IF EXISTS policy_source_documents;
DROP TABLE IF EXISTS product_rule_sets;
DROP FUNCTION IF EXISTS policy_rules_no_update();
