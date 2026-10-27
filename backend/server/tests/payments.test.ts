// End-to-end tests for services/payments.ts against PGlite (real Postgres semantics: FOR UPDATE,
// ON CONFLICT, intervals) and a fake Cashfree on localhost. No network, no real keys.
//
// What must hold, whatever else changes:
//   - only Cashfree's own "PAID" (with our amount) grants anything;
//   - one payment grants once, however many webhooks / polls / job runs see it;
//   - a forged webhook does nothing;
//   - plans bought here end 3 days after their end date; plans set by hand (no end date) never do.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import { PGlite } from "@electric-sql/pglite";
import * as pay from "../services/payments";

const SECRET = "test_secret_value";

// payments.ts reads the env on every call, so setting it here (before any test) is enough.
process.env.CASHFREE_APP_ID = "TEST_app";
process.env.CASHFREE_SECRET_KEY = SECRET;
process.env.CASHFREE_ENV = "sandbox";

const AGENT = "11111111-1111-1111-1111-111111111111";
const AGENT_NOPHONE = "22222222-2222-2222-2222-222222222222";
const CONSUMER = "33333333-3333-3333-3333-333333333333";
const AGENCY = "44444444-4444-4444-4444-444444444444";
const TOKENS: Record<string, string> = { a: AGENT, n: AGENT_NOPHONE, c: CONSUMER, g: AGENCY };

let db: PGlite;
let api = "";
let apiServer: http.Server;
let cfServer: http.Server;

// Fake Cashfree: remembers orders, lets a test decide what Get Order says.
const cfOrders = new Map<string, { amount: number; status: string; body: any; payments?: any[] }>();

async function q(sql: string, params: unknown[] = []) {
  return (await db.query(sql, params)).rows as any[];
}

before(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
    CREATE TABLE agents (id uuid PRIMARY KEY, email text, full_name text, name text, phone text,
      plan text NOT NULL DEFAULT 'free', billing_cycle text NOT NULL DEFAULT 'monthly');
    CREATE TABLE individual_profiles (id uuid PRIMARY KEY, email text, full_name text, phone text,
      plan text NOT NULL DEFAULT 'free', updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE agent_credits (agent_id uuid PRIMARY KEY, balance int NOT NULL DEFAULT 0,
      total_used int NOT NULL DEFAULT 0);
    CREATE TABLE access_audit_log (id serial, agent_id uuid, client_id uuid, action text, route text,
      method text, ip text, user_agent text);
  `);
  await db.exec(fs.readFileSync(path.resolve(process.cwd(), "migrations/028_payments.sql"), "utf8"));
  await db.exec(`
    INSERT INTO agents (id, email, phone) VALUES ('${AGENT}', 'a@x.in', '+91 98765 43210');
    INSERT INTO agents (id, email) VALUES ('${AGENT_NOPHONE}', 'n@x.in');
    INSERT INTO agents (id, email, phone, plan) VALUES ('${AGENCY}', 'g@x.in', '9876500000', 'agency');
    INSERT INTO individual_profiles (id, email, phone) VALUES ('${CONSUMER}', 'c@x.in', '9123456789');
  `);

  // PGlite has one connection; a "client" is the same handle (tests run one request at a time).
  const adapter = {
    query: async (sql: string, params?: unknown[]) => {
      const r = await db.query(sql, params as any[]);
      return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
    },
    connect: async () => ({ query: adapter.query, release() {} }),
  };
  pay.__setPaymentsDbForTests(adapter);

  cfServer = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.setHeader("content-type", "application/json");
      if (req.headers["x-client-secret"] !== SECRET) {
        res.statusCode = 401;
        return res.end("{}");
      }
      const url = req.url || "";
      if (req.method === "POST" && url === "/orders") {
        const b = JSON.parse(body);
        cfOrders.set(b.order_id, { amount: b.order_amount, status: "ACTIVE", body: b });
        return res.end(JSON.stringify({ order_id: b.order_id, cf_order_id: 99, order_status: "ACTIVE", payment_session_id: "sess_" + b.order_id }));
      }
      const m = url.match(/^\/orders\/([^/]+)(\/payments)?$/);
      if (req.method === "GET" && m) {
        const o = cfOrders.get(decodeURIComponent(m[1]));
        if (!o) { res.statusCode = 404; return res.end("{}"); }
        if (m[2]) return res.end(JSON.stringify(o.status === "PAID" ? [{ cf_payment_id: 555, payment_status: "SUCCESS", payment_group: "upi" }] : (o.payments ?? [])));
        return res.end(JSON.stringify({ order_id: m[1], order_status: o.status, order_amount: o.amount, order_currency: "INR" }));
      }
      res.statusCode = 404;
      res.end("{}");
    });
  });
  await new Promise<void>((r) => cfServer.listen(0, "127.0.0.1", () => r()));
  process.env.CASHFREE_API_BASE = `http://127.0.0.1:${(cfServer.address() as any).port}`;

  const app = express();
  app.post("/api/pay/cashfree/webhook", express.raw({ type: "*/*" }), (req, res) => {
    void pay.cashfreeWebhookHandler(req, res);
  });
  app.use(express.json());
  pay.registerPaymentRoutes(app as any, { getUserIdFromToken: async (t) => TOKENS[t] ?? null });
  apiServer = app.listen(0);
  await new Promise<void>((r) => apiServer.once("listening", () => r()));
  api = `http://127.0.0.1:${(apiServer.address() as any).port}`;
});

