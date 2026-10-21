import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cleanCustomerSet, cleanInterests, cleanLeadSet, freshEmptyCustomerDelete, freshUntouchedLeadDelete,
  guardedUpdate, money, norm, registerWaEdits,
} from "../whatsapp/edits";

const AGENT = "11111111-1111-4111-8111-111111111111";
const LEAD = "22222222-2222-4222-8222-222222222222";
const CUST = "33333333-3333-4333-8333-333333333333";

/* ── Value rules (mirror lib/leads.ts, lib/customers.ts) ── */

test("lead fields: only whitelisted keys, cleaned the portal's way", () => {
  const c = cleanLeadSet({ phone: "+91 98123-45678", city: "  Pune ", insurance_interest: "motor and health", expected_value: "25,000", source: "referral" });
  assert.deepEqual(c.errors, {});
  assert.deepEqual(c.set, { phone: "9812345678", city: "Pune", insurance_interest: "Health, Motor", expected_value: 25000, source: "Referral" });
  assert.deepEqual(cleanLeadSet({ notes: "x", agent_id: AGENT, customer_id: CUST }).errors, {
    notes: "cannot be changed from WhatsApp", agent_id: "cannot be changed from WhatsApp", customer_id: "cannot be changed from WhatsApp",
  });
  assert.equal(cleanLeadSet({ phone: "12345" }).errors.phone, "not a 10 digit mobile number");
  assert.equal(cleanLeadSet({ email: "nope" }).errors.email, "not an email address");
  assert.equal(cleanLeadSet({ status: "deleted" }).errors.status, "unknown status");
  assert.equal(cleanLeadSet({ next_follow_up: "2026-13-40" }).errors.next_follow_up, "not a date");
  assert.equal(cleanLeadSet({ name: "A" }).errors.name, "a name is needed");
  assert.deepEqual(cleanLeadSet({ city: "" }).set, { city: null }, "an empty value clears that one field only");
});

test("customer fields: whitelist, no notes, dates checked", () => {
  assert.deepEqual(cleanCustomerSet({ name: "Sunita Rao", dob: "1970-05-02" }).set, { name: "Sunita Rao", dob: "1970-05-02" });
  assert.equal(cleanCustomerSet({ notes: "x" }).errors.notes, "cannot be changed from WhatsApp");
  assert.equal(cleanCustomerSet({ dob: "02/05/1970" }).errors.dob, "not a date");
});

test("interests in the portal's chip order; amounts like lib/leads num()", () => {
  assert.equal(cleanInterests(["Term", "health"]), "Health, Term");
  assert.equal(cleanInterests("Health, Motor aur Life"), "Health, Motor, Life");
  assert.equal(cleanInterests("cricket"), null);
  assert.deepEqual(money("₹1,50,000"), { ok: true, value: 150000 });
  assert.deepEqual(money(""), { ok: true, value: null });
  assert.equal(money("-5").ok, true, "the portal strips the sign like this too");
});

test("norm makes stored and expected values comparable", () => {
  assert.equal(norm(new Date("2026-10-21T00:00:00Z")), "2026-10-21");
  assert.equal(norm("2026-10-21T00:00:00.000Z"), "2026-10-21");
  assert.equal(norm(25000), "25000");
  assert.equal(norm(""), null);
});

test("guarded update: writes only the set, checks every expected value, refuses foreign columns", () => {
  const q = guardedUpdate("agent_leads", ["phone", "city"], { phone: "9812345678" }, { phone: "9800000000" }, "updated_at = now()");
  assert.match(q.sql, /SET phone = \$3, updated_at = now\(\)/);
  assert.match(q.sql, /WHERE id = \$1 AND agent_id = \$2 AND phone::text IS NOT DISTINCT FROM \$4::text/);
  assert.deepEqual(q.params, ["9812345678", "9800000000"]);
  assert.throws(() => guardedUpdate("agent_leads", ["phone"], { agent_id: AGENT }, {}), /not allowed/);
  assert.throws(() => guardedUpdate("agent_leads", ["phone"], { phone: "x" }, { notes: "y" }), /not allowed/);
});

