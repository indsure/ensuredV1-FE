-- 028_payments.sql
-- Cashfree one-time payments (plan: docs/plans/2026-10-26-cashfree-payments.md, "tonight" slice).
-- Sells agent_monthly / agent_yearly / topup_5 / topup_15 to advisors and personal_monthly /
-- personal_yearly to consumers. No mandates, no auto-renew: each period is paid by hand.
--
-- ADDITIVE ONLY: two new tables, four new nullable columns. Beta and prod share one Supabase,
-- so this lands on prod the moment it runs. Idempotent; safe to re-run.
--
-- Access: RLS enabled with NO policies on both new tables (as in 024/025), so only the backend's
-- service connection can read or write them. The new columns sit on agents and
-- individual_profiles, whose browser write access 026 already removed (agents keeps only its
-- profile columns), so a browser cannot extend its own plan.
--
-- Undo: 028_payments_down.sql.

BEGIN;

-- One row per Cashfree order. order_ref is what we send to Cashfree as order_id.
CREATE TABLE IF NOT EXISTS public.payment_orders (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_ref         text NOT NULL UNIQUE,
  account_kind      text NOT NULL CHECK (account_kind IN ('agent', 'individual')),
  -- Kept (SET NULL) when the account is deleted: payment records outlive the account.
  account_id        uuid,
  sku               text NOT NULL,
  amount_paise      integer NOT NULL CHECK (amount_paise > 0),
  status            text NOT NULL DEFAULT 'created'
                    CHECK (status IN ('created', 'pending', 'paid', 'expired', 'refunded')),
  cf_order_id       text,
  cf_payment_id     text,
  payment_method    text,
  period_start      timestamptz,
  period_end        timestamptz,
  checks_granted    integer NOT NULL DEFAULT 0,
  granted_at        timestamptz,
  paid_at           timestamptz,
  refunded_at       timestamptz,
  -- Renewal reminder emails sent for this period (3 days before the end, and at the end).
  reminded_before_at timestamptz,
  reminded_end_at   timestamptz,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_orders_account_idx ON public.payment_orders (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_orders_open_idx ON public.payment_orders (status, created_at)
  WHERE status IN ('created', 'pending');

-- One row per webhook delivery (dedupe on Cashfree's x-idempotency-key, plus an audit trail).
CREATE TABLE IF NOT EXISTS public.payment_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key   text UNIQUE,
  event_type        text,
  order_ref         text,
  raw_body          text NOT NULL,
  received_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_events_order_idx ON public.payment_events (order_ref);

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_orders FROM anon, authenticated;
REVOKE ALL ON public.payment_events FROM anon, authenticated;

-- Paid-until dates. NULL = no end date (every plan set by hand before payments existed; the
-- founder chose to leave those as they are, 2026-10-26).
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz;
-- 'YYYY-MM' (IST) of the last monthly check grant on a yearly plan; the refill job uses it.
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS checks_period text;
ALTER TABLE public.individual_profiles ADD COLUMN IF NOT EXISTS paid_until timestamptz;
ALTER TABLE public.individual_profiles ADD COLUMN IF NOT EXISTS paid_billing text;

COMMIT;