after(async () => {
  apiServer?.close();
  cfServer?.close();
  await db?.close();
});

async function call(method: string, p: string, token?: string, body?: unknown) {
  const r = await fetch(api + p, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, body: (await r.json().catch(() => null)) as any };
}

async function webhook(orderRef: string, idem: string, secret = SECRET) {
  const raw = JSON.stringify({ type: "PAYMENT_SUCCESS_WEBHOOK", data: { order: { order_id: orderRef, order_amount: 1499.0 } } });
  const ts = String(Date.now());
  const sig = crypto.createHmac("sha256", secret).update(ts + raw).digest("base64");
  const r = await fetch(api + "/api/pay/cashfree/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "x-webhook-timestamp": ts, "x-webhook-signature": sig, "x-idempotency-key": idem },
    body: raw,
  });
  await new Promise((r2) => setTimeout(r2, 150)); // the handler acks first, then works
  return r.status;
}

const credits = async (id: string) => (await q("SELECT balance FROM agent_credits WHERE agent_id = $1", [id]))[0]?.balance ?? 0;
const agent = async (id: string) => (await q("SELECT * FROM agents WHERE id = $1", [id]))[0];

test("dates: +1 month clamps to the month end in India time", () => {
  const jan31 = new Date("2027-01-31T06:30:00Z"); // 12:00 IST
  assert.equal(pay.addMonthsIst(jan31, 1).toISOString(), "2027-02-28T06:30:00.000Z");
  const leap = new Date("2028-01-31T06:30:00Z");
  assert.equal(pay.addMonthsIst(leap, 1).toISOString(), "2028-02-29T06:30:00.000Z");
  assert.equal(pay.addMonthsIst(new Date("2026-10-26T06:30:00Z"), 12).toISOString(), "2027-10-26T06:30:00.000Z");
  // 23:30 IST on 31 Mar is still March in India although UTC says 31 Mar 18:00.
  assert.equal(pay.istMonth(new Date("2027-03-31T18:00:00Z")), "2027-03");
  assert.equal(pay.istMonth(new Date("2027-03-31T18:31:00Z")), "2027-04");
});

test("signature check: right secret passes, wrong secret or edited body fails", () => {
  const raw = '{"a":170.00}';
  const sig = crypto.createHmac("sha256", SECRET).update("123" + raw).digest("base64");
  assert.equal(pay.verifyCashfreeSignature(raw, "123", sig, SECRET), true);
  assert.equal(pay.verifyCashfreeSignature('{"a":170}', "123", sig, SECRET), false);
  assert.equal(pay.verifyCashfreeSignature(raw, "123", sig, "other"), false);
  assert.equal(pay.verifyCashfreeSignature(raw, "", sig, SECRET), false);
});

test("phone numbers normalise to 10 digits", () => {
  assert.equal(pay.normalisePhone("+91 98765 43210"), "9876543210");
  assert.equal(pay.normalisePhone("09876543210"), "9876543210");
  assert.equal(pay.normalisePhone("12345"), null);
  assert.equal(pay.normalisePhone("5876543210"), null);
});

test("config is public and says sandbox", async () => {
  const r = await call("GET", "/api/pay/config");
  assert.deepEqual(r.body, { enabled: true, mode: "sandbox" });
});