test("removal of a fresh creation: every reference that would be lost is checked", () => {
  const c = freshEmptyCustomerDelete();
  for (const t of ["clients", "claims", "agent_leads", "calculator_reports", "comparison_reports"]) assert.match(c, new RegExp(`FROM ${t} x WHERE x.customer_id = c.id`), t);
  assert.match(c, /created_at > now\(\) - interval '15 minutes'/);
  assert.match(c, /c.agent_id = \$2/);
  const l = freshUntouchedLeadDelete();
  assert.match(l, /lead_policies x WHERE x.lead_id = l.id/, "lead policies would cascade");
  assert.match(l, /updated_at <= l.created_at \+ interval '2 seconds'/, "changed since = not removable");
  assert.match(l, /customer_id IS NULL/);
});

/* ── Routes, with a scripted fake database ── */

type Call = { sql: string; params: unknown[] };
function harness(script: (sql: string, params: unknown[]) => { rows: any[]; rowCount?: number }) {
  const calls: Call[] = [];
  const query = async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    const r = script(sql, params);
    return { rows: r.rows, rowCount: r.rowCount ?? r.rows.length };
  };
  const pool = { query, connect: async () => ({ query, release() {} }) };
  const handlers = new Map<string, any>();
  const app: any = { get: (p: string, h: any) => handlers.set(`GET ${p}`, h), post: (p: string, h: any) => handlers.set(`POST ${p}`, h) };
  registerWaEdits(app, { pool: pool as any, log: { error() {}, warn() {} }, scopedAgent: async () => AGENT });
  const call = async (key: string, params: Record<string, string>, body: any = {}) => {
    let status = 200; let json: any = null;
    const res: any = { status(s: number) { status = s; return res; }, json(j: any) { json = j; return res; } };
    await handlers.get(key)({ params, body, headers: {} }, res);
    return { status, json };
  };
  return { calls, call, handlers };
}

const leadRow = { id: LEAD, name: "Amit Shah", phone: "9800000000", email: null, city: null, source: null, insurance_interest: null, expected_value: null, status: "new", next_follow_up: null, notes: null, customer_id: null, created_at: new Date(), updated_at: new Date() };

test("lead edit: invalid input never reaches the database", async () => {
  const h = harness(() => ({ rows: [] }));
  const r = await h.call("POST /api/internal/wa/leads/:id/edit", { id: LEAD }, { set: { phone: "123" } });
  assert.equal(r.status, 400);
  assert.equal(h.calls.length, 0);
});

test("lead edit: a change made in the portal meanwhile -> 409 CHANGED, nothing written", async () => {
  const h = harness((sql) => (sql.startsWith("UPDATE") ? { rows: [], rowCount: 0 } : { rows: [leadRow] }));
  const r = await h.call("POST /api/internal/wa/leads/:id/edit", { id: LEAD }, { set: { phone: "9812345678" }, expect: { phone: "9811111111" } });
  assert.equal(r.status, 409);
  assert.equal(r.json.error, "CHANGED");
  assert.ok(!h.calls.some((c) => c.sql.includes("access_audit_log")), "no audit row for a write that did not happen");
});

test("lead edit: saved, with before/after for undo and a whatsapp-bot audit row", async () => {
  const h = harness((sql) => (sql.startsWith("UPDATE") ? { rows: [{ ...leadRow, phone: "9812345678" }], rowCount: 1 } : { rows: [leadRow] }));
  const r = await h.call("POST /api/internal/wa/leads/:id/edit", { id: LEAD }, { set: { phone: "98123 45678" }, expect: { phone: "9800000000" } });
  assert.equal(r.status, 200);
  assert.equal(r.json.before.phone, "9800000000");
  assert.equal(r.json.lead.phone, "9812345678");
  const upd = h.calls.find((c) => c.sql.startsWith("UPDATE"))!;
  assert.match(upd.sql, /AND agent_id = \$2/);
  assert.deepEqual(upd.params.slice(0, 2), [LEAD, AGENT]);
  await new Promise((r) => setTimeout(r, 0));
  const audit = h.calls.find((c) => c.sql.includes("access_audit_log"))!;
  assert.match(audit.sql, /'whatsapp-bot'/);
  assert.equal(audit.params[2], "wa_lead_edit");
});

