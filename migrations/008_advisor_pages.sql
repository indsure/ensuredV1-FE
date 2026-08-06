-- ============================================================================
-- 008_advisor_pages.sql
-- Advisor landing pages: a public, per-agent page (indsure.in/a/<slug>) that an
-- advisor can share on WhatsApp, in an Instagram bio, or as a printed QR code.
-- Everything submitted on it lands in that agent's existing /agent/leads.
--
-- Deliberately NOT on this page: firm name, designation, licence number. We
-- hold no verified licence data, and printing an unverified credential on our
-- own domain reads to a visitor as a check we performed. The page carries only
-- name, photo, city and spoken languages, so nothing on it is a claim that
-- needs backing. That also means no free-text field for an advisor to fill.
--
-- Additive + idempotent. Safe to run against the live DB more than once.
-- Run in the Supabase SQL editor or via run_migrations.mjs.
-- ============================================================================

-- ─── 1. The page itself ────────────────────────────────────────────────────
-- Two independent flags, and they mean different things:
--   enabled   — WE allow this agent to have a page at all (the allowlist).
--               Only the service role can change it; a trigger below enforces
--               that, so an agent cannot grant themselves a public URL.
--   published — the AGENT has finished setting it up and wants it live.
-- A page is publicly readable only when both are true.
CREATE TABLE IF NOT EXISTS public.agent_pages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id          UUID NOT NULL UNIQUE REFERENCES public.agents(id) ON DELETE CASCADE,

  -- Permanent. Advisors print this as a QR code on visiting cards and society
  -- standees, so a slug that changes is a dead standee. Assigned by us.
  slug              TEXT NOT NULL UNIQUE
                      CHECK (slug ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$'),

  display_name      TEXT NOT NULL,
  photo_url         TEXT,
  city              TEXT,

  -- Languages the advisor actually SPEAKS (a trust signal on the page). Wider
  -- than the languages the page is written in — an advisor may speak Marathi
  -- while the page copy is only EN/HI for now.
  languages         TEXT[] NOT NULL DEFAULT '{}',

  -- Which of the four lines this advisor handles. Stored as canonical English
  -- values, never the translated label the visitor saw, so the leads portal
  -- filters keep working when someone submits the form in Hindi.
  lines_of_business TEXT[] NOT NULL DEFAULT '{}'
                      CHECK (lines_of_business <@ ARRAY['term','health','life','vehicle']::TEXT[]),

  -- Which language the page opens in, and which the link-preview card renders
  -- in. Only EN/HI have translated copy today.
  primary_locale    TEXT NOT NULL DEFAULT 'en' CHECK (primary_locale IN ('en','hi')),

  -- Advisors often keep a business WhatsApp number separate from the login
  -- phone on their profile, so this is its own field rather than reusing it.
  whatsapp_number   TEXT,

  enabled           BOOLEAN NOT NULL DEFAULT false,
  published         BOOLEAN NOT NULL DEFAULT false,
  published_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Slugs that would collide with real routes, infrastructure hostnames, or read
-- as an official IndSure page. Enforced in the DB so a bug in the admin tool
-- can never mint one.
CREATE TABLE IF NOT EXISTS public.reserved_slugs (slug TEXT PRIMARY KEY);

INSERT INTO public.reserved_slugs (slug) VALUES
  ('www'),('api'),('app'),('beta'),('admin'),('mail'),('login'),('signup'),
  ('agent'),('agents'),('blog'),('learn'),('team'),('help'),('pricing'),
  ('report'),('reports'),('compare'),('calculator'),('policychecker'),
  ('indsure'),('official'),('support'),('sach'),('irdai'),('lic')
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.agent_pages
  DROP CONSTRAINT IF EXISTS agent_pages_slug_not_reserved;

-- SECURITY DEFINER matters here. reserved_slugs has RLS on and no policy, so a
-- plain (invoker-rights) function would read zero rows for any end user and the
-- CHECK below would silently pass for every reserved slug — the constraint would
-- look present and enforce nothing.
CREATE OR REPLACE FUNCTION public.slug_is_reserved(s TEXT) RETURNS BOOLEAN
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT EXISTS (SELECT 1 FROM public.reserved_slugs WHERE slug = s) $$;

ALTER TABLE public.agent_pages
  ADD CONSTRAINT agent_pages_slug_not_reserved
  CHECK (NOT public.slug_is_reserved(slug));

CREATE INDEX IF NOT EXISTS idx_agent_pages_live
  ON public.agent_pages(slug) WHERE enabled AND published;

-- ─── 2. Agents cannot self-grant a page, or move a printed slug ─────────────
-- RLS can gate whole rows but not individual columns, so the two fields an
-- agent must never touch are pinned back to their old values on every update
-- that does not come from the service role.
CREATE OR REPLACE FUNCTION public.agent_pages_protect_admin_fields()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  -- '' when nobody presented a JWT — which covers the backend's direct pg pool
  -- as well as psql/the SQL editor. 'service_role' when the backend goes through
  -- supabase-js with the service key. 'authenticated' when it is a signed-in
  -- agent editing their own page from the browser, which is the case we pin.
  jwt_role TEXT := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  );
