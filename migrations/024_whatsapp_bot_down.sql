-- 024_whatsapp_bot_down.sql
-- Unplugs the WhatsApp channel's data. Reverses 024_whatsapp_bot.sql exactly.
--
-- Touches ONLY the five WhatsApp tables. Policies, customers, reports, share links and
-- check balances live in the shared tables and are untouched: a policy an advisor checked
-- over WhatsApp stays in their book like any portal upload.
--
-- IRREVERSIBLE for the WhatsApp message log, links and job history. Export first if the
-- beta metrics are still wanted (see whatsapp-bot/metrics.sql).

DROP TABLE IF EXISTS wa_job;
DROP TABLE IF EXISTS wa_message;
DROP TABLE IF EXISTS wa_conversation;
DROP TABLE IF EXISTS whatsapp_link;
DROP TABLE IF EXISTS wa_allowlist;