test("convert: refused when the lead already has a customer; otherwise one transaction", async () => {
  const h1 = harness((sql) => (sql.startsWith("SELECT") ? { rows: [{ ...leadRow, customer_id: CUST }] } : { rows: [] }));
  const r1 = await h1.call("POST /api/internal/wa/leads/:id/convert", { id: LEAD });
  assert.equal(r1.status, 409);
  assert.equal(r1.json.error, "ALREADY_CUSTOMER");
  assert.ok(!h1.calls.some((c) => c.sql.startsWith("INSERT INTO customers")), "no second customer");
  assert.ok(h1.calls.some((c) => c.sql === "ROLLBACK"));

  const h2 = harness((sql) => (sql.startsWith("SELECT") ? { rows: [leadRow] } : sql.startsWith("INSERT INTO customers") ? { rows: [{ id: CUST, name: "Amit Shah" }] } : { rows: [], rowCount: 1 }));
  const r2 = await h2.call("POST /api/internal/wa/leads/:id/convert", { id: LEAD });
  assert.equal(r2.status, 200);
  assert.deepEqual(h2.calls.filter((c) => /^(BEGIN|COMMIT)$/.test(c.sql)).map((c) => c.sql), ["BEGIN", "COMMIT"]);
  assert.match(h2.calls.find((c) => c.sql.startsWith("SELECT"))!.sql, /FOR UPDATE/);
  assert.deepEqual(r2.json.before, { status: "new", customer_id: null });
});

test("unconvert: only if the lead is still won and linked to that customer; customer removed only if fresh and empty", async () => {
  const h = harness((sql) => (sql.startsWith("UPDATE") ? { rows: [], rowCount: 0 } : { rows: [] }));
  const r = await h.call("POST /api/internal/wa/leads/:id/unconvert", { id: LEAD }, { customerId: CUST, status: "new" });
  assert.equal(r.status, 409);
  assert.ok(!h.calls.some((c) => c.sql.includes("DELETE")), "nothing removed when the lead moved on");
  const h2 = harness((sql) => (sql.startsWith("UPDATE") ? { rows: [{ id: LEAD }], rowCount: 1 } : sql.includes("DELETE") ? { rows: [], rowCount: 0 } : { rows: [] }));
  const r2 = await h2.call("POST /api/internal/wa/leads/:id/unconvert", { id: LEAD }, { customerId: CUST, status: "new" });
  assert.equal(r2.status, 200);
  assert.equal(r2.json.customerRemoved, false, "a customer with something filed under it stays");
});

test("customer create: same phone returns the existing customer, not a duplicate", async () => {
  const h = harness((sql) => (sql.startsWith("SELECT") ? { rows: [{ id: CUST, name: "Sunita Rao" }] } : { rows: [] }));
  const r = await h.call("POST /api/internal/wa/customers", {}, { name: "Sunita", phone: "9812345678" });
  assert.equal(r.json.duplicate, true);
  assert.ok(!h.calls.some((c) => c.sql.startsWith("INSERT INTO customers")));
});

test("file / unfile: compare-before on the policy's current customer, and the customer must be the advisor's", async () => {
  const h = harness((sql) => (sql.startsWith("SELECT 1 FROM customers") ? { rows: [] } : { rows: [], rowCount: 0 }));
  const r = await h.call("POST /api/internal/wa/clients/:id/file", { id: LEAD }, { customerId: CUST, expectCustomerId: null });
  assert.equal(r.status, 404, "another advisor's customer is never used");
  const h2 = harness((sql) => (sql.startsWith("SELECT 1") ? { rows: [{}] } : { rows: [], rowCount: 0 }));
  const r2 = await h2.call("POST /api/internal/wa/clients/:id/file", { id: LEAD }, { customerId: CUST, expectCustomerId: null });
  assert.equal(r2.status, 409);
  assert.match(h2.calls.find((c) => c.sql.startsWith("UPDATE clients"))!.sql, /customer_id IS NOT DISTINCT FROM \$4::uuid/);
});