test("agent buys a month: server price, nothing granted until Cashfree says PAID, then granted once", async () => {
  const r = await call("POST", "/api/pay/order", "a", { sku: "agent_monthly", amount: 1 });
  assert.equal(r.status, 200);
  assert.ok(r.body.paymentSessionId);
  const ref = r.body.orderRef as string;
  assert.equal(cfOrders.get(ref)!.amount, 1499, "the client's amount is ignored");
  assert.equal(cfOrders.get(ref)!.body.customer_details.customer_phone, "9876543210");

  // Box closed before paying: no attempt, nothing granted.
  let s = await call("GET", `/api/pay/status/${ref}`, "a");
  assert.equal(s.body.status, "unpaid");
  assert.equal((await agent(AGENT)).plan, "free");

  // A UPI attempt in flight: still being confirmed.
  cfOrders.get(ref)!.payments = [{ payment_status: "PENDING" }];
  s = await call("GET", `/api/pay/status/${ref}`, "a");
  assert.equal(s.body.status, "pending");

  // The bank declined it: say so, instead of "we will email you".
  cfOrders.get(ref)!.payments = [{ payment_status: "FAILED" }, { payment_status: "USER_DROPPED" }];
  s = await call("GET", `/api/pay/status/${ref}`, "a");
  assert.equal(s.body.status, "failed");
  assert.equal((await agent(AGENT)).plan, "free");
  cfOrders.get(ref)!.payments = [];

  // A forged webhook does nothing.
  cfOrders.get(ref)!.status = "ACTIVE";
  assert.equal(await webhook(ref, "forged-1", "wrong_secret"), 400);
  assert.equal((await agent(AGENT)).plan, "free");

  cfOrders.get(ref)!.status = "PAID";
  assert.equal(await webhook(ref, "evt-1"), 200);
  assert.equal(await webhook(ref, "evt-1"), 200); // same delivery again
  assert.equal(await webhook(ref, "evt-2"), 200); // a retry with a new key
  s = await call("GET", `/api/pay/status/${ref}`, "a");
  await pay.reconcileOpenOrders();

  assert.equal(s.body.status, "paid");
  assert.equal(s.body.checksAdded, 12);
  const a = await agent(AGENT);
  assert.equal(a.plan, "agent");
  assert.equal(a.billing_cycle, "monthly");
  const days = (new Date(a.plan_expires_at).getTime() - Date.now()) / 86400_000;
  assert.ok(days > 27 && days < 32, `about a month, got ${days}`);
  assert.equal(await credits(AGENT), 12, "granted exactly once");
  const row = (await q("SELECT cf_payment_id, payment_method FROM payment_orders WHERE order_ref = $1", [ref]))[0];
  assert.equal(row.cf_payment_id, "555");
  assert.equal(row.payment_method, "upi");
});

test("paying again while active stacks after the current end date", async () => {
  const before = new Date((await agent(AGENT)).plan_expires_at);
  const r = await call("POST", "/api/pay/order", "a", { sku: "agent_monthly" });
  cfOrders.get(r.body.orderRef)!.status = "PAID";
  await call("GET", `/api/pay/status/${r.body.orderRef}`, "a");
  const after = new Date((await agent(AGENT)).plan_expires_at);
  assert.equal(after.toISOString(), pay.addMonthsIst(before, 1).toISOString());
  assert.equal(await credits(AGENT), 24);
});

test("top-ups: refused on a free plan, added on a paid one", async () => {
  const free = await call("POST", "/api/pay/order", "n", { sku: "topup_5", phone: "9000000001" });
  assert.equal(free.status, 409);
  assert.equal(free.body.error, "NEEDS_PLAN");

  const r = await call("POST", "/api/pay/order", "a", { sku: "topup_5" });
  cfOrders.get(r.body.orderRef)!.status = "PAID";
  await call("GET", `/api/pay/status/${r.body.orderRef}`, "a");
  assert.equal(await credits(AGENT), 29);
});

test("Cashfree says PAID with a different amount: nothing is granted", async () => {
  const r = await call("POST", "/api/pay/order", "a", { sku: "topup_15" });
  const o = cfOrders.get(r.body.orderRef)!;
  o.status = "PAID";
  o.amount = 1;
  const s = await call("GET", `/api/pay/status/${r.body.orderRef}`, "a");
  assert.notEqual(s.body.status, "paid");
  assert.equal(await credits(AGENT), 29);
});

test("an order Cashfree expires is marked expired", async () => {
  const r = await call("POST", "/api/pay/order", "a", { sku: "topup_5" });
  cfOrders.get(r.body.orderRef)!.status = "EXPIRED";
  const s = await call("GET", `/api/pay/status/${r.body.orderRef}`, "a");
  assert.equal(s.body.status, "expired");
});

