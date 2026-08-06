-- ============================================================================
-- 009_advisor_page_analytics.sql
-- Where advisor-page traffic actually comes from: which app the link was opened
-- in, and on what kind of device.
--
-- Why this beats UTM tags on their own: advisors paste bare links. Instagram,
-- Facebook and WhatsApp in-app browsers each announce themselves in the
-- User-Agent, so the channel is recoverable even when nobody tagged anything.
--
-- Two deliberately different privacy postures, because the two cases are not
-- the same:
--   VIEWS  — anonymous strangers who have consented to nothing. Stays a COUNT
--            per (page, day, source, app, device). No row per visitor, no IP,
--            no user-agent string retained. A per-visitor record here would add
--            liability and zero capability: with no contact details there is
--            nothing an advisor could do with it.
--   LEADS  — gave a name, a phone and explicit consent, and the advisor is
--            about to ring them. Context is attached to the lead itself.
--
-- Not collected, on purpose: precise/GPS location (needs a permission prompt
-- that would wreck conversion) and IP-derived city (Indian mobile carriers
-- route huge subscriber pools through a few gateways, so it is confidently
-- wrong — a Nashik user resolving to Mumbai is worse than no answer).
--
-- Additive + idempotent. Safe to run against the live DB more than once.
-- ============================================================================

-- ─── 1. Widen the view rollup ──────────────────────────────────────────────
-- Still a counter, just with more dimensions on the key.
ALTER TABLE public.advisor_page_views
  ADD COLUMN IF NOT EXISTS app    TEXT NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS device TEXT NOT NULL DEFAULT 'unknown';

-- The primary key has to grow with the dimensions, otherwise the ON CONFLICT
-- upsert would fold every app into one row. Postgres cannot extend a PK in
-- place, so drop and recreate it; the table holds counters only, and the
-- existing rows keep their values with the new columns defaulted.
ALTER TABLE public.advisor_page_views
  DROP CONSTRAINT IF EXISTS advisor_page_views_pkey;

ALTER TABLE public.advisor_page_views
  ADD CONSTRAINT advisor_page_views_pkey
  PRIMARY KEY (page_id, viewed_on, utm_source, app, device);

COMMENT ON COLUMN public.advisor_page_views.app IS
  'In-app browser the page was opened in: instagram | facebook | whatsapp | telegram | browser | other. Derived from User-Agent at request time; the UA string itself is never stored.';
COMMENT ON COLUMN public.advisor_page_views.device IS
  'mobile | tablet | desktop | unknown.';

-- ─── 2. Context on the lead ────────────────────────────────────────────────
-- These sit alongside the utm_* columns from 008. The visitor consented and the
-- advisor is going to call them, so knowing they came from Instagram on an
-- iPhone is useful context on the card rather than surveillance.
ALTER TABLE public.agent_leads
  ADD COLUMN IF NOT EXISTS source_app    TEXT,
  ADD COLUMN IF NOT EXISTS source_device TEXT,
  ADD COLUMN IF NOT EXISTS source_os     TEXT,
  -- Usually empty: Instagram and WhatsApp strip the referrer most of the time.
  ADD COLUMN IF NOT EXISTS referrer      TEXT;

-- ============================================================================
-- Rollback (manual, if ever needed):
--   ALTER TABLE public.advisor_page_views DROP CONSTRAINT advisor_page_views_pkey;
--   ALTER TABLE public.advisor_page_views
--     ADD CONSTRAINT advisor_page_views_pkey PRIMARY KEY (page_id, viewed_on, utm_source);
--   ALTER TABLE public.advisor_page_views DROP COLUMN app, DROP COLUMN device;
--   ALTER TABLE public.agent_leads
--     DROP COLUMN source_app, DROP COLUMN source_device,
--     DROP COLUMN source_os, DROP COLUMN referrer;
-- ============================================================================