BEGIN
  IF jwt_role NOT IN ('', 'service_role') THEN
    NEW.enabled := OLD.enabled;
    NEW.slug    := OLD.slug;
  END IF;

  -- Stamp the moment it first went live, for the admin digest of new pages.
  IF NEW.published AND NOT OLD.published THEN
    NEW.published_at := now();
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agent_pages_protect ON public.agent_pages;
CREATE TRIGGER trg_agent_pages_protect
  BEFORE UPDATE ON public.agent_pages
  FOR EACH ROW EXECUTE FUNCTION public.agent_pages_protect_admin_fields();

-- ─── 3. RLS ────────────────────────────────────────────────────────────────
ALTER TABLE public.agent_pages ENABLE ROW LEVEL SECURITY;

-- Anyone on the internet may read a page that we enabled AND the agent
-- published — and nothing else. The table holds no contact data beyond the
-- advisor's own business WhatsApp number, which is the point of the page.
DROP POLICY IF EXISTS "public_read_live_advisor_pages" ON public.agent_pages;
CREATE POLICY "public_read_live_advisor_pages" ON public.agent_pages
  FOR SELECT
  TO anon, authenticated
  USING (enabled AND published);

-- An agent can see and edit their own row, live or not — but NOT create or
-- delete one. Rows are minted by us when we allowlist an advisor, and the slug
-- comes with the row.
--
-- This split is load-bearing, not tidiness: with a FOR ALL policy an agent could
-- INSERT their own row and the protect-trigger below would not stop them, since
-- it only fires on UPDATE. They could squat 'admin' or 'indsure' before we ever
-- assigned them anything.
DROP POLICY IF EXISTS "agents_own_page" ON public.agent_pages;
DROP POLICY IF EXISTS "agents_read_own_page" ON public.agent_pages;
CREATE POLICY "agents_read_own_page" ON public.agent_pages
  FOR SELECT
  TO authenticated
  USING (agent_id = auth.uid());

DROP POLICY IF EXISTS "agents_edit_own_page" ON public.agent_pages;
CREATE POLICY "agents_edit_own_page" ON public.agent_pages
  FOR UPDATE
  TO authenticated
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

ALTER TABLE public.reserved_slugs ENABLE ROW LEVEL SECURITY;
-- No policy: nobody but the service role reads or writes this. The CHECK
-- constraint calls slug_is_reserved(), which is STABLE and runs as the table
-- owner, so enforcement does not depend on the caller being able to SELECT it.