test("someone else's order is not visible", async () => {
  const r = await call("POST", "/api/pay/order", "a", { sku: "topup_5" });
  const s = await call("GET", `/api/pay/status/${r.body.orderRef}`, "c");
  assert.equal(s.status, 404);
});

test("too many open orders in 30 minutes is refused", async () => {
  await q("UPDATE payment_orders SET status = 'expired' WHERE status IN ('created','pending')");
  for (let i = 0; i < 3; i++) assert.equal((await call("POST", "/api/pay/order", "a", { sku: "topup_5" })).status, 200);
  const r = await call("POST", "/api/pay/order", "a", { sku: "topup_5" });
  assert.equal(r.status, 429);
  await q("UPDATE payment_orders SET status = 'expired' WHERE status IN ('created','pending')");
});

test("missing phone: asked for, then saved and used", async () => {
  const r1 = await call("POST", "/api/pay/order", "n", { sku: "agent_yearly" });
  assert.equal(r1.status, 400);
  assert.equal(r1.body.error, "PHONE_REQUIRED");
  const r2 = await call("POST", "/api/pay/order", "n", { sku: "agent_yearly", phone: "98111 22233" });
  assert.equal(r2.status, 200);
  assert.equal((await agent(AGENT_NOPHONE)).phone, "9811122233");
});

test("wrong audience and agency accounts are refused; unknown SKUs too", async () => {
  assert.equal((await call("POST", "/api/pay/order", "c", { sku: "agent_monthly" })).body.error, "WRONG_ACCOUNT_TYPE");
  assert.equal((await call("POST", "/api/pay/order", "a", { sku: "personal_yearly" })).body.error, "WRONG_ACCOUNT_TYPE");
  assert.equal((await call("POST", "/api/pay/order", "g", { sku: "agent_monthly" })).body.error, "ON_AGENCY");
  assert.equal((await call("POST", "/api/pay/order", "a", { sku: "agent_free_forever" })).body.error, "BAD_SKU");
  assert.equal((await call("POST", "/api/pay/order", undefined, { sku: "agent_monthly" })).status, 401);
});

test("consumer buys a year of Personal", async () => {
  const r = await call("POST", "/api/pay/order", "c", { sku: "personal_yearly" });
  assert.equal(cfOrders.get(r.body.orderRef)!.amount, 999);
  cfOrders.get(r.body.orderRef)!.status = "PAID";
  const s = await call("GET", `/api/pay/status/${r.body.orderRef}`, "c");
  assert.equal(s.body.status, "paid");
  const p = (await q("SELECT plan, paid_until, paid_billing FROM individual_profiles WHERE id = $1", [CONSUMER]))[0];
  assert.equal(p.plan, "paid");
  assert.equal(p.paid_billing, "annual");
  const days = (new Date(p.paid_until).getTime() - Date.now()) / 86400_000;
  assert.ok(days > 364 && days < 367);
  const b = await call("GET", "/api/pay/billing", "c");
  assert.equal(b.body.plan, "paid");
  assert.equal(b.body.payments.length, 1);
});

test("renewal reminders: once before the end, once at the end, only for the latest period", async () => {
  // CONSUMER bought a year earlier in this file. Move that period to end in 2 days.
  await q(`UPDATE payment_orders SET period_end = now() + interval '2 days'
            WHERE account_id = $1 AND status = 'paid'`, [CONSUMER]);
  assert.equal(await pay.sendRenewalReminders(), 1, "3 days before: one reminder");
  assert.equal(await pay.sendRenewalReminders(), 0, "never twice");
  await q(`UPDATE payment_orders SET period_end = now() - interval '1 day'
            WHERE account_id = $1 AND status = 'paid'`, [CONSUMER]);
  assert.equal(await pay.sendRenewalReminders(), 1, "at the end: one more");
  assert.equal(await pay.sendRenewalReminders(), 0);
  // AGENT paid two months back to back: only the later period's end counts.
  const rows = await q(`SELECT id FROM payment_orders WHERE account_id = $1 AND status = 'paid' AND period_end IS NOT NULL
                         ORDER BY period_end`, [AGENT]);
  assert.ok(rows.length >= 2);
  await q(`UPDATE payment_orders SET period_end = now() + interval '1 day' WHERE id = $1`, [rows[0].id]);
  await q(`UPDATE payment_orders SET period_end = now() + interval '30 days' WHERE id = $1`, [rows[rows.length - 1].id]);
  assert.equal(await pay.sendRenewalReminders(), 0, "paid ahead: no reminder");
});

