/* =========================================================
   PAYMENTS (Cashfree Payment Gateway, one-time orders)

   Plan: docs/plans/2026-10-26-cashfree-payments.md ("tonight" slice, founder 2026-10-26).
   Sells Agent monthly/yearly and check top-ups to advisors, Personal monthly/yearly to
   consumers. No mandates, no auto-renew: every period is a payment the customer makes.

   The one rule: the browser never decides that money arrived. An order becomes "paid" only
   when Cashfree's own Get Order API says PAID and the amount matches ours. Three paths reach
   that check (webhook, the status poll from the pay screen, the reconciliation job) and all
   go through syncOrder() -> grantOrder(), which is safe to call any number of times.

   Talks to Cashfree's REST API with fetch + crypto (no SDK), API version 2026-01-01.
   Contract: .claude/skills/pg/apis/SKILL.md and pg/webhooks/SKILL.md.

   Env (backend only, never VITE_*, never in git: the repo is public):
     CASHFREE_APP_ID, CASHFREE_SECRET_KEY, CASHFREE_ENV = sandbox | production
     PAYMENTS_WEBHOOK_URL  public https URL of POST /api/pay/cashfree/webhook (sent per order
                           as notify_url, so no dashboard webhook setup is needed)
     PUBLIC_SITE_URL       fallback for the return URL (default https://indsure.in)
   With no keys, every pay route answers 503 "payments are not switched on" and nothing else
   in the app changes.
   ========================================================= */

import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { pool as realPool } from "../lib/db";
import { log } from "../lib/logger";
import { sendMail } from "../lib/mailer";

// The pool, swappable only so tests/payments.test.ts can run this file against PGlite.
type Db = { query: (sql: string, params?: unknown[]) => Promise<any>; connect: () => Promise<any> };
let pool: Db = realPool as unknown as Db;
export function __setPaymentsDbForTests(db: Db): void {
  pool = db;
}

const API_VERSION = "2026-01-01";
const ORDER_TTL_MIN = 30;
const GRACE_DAYS = 3;
const MAX_OPEN_ORDERS = 3;

export type Sku =
  | "agent_monthly" | "agent_yearly" | "topup_5" | "topup_15"
  | "personal_monthly" | "personal_yearly";

type SkuDef = {
  kind: "agent" | "individual";
  label: string;
  amountPaise: number;
  months: number;   // 0 = no period (top-up)
  checks: number;   // added to agent_credits on grant
};

// THE price list. Pages must show these numbers; the browser never sends an amount.
export const SKUS: Record<Sku, SkuDef> = {
  agent_monthly:    { kind: "agent", label: "Agent plan, 1 month", amountPaise: 1499_00, months: 1, checks: 12 },
  agent_yearly:     { kind: "agent", label: "Agent plan, 1 year", amountPaise: 14990_00, months: 12, checks: 12 },
  topup_5:          { kind: "agent", label: "5 policy checks", amountPaise: 449_00, months: 0, checks: 5 },
  topup_15:         { kind: "agent", label: "15 policy checks", amountPaise: 1199_00, months: 0, checks: 15 },
  personal_monthly: { kind: "individual", label: "Personal plan, 1 month", amountPaise: 99_00, months: 1, checks: 0 },
  personal_yearly:  { kind: "individual", label: "Personal plan, 1 year", amountPaise: 999_00, months: 12, checks: 0 },
};

const isSku = (s: unknown): s is Sku => typeof s === "string" && Object.prototype.hasOwnProperty.call(SKUS, s);

/* ---------- config ---------- */