-- ─── 4. The denominator ────────────────────────────────────────────────────
-- Lead counts alone cannot tell you whether an ad worked: 3 leads from 20 views
-- is a good ad, 3 from 2,000 is a bad one. Rolled up per page/day/source rather
-- than one row per visitor, so this stays small and holds no personal data at
-- all — no IP, no user agent, nothing that identifies a reader.
CREATE TABLE IF NOT EXISTS public.advisor_page_views (
  page_id     UUID NOT NULL REFERENCES public.agent_pages(id) ON DELETE CASCADE,
  viewed_on   DATE NOT NULL DEFAULT CURRENT_DATE,
  utm_source  TEXT NOT NULL DEFAULT 'direct',
  views       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (page_id, viewed_on, utm_source)
);

ALTER TABLE public.advisor_page_views ENABLE ROW LEVEL SECURITY;

-- Agents read their own numbers. Writes happen only through the backend with
-- the service-role key, so there is no INSERT/UPDATE policy here on purpose.
DROP POLICY IF EXISTS "agents_own_page_views" ON public.advisor_page_views;
CREATE POLICY "agents_own_page_views" ON public.advisor_page_views
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.agent_pages p
    WHERE p.id = advisor_page_views.page_id AND p.agent_id = auth.uid()
  ));

-- ─── 5. Storage: advisor headshots ─────────────────────────────────────────
-- A PUBLIC bucket, unlike policy-pdfs. The photo has to be readable by
-- strangers and, more importantly, by Facebook's and WhatsApp's link-preview
-- crawlers — which cache an image for weeks, so a signed URL would break the
-- preview card as soon as it expired. Only headshots go here; nothing private.
INSERT INTO storage.buckets (id, name, public)
VALUES ('advisor-photos', 'advisor-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "advisor_photos_public_read" ON storage.objects;
CREATE POLICY "advisor_photos_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'advisor-photos');

-- An agent writes only inside their own uid-named folder, so one advisor can
-- never overwrite another's headshot.
DROP POLICY IF EXISTS "advisor_photos_own_write" ON storage.objects;
CREATE POLICY "advisor_photos_own_write" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'advisor-photos' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'advisor-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ─── 6. Where the lead came from, and what it consented to ─────────────────
-- All nullable and additive: existing leads (manual, admin-pushed) simply carry
-- NULL here and every current query keeps working untouched.
ALTER TABLE public.agent_leads
  ADD COLUMN IF NOT EXISTS utm_source    TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium    TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign  TEXT,
  ADD COLUMN IF NOT EXISTS landing_slug  TEXT,
  -- Verbatim consent sentence the visitor ticked, including the advisor's name
  -- as it was shown to them. Stored as text, not a boolean, because what they
  -- agreed to is the thing that matters if they later ask us about it.
  ADD COLUMN IF NOT EXISTS consent_text  TEXT,
  ADD COLUMN IF NOT EXISTS consent_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_ip    TEXT,
  -- The public form has no phone verification by design (agents call every lead
  -- anyway), so the agent gets a one-tap way to bury junk instead.
  ADD COLUMN IF NOT EXISTS is_spam       BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_agent_leads_landing
  ON public.agent_leads(agent_id, landing_slug)
  WHERE landing_slug IS NOT NULL;

-- ============================================================================
-- Rollback (manual, if ever needed):
--   DROP TABLE public.advisor_page_views;
--   DROP TABLE public.agent_pages;
--   DROP TABLE public.reserved_slugs;
--   DROP FUNCTION public.agent_pages_protect_admin_fields();
--   DROP FUNCTION public.slug_is_reserved(TEXT);
--   ALTER TABLE public.agent_leads
--     DROP COLUMN utm_source, DROP COLUMN utm_medium, DROP COLUMN utm_campaign,
--     DROP COLUMN landing_slug, DROP COLUMN consent_text, DROP COLUMN consent_at,
--     DROP COLUMN consent_ip, DROP COLUMN is_spam;
-- ============================================================================