test("housekeeping: 3-day grace, hand-set plans untouched, yearly checks refill once a month", async () => {
  // AGENT: ended 2 days ago (in grace). AGENT_NOPHONE: ended 4 days ago (past grace).
  await q("UPDATE agents SET plan = 'agent', plan_expires_at = now() - interval '2 days' WHERE id = $1", [AGENT]);
  await q("UPDATE agents SET plan = 'agent', plan_expires_at = now() - interval '4 days' WHERE id = $1", [AGENT_NOPHONE]);
  // A plan set by hand before payments existed: no end date.
  const HAND = "55555555-5555-5555-5555-555555555555";
  await q("INSERT INTO agents (id, email, plan, billing_cycle) VALUES ($1, 'h@x.in', 'agent', 'annual')", [HAND]);
  // A yearly buyer whose checks were last granted last month.
  const YEARLY = "66666666-6666-6666-6666-666666666666";
  await q(
    `INSERT INTO agents (id, email, plan, billing_cycle, plan_expires_at, checks_period)
     VALUES ($1, 'y@x.in', 'agent', 'annual', now() + interval '200 days', '2000-01')`,
    [YEARLY],
  );
  await q("INSERT INTO agent_credits (agent_id, balance) VALUES ($1, 3)", [YEARLY]);

  await pay.planHousekeeping();
  await pay.planHousekeeping(); // twice: must not refill twice

  assert.equal((await agent(AGENT)).plan, "agent", "still in grace");
  assert.equal((await agent(AGENT_NOPHONE)).plan, "free", "grace over");
  assert.equal((await agent(HAND)).plan, "agent", "no end date: never touched");
  assert.equal(await credits(YEARLY), 15, "3 + 12, once");
  assert.equal((await agent(YEARLY)).checks_period, pay.istMonth(new Date()));
});

test("a yearly plan refills on its own schedule: 12 times, never 13, and a monthly renewal does not stop it", async () => {
  await q("UPDATE payment_orders SET status = 'expired' WHERE status IN ('created','pending')");
  const r = await call("POST", "/api/pay/order", "n", { sku: "agent_yearly" });
  cfOrders.get(r.body.orderRef)!.status = "PAID";
  await call("GET", `/api/pay/status/${r.body.orderRef}`, "n");
  const start = await credits(AGENT_NOPHONE);

  // Five months and a day into the paid year: 5 refills are owed on top of the first 12.
  await q("UPDATE payment_orders SET period_start = now() - interval '5 months 1 day' WHERE order_ref = $1", [r.body.orderRef]);
  // A one-month renewal bought now must not stop the yearly refills.
  const m = await call("POST", "/api/pay/order", "n", { sku: "agent_monthly" });
  cfOrders.get(m.body.orderRef)!.status = "PAID";
  await call("GET", `/api/pay/status/${m.body.orderRef}`, "n");
  assert.equal((await agent(AGENT_NOPHONE)).billing_cycle, "monthly");

  await pay.planHousekeeping();
  await pay.planHousekeeping(); // twice: never twice
  assert.equal(await credits(AGENT_NOPHONE), start + 12 + 5 * 12, "monthly 12 + five yearly refills");

  // Past the end of the year: the total stops at 12 x 12.
  await q("UPDATE payment_orders SET period_start = now() - interval '12 months 10 days', period_end = now() - interval '10 days' WHERE order_ref = $1", [r.body.orderRef]);
  await pay.planHousekeeping();
  const row = (await q("SELECT checks_granted FROM payment_orders WHERE order_ref = $1", [r.body.orderRef]))[0];
  assert.equal(row.checks_granted, 144, "12 refills in a year, not 13");
});

test("checksEarned counts month days in India time", () => {
  const start = new Date("2026-01-31T05:00:00Z");
  assert.equal(pay.checksEarned("agent_yearly", start, new Date("2026-02-27T05:00:00Z")), 12);
  assert.equal(pay.checksEarned("agent_yearly", start, new Date("2026-02-28T05:00:00Z")), 24, "31 Jan + 1 month = 28 Feb");
  assert.equal(pay.checksEarned("agent_yearly", start, new Date("2030-01-01T00:00:00Z")), 144);
});