function cfConfig() {
  const appId = process.env.CASHFREE_APP_ID?.trim() || "";
  const secret = process.env.CASHFREE_SECRET_KEY?.trim() || "";
  const env = (process.env.CASHFREE_ENV || "sandbox").trim().toLowerCase();
  if (!appId || !secret) return null;
  const production = env === "production";
  // A key from the other environment switches payments off (never the whole server):
  // TEST_ keys fail every real payment, and a live key on sandbox settings is a config slip.
  if (production === appId.startsWith("TEST")) return null;
  return {
    appId,
    secret,
    production,
    // CASHFREE_API_BASE exists for the test suite's fake Cashfree; never set it on a server.
    base: process.env.CASHFREE_API_BASE || (production ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg"),
  };
}

// Boot-time line in the logs saying whether payments are on, and why not.
export function checkPaymentsConfig(): void {
  const cfg = cfConfig();
  if (cfg) {
    log.info(`[pay] Cashfree ${cfg.production ? "PRODUCTION" : "sandbox"} configured`);
  } else if (process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY) {
    log.error("[pay] PAYMENTS OFF: CASHFREE_ENV does not match the key (TEST_ keys need sandbox, live keys need production)");
  } else {
    log.info("[pay] Cashfree keys not set; payments are off");
  }
}

async function cf(method: "GET" | "POST", path: string, body?: unknown): Promise<any> {
  const cfg = cfConfig();
  if (!cfg) throw new PayError(503, "PAYMENTS_OFF", "Payments are not switched on yet.");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const r = await fetch(cfg.base + path, {
      method,
      signal: ctrl.signal,
      headers: {
        "x-client-id": cfg.appId,
        "x-client-secret": cfg.secret,
        "x-api-version": API_VERSION,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await r.json().catch(() => null);
    if (!r.ok) {
      // Cashfree's message is safe to log (no secrets); never echo it to the browser.
      log.warn("[pay] cashfree error", { path, status: r.status, code: json?.code, message: json?.message });
      throw new PayError(502, "GATEWAY_ERROR", "The payment service did not respond. Please try again.");
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

class PayError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

/* ---------- time ---------- */

const IST_OFFSET_MS = 330 * 60 * 1000;

// 'YYYY-MM' of a moment, in India time.
export function istMonth(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 7);
}

// Same calendar day n months later in India time, clamped to the month's last day
// (31 Jan + 1 month = 28/29 Feb). Keeps the time of day.
export function addMonthsIst(base: Date, months: number): Date {
  const local = new Date(base.getTime() + IST_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth() + months;
  const day = local.getUTCDate();
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const out = new Date(Date.UTC(
    y, m, Math.min(day, lastDay),
    local.getUTCHours(), local.getUTCMinutes(), local.getUTCSeconds(), local.getUTCMilliseconds(),
  ));
  return new Date(out.getTime() - IST_OFFSET_MS);
}

/* ---------- accounts ---------- */

type Account = {
  kind: "agent" | "individual";
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  plan: string;
  expiresAt: Date | null;
};

async function loadAccount(userId: string): Promise<Account | null> {
  const a = await pool.query(
    "SELECT id, email, full_name, name, phone, plan, plan_expires_at FROM agents WHERE id = $1",
    [userId],
  );
  if (a.rows[0]) {
    const r = a.rows[0];
    return {
      kind: "agent", id: r.id, email: r.email, name: r.full_name || r.name,
      phone: r.phone, plan: String(r.plan || "free").toLowerCase(), expiresAt: r.plan_expires_at,
    };
  }
  const p = await pool.query(
    "SELECT id, email, full_name, phone, plan, paid_until FROM individual_profiles WHERE id = $1",
    [userId],
  );
  if (p.rows[0]) {
    const r = p.rows[0];
    return {
      kind: "individual", id: r.id, email: r.email, name: r.full_name,
      phone: r.phone, plan: String(r.plan || "free").toLowerCase(), expiresAt: r.paid_until,
    };
  }
  return null;
}

// Cashfree needs a 10-digit Indian mobile. Accepts +91 / 0 prefixes and spaces.
export function normalisePhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let d = raw.replace(/[^\d]/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

function planActive(acc: Account, now = new Date()): boolean {
  if (acc.plan === "free") return false;
  if (!acc.expiresAt) return true; // set by hand before payments existed: no end date
  return acc.expiresAt.getTime() + GRACE_DAYS * 86400_000 > now.getTime();
}

/* ---------- return URL ---------- */

// Only our own sites get the shopper back; anything else falls back to PUBLIC_SITE_URL.
function returnBase(req: Request): string {
  const fallback = (process.env.PUBLIC_SITE_URL || "https://indsure.in").replace(/\/+$/, "");
  const origin = String(req.headers.origin || "");
  try {
    const u = new URL(origin);
    const h = u.hostname;
    const ours =
      h === "indsure.in" || h.endsWith(".indsure.in") ||
      (h.endsWith(".vercel.app") && h.includes("indsure")) ||
      h === "localhost" || h === "127.0.0.1";
    if (ours) return u.origin;
  } catch { /* no or bad origin */ }
  return fallback;
}

function newOrderRef(): string {
  const day = istMonth(new Date()).replace("-", "") + new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(8, 10);
  return `IS${day}${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
}

/* ---------- order sync + grant ---------- */

// Ask Cashfree what happened to an order and act on it. Never trusts the caller.
export async function syncOrder(orderRef: string): Promise<string> {
  const row = (await pool.query("SELECT * FROM payment_orders WHERE order_ref = $1", [orderRef])).rows[0];
  if (!row) return "unknown";
  if (row.granted_at || row.status === "refunded") return row.status;

  const order = await cf("GET", `/orders/${encodeURIComponent(orderRef)}`);
  const status = String(order?.order_status || "").toUpperCase();

  if (status === "PAID") {
    const paidPaise = Math.round(Number(order.order_amount) * 100);
    if (paidPaise !== row.amount_paise || String(order.order_currency || "INR") !== "INR") {
      log.error("[pay] amount mismatch, NOT granted", { orderRef, ours: row.amount_paise, theirs: paidPaise });
      await pool.query(
        "UPDATE payment_orders SET notes = $2, updated_at = now() WHERE order_ref = $1",
        [orderRef, `amount mismatch: cashfree ${paidPaise} paise`],
      );
      return row.status;
    }
    let paymentId: string | null = null;
    let method: string | null = null;
    try {
      const pays = await cf("GET", `/orders/${encodeURIComponent(orderRef)}/payments`);
      const ok = Array.isArray(pays) ? pays.find((p: any) => String(p?.payment_status).toUpperCase() === "SUCCESS") : null;
      if (ok) {
        paymentId = ok.cf_payment_id != null ? String(ok.cf_payment_id) : null;
        method = ok.payment_group ? String(ok.payment_group) : null;
      }
    } catch { /* details are nice to have; the grant does not depend on them */ }
    await grantOrder(row.id, paymentId, method);
    return "paid";
  }

  if (status === "EXPIRED" || status === "TERMINATED") {
    await pool.query(
      "UPDATE payment_orders SET status = 'expired', updated_at = now() WHERE id = $1 AND status IN ('created','pending')",
      [row.id],
    );
    return "expired";
  }
  return row.status;
}

// What the pay screen should say about an order Cashfree still has open. "failed": every
// attempt failed, was dropped or cancelled. "unpaid": no attempt at all (the box was closed).
// "pending": an attempt is still in flight (UPI can take minutes). Never used to grant.
async function openOrderState(orderRef: string): Promise<"pending" | "failed" | "unpaid"> {
  try {
    const pays = await cf("GET", `/orders/${encodeURIComponent(orderRef)}/payments`);
    if (!Array.isArray(pays) || pays.length === 0) return "unpaid";
    const states = pays.map((p: any) => String(p?.payment_status || "").toUpperCase());
    if (states.some((s) => s === "SUCCESS" || s === "PENDING" || s === "")) return "pending";
    if (states.every((s) => s === "NOT_ATTEMPTED")) return "unpaid";
    return "failed";
  } catch {
    return "pending"; // could not ask: say the honest default, keep polling
  }
}

// Turns a PAID order into access. One transaction; the order row lock plus granted_at make a
// second call (webhook + poll + job racing) a no-op.
async function grantOrder(orderId: string, paymentId: string | null, method: string | null): Promise<void> {
  const client = await pool.connect();
  let mail: { to: string; subject: string; text: string } | null = null;
  try {
    await client.query("BEGIN");
    const o = (await client.query("SELECT * FROM payment_orders WHERE id = $1 FOR UPDATE", [orderId])).rows[0];
    if (!o || o.granted_at) {
      await client.query("ROLLBACK");
      return;
    }
    const sku = o.sku as Sku;
    const def = SKUS[sku];
    const now = new Date();
    let periodStart: Date | null = null;
    let periodEnd: Date | null = null;
    let email: string | null = null;

    if (def.kind === "agent") {
      const a = (await client.query(
        "SELECT email, plan, plan_expires_at FROM agents WHERE id = $1 FOR UPDATE", [o.account_id],
      )).rows[0];
      if (!a) {
        await client.query(
          `UPDATE payment_orders SET status = 'paid', paid_at = now(), cf_payment_id = $2, payment_method = $3,
                  notes = 'account no longer exists: refund by hand', updated_at = now() WHERE id = $1`,
          [orderId, paymentId, method],
        );
        await client.query("COMMIT");
        log.error("[pay] paid order for a missing agent: refund by hand", { orderRef: o.order_ref });
        return;
      }
      email = a.email;
      if (def.months > 0) {
        const current: Date | null = a.plan_expires_at;
        periodStart = current && current > now ? current : now;
        periodEnd = addMonthsIst(periodStart, def.months);
        await client.query(
          `UPDATE agents SET plan = 'agent', billing_cycle = $2, plan_expires_at = $3, checks_period = $4
            WHERE id = $1`,
          [o.account_id, def.months === 12 ? "annual" : "monthly", periodEnd, istMonth(now)],
        );
      }
      if (def.checks > 0) {
        await client.query(
          `INSERT INTO agent_credits (agent_id, balance) VALUES ($1, $2)
           ON CONFLICT (agent_id) DO UPDATE SET balance = agent_credits.balance + EXCLUDED.balance`,
          [o.account_id, def.checks],
        );
      }
    } else {
      const p = (await client.query(
        "SELECT email, plan, paid_until FROM individual_profiles WHERE id = $1 FOR UPDATE", [o.account_id],
      )).rows[0];
      if (!p) {
        await client.query(
          `UPDATE payment_orders SET status = 'paid', paid_at = now(), cf_payment_id = $2, payment_method = $3,
                  notes = 'account no longer exists: refund by hand', updated_at = now() WHERE id = $1`,
          [orderId, paymentId, method],
        );
        await client.query("COMMIT");
        log.error("[pay] paid order for a missing consumer: refund by hand", { orderRef: o.order_ref });
        return;
      }
      email = p.email;
      const current: Date | null = p.paid_until;
      periodStart = current && current > now ? current : now;
      periodEnd = addMonthsIst(periodStart, def.months);
      await client.query(
        `UPDATE individual_profiles SET plan = 'paid', paid_until = $2, paid_billing = $3, updated_at = now()
          WHERE id = $1`,
        [o.account_id, periodEnd, def.months === 12 ? "annual" : "monthly"],
      );
    }

    await client.query(
      `UPDATE payment_orders
          SET status = 'paid', granted_at = now(), paid_at = COALESCE(paid_at, now()),
              cf_payment_id = $2, payment_method = $3, period_start = $4, period_end = $5,
              checks_granted = $6, updated_at = now()
        WHERE id = $1`,
      [orderId, paymentId, method, periodStart, periodEnd, def.checks],
    );
    await client.query("COMMIT");
    log.info("[pay] granted", { orderRef: o.order_ref, sku });
    // After COMMIT on purpose: a failed statement inside the transaction would abort the grant.
    pool.query(
      `INSERT INTO access_audit_log (agent_id, client_id, action, route, method)
       VALUES ($1, NULL, $2, '/api/pay', 'GRANT')`,
      [def.kind === "agent" ? o.account_id : null, `payment_granted:${sku}:${o.order_ref}`],
    ).catch(() => { /* audit is best-effort */ });

    if (email) {
      const rupees = (o.amount_paise / 100).toLocaleString("en-IN");
      const until = periodEnd
        ? `\nYour plan is active till ${periodEnd.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric" })}.`
        : "";
      const checks = def.checks > 0 ? `\n${def.checks} policy checks have been added to your account.` : "";
      mail = {
        to: email,
        subject: `Payment received: ${def.label}`,
        text:
          `Thank you. We have received your payment of Rs ${rupees} for ${def.label}.${until}${checks}\n\n` +
          `Payment reference: ${o.order_ref}\n\n` +
          `Nothing renews by itself. We will remind you before your plan ends.\n` +
          `Refunds: within 7 days of payment, only if no policy check has been used. Reply to this email to ask.\n\n` +
          `IndSure`,
      };
    }
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  if (mail) void sendMail(mail);
}

/* ---------- webhook ---------- */

export function verifyCashfreeSignature(rawBody: string, timestamp: string, signature: string, secret: string): boolean {
  if (!rawBody || !timestamp || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(timestamp + rawBody).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Mounted in index.ts BEFORE express.json() with express.raw(), because the signature is over
// the exact bytes Cashfree sent (parsing turns 170.00 into 170 and breaks it). Acks first, then
// works: the order is re-fetched from Cashfree anyway, so the body is only a hint.
export async function cashfreeWebhookHandler(req: Request, res: Response): Promise<void> {
  const cfg = cfConfig();
  if (!cfg) {
    res.status(503).json({ error: "PAYMENTS_OFF" });
    return;
  }
  const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
  const ok = verifyCashfreeSignature(
    raw,
    String(req.headers["x-webhook-timestamp"] || ""),
    String(req.headers["x-webhook-signature"] || ""),
    cfg.secret,
  );
  if (!ok) {
    log.warn("[pay] webhook with a bad signature rejected");
    res.status(400).json({ error: "bad signature" });
    return;
  }
  res.status(200).json({ ok: true });

  try {
    const body = JSON.parse(raw);
    const type = String(body?.type || "");
    const orderRef: string | null =
      body?.data?.order?.order_id ?? body?.data?.refund?.order_id ?? null;
    const idem = req.headers["x-idempotency-key"] ? String(req.headers["x-idempotency-key"]) : null;
    const ins = await pool.query(
      `INSERT INTO payment_events (idempotency_key, event_type, order_ref, raw_body)
       VALUES ($1, $2, $3, $4) ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`,
      [idem, type, orderRef, raw],
    );
    if (idem && ins.rowCount === 0) return; // already handled this delivery
    if (!orderRef) return;

    if (type === "REFUND_STATUS_WEBHOOK") {
      const st = String(body?.data?.refund?.refund_status || "").toUpperCase();
      if (st === "SUCCESS") {
        // Refunds are issued by hand from the Cashfree dashboard for now; the plan is not taken
        // back automatically. Flag it so the founder adjusts access in the admin app.
        await pool.query(
          `UPDATE payment_orders SET status = 'refunded', refunded_at = now(),
                  notes = coalesce(notes || ' | ', '') || 'refunded: adjust plan/checks by hand', updated_at = now()
            WHERE order_ref = $1`,
          [orderRef],
        );
        log.warn("[pay] refund succeeded: adjust the account by hand", { orderRef });
      }
      return;
    }
    await syncOrder(orderRef);
  } catch (err: any) {
    log.error("[pay] webhook processing failed (the reconcile job will retry)", { message: err?.message });
  }
}

/* ---------- jobs ---------- */

// Missed webhooks: re-ask Cashfree about every open order younger than 3 hours. Older open
// orders are past Cashfree's expiry (30 min), so one last check settles them.
export async function reconcileOpenOrders(): Promise<void> {
  if (!cfConfig()) return;
  try {
    const open = await pool.query(
      `SELECT order_ref FROM payment_orders
        WHERE status IN ('created','pending') AND created_at > now() - interval '1 day'
        ORDER BY created_at LIMIT 200`,
    );
    for (const r of open.rows) {
      try { await syncOrder(r.order_ref); } catch { /* next run */ }
    }
  } catch (err: any) {
    log.error("[pay] reconcile failed", { message: err?.message });
  }
}

// Which refills a multi-month plan order has earned by `now`: its checks come once at purchase
// and then on the same day of each later month (India time), so a year gives exactly 12.
// Returns the total that should have been granted so far.
export function checksEarned(sku: Sku, periodStart: Date, now: Date): number {
  const def = SKUS[sku];
  let k = 0;
  while (k < def.months - 1 && addMonthsIst(periodStart, k + 1) <= now) k++;
  return (k + 1) * def.checks;
}

// End of grace: plans bought here (they have an end date) drop to free 3 days after it.
// Plans with no end date (set by hand earlier) are never touched. Yearly Agent plans bought
// here refill on their own order's schedule (see checksEarned), so a monthly renewal bought
// in the middle of a paid year neither stops nor doubles them. An annual plan set by hand
// (no paid plan order) keeps the old rule: 12 checks each new India-time month.
export async function planHousekeeping(now = new Date()): Promise<void> {
  try {
    const a = await pool.query(
      `UPDATE agents SET plan = 'free', billing_cycle = 'monthly'
        WHERE lower(plan) = 'agent' AND plan_expires_at IS NOT NULL
          AND plan_expires_at < now() - make_interval(days => $1)
        RETURNING id`,
      [GRACE_DAYS],
    );
    const p = await pool.query(
      `UPDATE individual_profiles SET plan = 'free', updated_at = now()
        WHERE plan = 'paid' AND paid_until IS NOT NULL
          AND paid_until < now() - make_interval(days => $1)
        RETURNING id`,
      [GRACE_DAYS],
    );
    if ((a.rowCount ?? 0) + (p.rowCount ?? 0) > 0) {
      log.info(`[pay] plans ended after grace: ${a.rowCount} advisor(s), ${p.rowCount} consumer(s)`);
    }

    const multiMonth = (Object.keys(SKUS) as Sku[]).filter((s) => SKUS[s].kind === "agent" && SKUS[s].months > 1 && SKUS[s].checks > 0);
    const orders = await pool.query(
      `SELECT id, sku, period_start, checks_granted FROM payment_orders
        WHERE status = 'paid' AND granted_at IS NOT NULL AND sku = ANY($1::text[])
          AND period_start IS NOT NULL AND period_start <= $2
          AND period_end > $2::timestamptz - interval '35 days'`,
      [multiMonth, now],
    );
    let orderRefills = 0;
    for (const o of orders.rows) {
      const owed = checksEarned(o.sku as Sku, new Date(o.period_start), now);
      if (owed <= o.checks_granted) continue;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        // Only from the count we read, so two runs at once cannot both add.
        const upd = await client.query(
          `UPDATE payment_orders SET checks_granted = $2, updated_at = now()
            WHERE id = $1 AND checks_granted = $3 RETURNING account_id`,
          [o.id, owed, o.checks_granted],
        );
        if (upd.rows[0]) {
          await client.query(
            `INSERT INTO agent_credits (agent_id, balance) VALUES ($1, $2)
             ON CONFLICT (agent_id) DO UPDATE SET balance = agent_credits.balance + EXCLUDED.balance`,
            [upd.rows[0].account_id, owed - o.checks_granted],
          );
          orderRefills++;
        }
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    }
    if (orderRefills > 0) log.info(`[pay] yearly check refill: ${orderRefills} order(s)`);

    const month = istMonth(now);
    const refill = await pool.query(
      `WITH due AS (
         UPDATE agents SET checks_period = $1
          WHERE lower(plan) = 'agent' AND billing_cycle = 'annual'
            AND plan_expires_at IS NOT NULL AND plan_expires_at > now()
            AND checks_period IS DISTINCT FROM $1
            AND NOT EXISTS (
              SELECT 1 FROM payment_orders po
               WHERE po.account_id = agents.id AND po.status = 'paid'
                 AND po.sku IN ('agent_monthly', 'agent_yearly'))
          RETURNING id)
       INSERT INTO agent_credits (agent_id, balance)
       SELECT id, $2 FROM due
       ON CONFLICT (agent_id) DO UPDATE SET balance = agent_credits.balance + EXCLUDED.balance
       RETURNING agent_id`,
      [month, SKUS.agent_yearly.checks],
    );
    if ((refill.rowCount ?? 0) > 0) log.info(`[pay] yearly check refill for ${month}: ${refill.rowCount} advisor(s)`);
  } catch (err: any) {
    log.error("[pay] housekeeping failed", { message: err?.message });
  }
}

// Nothing renews by itself, so the customer hears from us twice per paid period: 3 days before it
// ends, and when it ends (with the grace days). Only the latest period of an account counts, so a
// month that was already paid ahead gets no reminder. The marker is set BEFORE the email goes, so
// a restart can never send the same reminder twice (a failed send is lost, not repeated).
export async function sendRenewalReminders(): Promise<number> {
  let sent = 0;
  try {
    const due = await pool.query(
      `WITH latest AS (
         SELECT DISTINCT ON (account_id) id, account_id, account_kind, sku, period_end,
                reminded_before_at, reminded_end_at
           FROM payment_orders
          WHERE status = 'paid' AND period_end IS NOT NULL AND account_id IS NOT NULL
          ORDER BY account_id, period_end DESC)
       SELECT *, CASE WHEN period_end > now() THEN 'before' ELSE 'end' END AS which
         FROM latest
        WHERE (period_end > now() AND period_end <= now() + make_interval(days => $1) AND reminded_before_at IS NULL)
           OR (period_end <= now() AND period_end > now() - make_interval(days => $1) AND reminded_end_at IS NULL)`,
      [GRACE_DAYS],
    );
    for (const r of due.rows) {
      const col = r.which === "before" ? "reminded_before_at" : "reminded_end_at";
      const claimed = await pool.query(
        `UPDATE payment_orders SET ${col} = now() WHERE id = $1 AND ${col} IS NULL RETURNING id`,
        [r.id],
      );
      if ((claimed.rowCount ?? 0) === 0) continue;
      const who = await pool.query(
        r.account_kind === "agent"
          ? "SELECT email FROM agents WHERE id = $1"
          : "SELECT email FROM individual_profiles WHERE id = $1",
        [r.account_id],
      );
      const email = who.rows[0]?.email;
      if (!email) continue;
      const def = SKUS[r.sku as Sku];
      const plan = def ? def.label.split(",")[0] : "Your plan";
      const date = new Date(r.period_end).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric" });
      const site = (process.env.PUBLIC_SITE_URL || "https://indsure.in").replace(/\/+$/, "");
      const link = `${site}${r.account_kind === "agent" ? "/advisors/pricing" : "/pricing"}`;
      const text = r.which === "before"
        ? `Your ${plan} ends on ${date}.\n\nNothing renews by itself. To keep it, pay for another month or year here:\n${link}\n\n` +
          `If you do nothing, it keeps working for ${GRACE_DAYS} more days after that date, then your account moves to the free plan. Your data stays.\n\nIndSure`
        : `Your ${plan} ended on ${date}.\n\nIt keeps working for ${GRACE_DAYS} more days. To keep it, pay here:\n${link}\n\n` +
          `After that your account moves to the free plan. Your policies and customers stay in your account.\n\nIndSure`;
      await sendMail({
        to: email,
        subject: r.which === "before" ? `Your ${plan} ends on ${date}` : `Your ${plan} has ended`,
        text,
      });
      sent++;
    }
    if (sent > 0) log.info(`[pay] sent ${sent} renewal reminder(s)`);
  } catch (err: any) {
    log.error("[pay] renewal reminders failed", { message: err?.message });
  }
  return sent;
}

export function startPaymentJobs(): void {
  setTimeout(() => { void reconcileOpenOrders(); void planHousekeeping(); void sendRenewalReminders(); }, 60_000);
  setInterval(() => void reconcileOpenOrders(), 10 * 60 * 1000);
  setInterval(() => { void planHousekeeping(); void sendRenewalReminders(); }, 60 * 60 * 1000);
}

/* ---------- routes ---------- */

type PaymentDeps = {
  getUserIdFromToken: (token: string) => Promise<string | null>;
};

async function authedUser(req: Request, res: Response, deps: PaymentDeps): Promise<string | null> {
  const h = String(req.headers["authorization"] || "");
  if (!h.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing authorization" });
    return null;
  }
  const id = await deps.getUserIdFromToken(h.slice(7));
  if (!id) {
    res.status(401).json({ error: "Invalid or expired token" });
    return null;
  }
  return id;
}

function sendPayError(res: Response, err: any, where: string) {
  if (err instanceof PayError) {
    res.status(err.status).json({ error: err.code, message: err.message });
    return;
  }
  log.error(`[pay] ${where} failed`, { message: err?.message });
  res.status(500).json({ error: "Internal server error" });
}

export function registerPaymentRoutes(app: Express, deps: PaymentDeps): void {
  // Public: lets the pay button know whether to show, and which Cashfree.js mode to load.
  app.get("/api/pay/config", (_req, res) => {
    const cfg = cfConfig();
    res.json({ enabled: !!cfg, mode: cfg?.production ? "production" : "sandbox" });
  });

  app.post("/api/pay/order", async (req, res) => {
    const userId = await authedUser(req, res, deps);
    if (!userId) return;
    try {
      if (!cfConfig()) throw new PayError(503, "PAYMENTS_OFF", "Payments are not switched on yet.");
      const sku = req.body?.sku;
      if (!isSku(sku)) throw new PayError(400, "BAD_SKU", "Unknown plan.");
      const def = SKUS[sku];

      const acc = await loadAccount(userId);
      if (!acc) throw new PayError(403, "NO_ACCOUNT", "Please finish setting up your account first.");
      if (acc.kind !== def.kind) {
        throw new PayError(403, "WRONG_ACCOUNT_TYPE", def.kind === "agent"
          ? "This plan is for advisors. Please sign in to the advisor portal."
          : "This plan is for personal accounts. Advisors have their own plans.");
      }
      if (acc.kind === "agent" && acc.plan === "agency" && def.months > 0) {
        throw new PayError(409, "ON_AGENCY", "Your account is on an Agency plan. Please talk to us on WhatsApp to change it.");
      }
      if (def.months === 0 && !planActive(acc)) {
        throw new PayError(409, "NEEDS_PLAN", "Extra checks are for paid plans. Please buy the Agent plan first.");
      }

      let phone = normalisePhone(acc.phone);
      if (!phone) {
        phone = normalisePhone(req.body?.phone);
        if (!phone) throw new PayError(400, "PHONE_REQUIRED", "Please enter your 10-digit mobile number.");
        await pool.query(
          acc.kind === "agent"
            ? "UPDATE agents SET phone = $2 WHERE id = $1 AND (phone IS NULL OR phone = '')"
            : "UPDATE individual_profiles SET phone = $2, updated_at = now() WHERE id = $1 AND (phone IS NULL OR phone = '')",
          [acc.id, phone],
        );
      }

      const open = await pool.query(
        `SELECT count(*)::int AS c FROM payment_orders
          WHERE account_id = $1 AND status IN ('created','pending') AND created_at > now() - interval '30 minutes'`,
        [acc.id],
      );
      if ((open.rows[0]?.c ?? 0) >= MAX_OPEN_ORDERS) {
        throw new PayError(429, "TOO_MANY_OPEN", "You have payments still open. Please wait a few minutes and try again.");
      }

      const orderRef = newOrderRef();
      await pool.query(
        `INSERT INTO payment_orders (order_ref, account_kind, account_id, sku, amount_paise)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderRef, acc.kind, acc.id, sku, def.amountPaise],
      );

      const notify = process.env.PAYMENTS_WEBHOOK_URL?.trim();
      const order = await cf("POST", "/orders", {
        order_id: orderRef,
        order_amount: def.amountPaise / 100,
        order_currency: "INR",
        customer_details: {
          customer_id: acc.id,
          customer_phone: phone,
          ...(acc.email ? { customer_email: acc.email } : {}),
          ...(acc.name ? { customer_name: String(acc.name).slice(0, 100) } : {}),
        },
        order_meta: {
          return_url: `${returnBase(req)}/pay/status`,
          ...(notify ? { notify_url: notify } : {}),
        },
        order_expiry_time: new Date(Date.now() + ORDER_TTL_MIN * 60_000).toISOString(),
        order_note: def.label,
      });

      if (!order?.payment_session_id) throw new PayError(502, "GATEWAY_ERROR", "The payment service did not respond. Please try again.");
      await pool.query(
        "UPDATE payment_orders SET status = 'pending', cf_order_id = $2, updated_at = now() WHERE order_ref = $1",
        [orderRef, order.cf_order_id != null ? String(order.cf_order_id) : null],
      );
      res.json({ orderRef, paymentSessionId: order.payment_session_id, mode: cfConfig()!.production ? "production" : "sandbox" });
    } catch (err) {
      sendPayError(res, err, "create order");
    }
  });

  app.get("/api/pay/status/:ref", async (req, res) => {
    const userId = await authedUser(req, res, deps);
    if (!userId) return;
    try {
      const ref = String(req.params.ref || "");
      const row = (await pool.query(
        "SELECT order_ref, account_id, sku, status FROM payment_orders WHERE order_ref = $1", [ref],
      )).rows[0];
      if (!row || row.account_id !== userId) throw new PayError(404, "NOT_FOUND", "Payment not found.");
      let status = row.status as string;
      if (status === "created" || status === "pending") status = await syncOrder(ref);
      const fresh = (await pool.query(
        "SELECT sku, amount_paise, status, period_end, checks_granted FROM payment_orders WHERE order_ref = $1", [ref],
      )).rows[0];
      // Still open at Cashfree. Its payment attempts say whether anything is on the way:
      // without this, a declined or abandoned payment showed "we are confirming, we will
      // email you", and no email ever came. Display only: nothing is stored or granted here.
      let shown = fresh.status as string;
      if (shown === "created" || shown === "pending") shown = await openOrderState(ref);
      res.json({
        orderRef: ref,
        status: shown,
        sku: fresh.sku,
        label: SKUS[fresh.sku as Sku]?.label ?? fresh.sku,
        amount: fresh.amount_paise / 100,
        periodEnd: fresh.period_end,
        checksAdded: fresh.checks_granted,
      });
    } catch (err) {
      sendPayError(res, err, "status");
    }
  });

  app.get("/api/pay/billing", async (req, res) => {
    const userId = await authedUser(req, res, deps);
    if (!userId) return;
    try {
      const acc = await loadAccount(userId);
      if (!acc) throw new PayError(404, "NO_ACCOUNT", "Account not found.");
      const orders = await pool.query(
        `SELECT order_ref, sku, amount_paise, status, paid_at, period_end, checks_granted
           FROM payment_orders WHERE account_id = $1 AND status IN ('paid','refunded')
          ORDER BY created_at DESC LIMIT 24`,
        [userId],
      );
      res.json({
        kind: acc.kind,
        plan: acc.plan,
        activeUntil: acc.expiresAt,
        inGrace: !!acc.expiresAt && acc.expiresAt.getTime() < Date.now() && planActive(acc),
        payments: orders.rows.map((o: any) => ({
          orderRef: o.order_ref,
          label: SKUS[o.sku as Sku]?.label ?? o.sku,
          amount: o.amount_paise / 100,
          status: o.status,
          paidAt: o.paid_at,
          periodEnd: o.period_end,
          checksAdded: o.checks_granted,
        })),
      });
    } catch (err) {
      sendPayError(res, err, "billing");
    }
  });
}
