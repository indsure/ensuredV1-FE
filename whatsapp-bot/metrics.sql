-- WhatsApp beta metrics (brief section 14). Read-only. Run in the Supabase SQL editor.

-- 1. Time to acknowledgment: first bot reply after each inbound message, p50 / p95 (seconds).
WITH inbound AS (
  SELECT id, agent_id, created_at FROM wa_message
   WHERE direction = 'in' AND agent_id IS NOT NULL AND created_at > now() - interval '7 days'
), ack AS (
  SELECT i.id, EXTRACT(EPOCH FROM (
    SELECT min(o.created_at) FROM wa_message o
     WHERE o.agent_id = i.agent_id AND o.direction = 'out' AND o.created_at >= i.created_at
  ) - i.created_at) AS secs
  FROM inbound i
)
SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY secs) AS p50_s,
       percentile_cont(0.95) WITHIN GROUP (ORDER BY secs) AS p95_s,
       count(*) AS messages
  FROM ack WHERE secs IS NOT NULL;

-- 2. PDF to report, p50 / p95 (seconds), and outcomes.
SELECT status, count(*) AS jobs,
       percentile_cont(0.5)  WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM finished_at - queued_at)) AS p50_s,
       percentile_cont(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM finished_at - queued_at)) AS p95_s
  FROM wa_job WHERE queued_at > now() - interval '7 days'
 GROUP BY status;

-- 3. Failure reasons.
SELECT failure_reason, count(*) FROM wa_job
 WHERE status IN ('failed', 'needs_attention') AND queued_at > now() - interval '7 days'
 GROUP BY 1 ORDER BY 2 DESC;

-- 4. Share of health checks that came in over WhatsApp (last 7 days, beta advisors only).
SELECT
  (SELECT count(*) FROM wa_job j JOIN wa_allowlist w USING (agent_id)
    WHERE j.insurance_type = 'health' AND j.status = 'done' AND j.queued_at > now() - interval '7 days') AS via_whatsapp,
  (SELECT count(*) FROM clients c JOIN wa_allowlist w ON w.agent_id = c.agent_id
    WHERE c.insurance_type = 'health' AND c.status = 'done' AND c.created_at > now() - interval '7 days') AS all_health;

-- 5. Weekly active advisors on WhatsApp.
SELECT date_trunc('week', created_at) AS week, count(DISTINCT agent_id) AS advisors
  FROM wa_message WHERE direction = 'in' AND agent_id IS NOT NULL GROUP BY 1 ORDER BY 1 DESC;

-- 6. What advisors asked that the bot did not understand (drives phase 2 intents).
SELECT o.created_at, i.body_redacted
  FROM wa_message o
  JOIN LATERAL (
    SELECT body_redacted FROM wa_message i
     WHERE i.agent_id = o.agent_id AND i.direction = 'in' AND i.created_at <= o.created_at
     ORDER BY i.created_at DESC LIMIT 1
  ) i ON true
 WHERE o.direction = 'out' AND o.intent = 'unknown'
 ORDER BY o.created_at DESC LIMIT 100;

-- 7. Share drafts made, and whether the customer opened the report afterwards.
SELECT count(*) AS share_drafts FROM wa_message WHERE direction = 'out' AND intent = 'share';

-- 8. Number-guard fires and not-in-report answers (should be near zero / low).
SELECT intent, count(*) FROM wa_message
 WHERE direction = 'out' AND intent IN ('ask', 'ask_phrased', 'ask_guard_fired', 'ask_not_in_report')
 GROUP BY 1;