test("customer undo-create: needs the values it was created with; refused unless fresh, empty and unchanged", async () => {
  const h = harness(() => ({ rows: [], rowCount: 0 }));
  const r0 = await h.call("POST /api/internal/wa/customers/:id/undo-create", { id: CUST });
  assert.equal(r0.status, 400, "no created values, no removal");
  assert.equal(h.calls.length, 0);
  const r = await h.call("POST /api/internal/wa/customers/:id/undo-create", { id: CUST }, { expect: { name: "Sunita Rao", phone: "9812345678" } });
  assert.equal(r.status, 409);
  assert.equal(r.json.error, "NOT_REMOVABLE");
  const del = h.calls.find((c) => c.sql.startsWith("DELETE"))!;
  assert.match(del.sql, /c.name IS NOT DISTINCT FROM \$3::text/);
  assert.match(del.sql, /c.notes IS NOT DISTINCT FROM \$8::text/);
  assert.deepEqual(del.params.slice(2), ["Sunita Rao", "9812345678", null, null, null, null], "notes must still be empty");
});

/* ── Critic round: compare-before is required, undo restores raw values ── */

test("an edit without the value seen before is refused (no blind writes)", async () => {
  const h = harness(() => ({ rows: [leadRow] }));
  const r = await h.call("POST /api/internal/wa/leads/:id/edit", { id: LEAD }, { set: { status: "lost" } });
  assert.equal(r.status, 400);
  assert.match(r.json.fields.status, /seen before is required/);
  assert.ok(!h.calls.some((c) => c.sql.startsWith("UPDATE")));
});

test("undo (restore) puts back a value today's rules would reject, still compare-before", async () => {
  const h = harness((sql) => (sql.startsWith("UPDATE") ? { rows: [{ ...leadRow, insurance_interest: "health insurance" }], rowCount: 1 } : { rows: [leadRow] }));
  const r = await h.call("POST /api/internal/wa/leads/:id/edit", { id: LEAD },
    { restore: true, set: { insurance_interest: "health insurance", phone: "022 2345 6789" }, expect: { insurance_interest: "Motor", phone: "9812345678" } });
  assert.equal(r.status, 200);
  const upd = h.calls.find((c) => c.sql.startsWith("UPDATE"))!;
  assert.ok(upd.params.includes("health insurance") && upd.params.includes("022 2345 6789"));
  assert.match(upd.sql, /insurance_interest::text IS NOT DISTINCT FROM/);
  const bad = await h.call("POST /api/internal/wa/leads/:id/edit", { id: LEAD }, { restore: true, set: { customer_id: CUST }, expect: { customer_id: null } });
  assert.equal(bad.status, 400, "restore never touches columns outside the whitelist");
});

test("removing a just-added lead compares every value the bot created, not the browser-written updated_at", () => {
  const l = freshUntouchedLeadDelete(true);
  for (const c of ["name", "phone", "email", "city", "source", "insurance_interest", "status", "notes"]) assert.match(l, new RegExp(`l.${c} IS NOT DISTINCT FROM`), c);
  assert.match(l, /l.expected_value::text IS NOT DISTINCT FROM \$9::text/);
  assert.doesNotMatch(l, /updated_at/);
  assert.match(l, /lead_policies/);
});

test("dates are read as text, so the server timezone can never shift them", async () => {
  const h = harness(() => ({ rows: [leadRow] }));
  await h.call("GET /api/internal/wa/leads/:id", { id: LEAD });
  assert.match(h.calls[0].sql, /next_follow_up::text AS next_follow_up/);
});
