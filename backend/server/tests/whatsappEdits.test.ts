import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cleanCustomerSet, cleanInterests, cleanLeadSet, freshEmptyCustomerDelete, freshUntouchedLeadDelete,
  guardedUpdate, money, norm, registerWaEdits,
} from "../whatsapp/edits";
import { strictAmount, cleanFixValue, fixFieldsFor, cleanClaimSet } from "../whatsapp/editRules";

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

test("undo (restore) needs the server's own token: arbitrary text can never be written that way", async () => {
  process.env.WA_BOT_KEY = "k".repeat(40);
  const h = harness((sql) => (sql.startsWith("UPDATE") ? { rows: [{ ...leadRow, phone: "anything at all" }], rowCount: 1 } : { rows: [leadRow] }));
  const forged = await h.call("POST /api/internal/wa/leads/:id/edit", { id: LEAD }, { restore: true, set: { phone: "anything at all" }, expect: { phone: "9800000000" } });
  assert.equal(forged.status, 400);
  assert.match(forged.json.fields.token, /only for a change saved here/);
  const wrong = await h.call("POST /api/internal/wa/leads/:id/edit", { id: LEAD }, { restore: true, set: { phone: "anything at all" }, expect: { phone: "9800000000" }, token: "f".repeat(64) });
  assert.equal(wrong.status, 400);
  assert.ok(!h.calls.some((c) => c.sql.startsWith("UPDATE")), "nothing written without a valid token");
});

test("undo (restore) puts back a value today's rules would reject, with the token from the save, still compare-before", async () => {
  process.env.WA_BOT_KEY = "k".repeat(40);
  const before = { ...leadRow, insurance_interest: "health insurance", phone: "022 2345 6789" };
  const saved = harness((sql) => (sql.startsWith("UPDATE") ? { rows: [{ ...before, insurance_interest: "Motor", phone: "9812345678" }], rowCount: 1 } : { rows: [before] }));
  const s1 = await saved.call("POST /api/internal/wa/leads/:id/edit", { id: LEAD }, { set: { insurance_interest: "motor", phone: "9812345678" }, expect: { insurance_interest: "health insurance", phone: "022 2345 6789" } });
  assert.equal(s1.status, 200);
  assert.match(s1.json.undoToken, /^[0-9a-f]{64}$/);
  const h = harness((sql) => (sql.startsWith("UPDATE") ? { rows: [before], rowCount: 1 } : { rows: [{ ...before, insurance_interest: "Motor", phone: "9812345678" }] }));
  const r = await h.call("POST /api/internal/wa/leads/:id/edit", { id: LEAD },
    { restore: true, set: { insurance_interest: "health insurance", phone: "022 2345 6789" }, expect: { insurance_interest: "Motor", phone: "9812345678" }, token: s1.json.undoToken });
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

/* ── Stage 2b: policies ── */

const POL = "44444444-4444-4444-8444-444444444444";
const motorRow = {
  insurance_type: "motor", status: "done", insurer: "Some General", policy_name: "Car Plan", policyholder_name: "Ramesh Kumar", expiry_date: "2027-03-01", sum_insured: "500000.00",
  extracted_data: { _rev: 3, insurer: "Some General", plan_name: "Car Plan", policy_expiry_date: "2027-03-01", idv: 500000, premium: 15400 },
};

test("policy fields: health is refused, and only allowlisted fields of that type", async () => {
  const h = harness(() => ({ rows: [{ ...motorRow, insurance_type: "health" }] }));
  const r = await h.call("POST /api/internal/wa/clients/:id/fields", { id: POL }, { set: { premium: 1 }, expectRev: 0 });
  assert.equal(r.status, 400);
  assert.equal(r.json.error, "NOT_EDITABLE");
  const m = harness(() => ({ rows: [motorRow] }));
  const r2 = await m.call("POST /api/internal/wa/clients/:id/fields", { id: POL }, { set: { insurer_name: "Other" }, expectRev: 3 });
  assert.equal(r2.status, 400);
  assert.match(r2.json.fields.insurer_name, /cannot be changed/);
  const r3 = await m.call("POST /api/internal/wa/clients/:id/fields", { id: POL }, { set: { premium: "" }, expectRev: 3 });
  assert.equal(r3.json.fields.premium, "a value is needed", "clearing a value is for the portal");
  const r4 = await m.call("POST /api/internal/wa/clients/:id/fields", { id: POL }, { set: { premium: 14500 } });
  assert.equal(r4.status, 400, "the revision seen before is required");
  assert.ok(!m.calls.some((c) => c.sql.startsWith("UPDATE")));
});

test("policy fields: saved through the portal's own save, with the revision check", async () => {
  process.env.WA_BOT_KEY = "k".repeat(40);
  const h = harness((sql) => (sql.startsWith("UPDATE") ? { rows: [], rowCount: 1 } : { rows: [motorRow] }));
  const r = await h.call("POST /api/internal/wa/clients/:id/fields", { id: POL }, { set: { premium: "14,500" }, expectRev: 3 });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.before, { premium: 15400 });
  assert.deepEqual(r.json.after, { premium: 14500 });
  assert.equal(r.json.rev, 4);
  const upd = h.calls.find((c) => c.sql.includes("UPDATE clients SET"))!;
  assert.match(upd.sql, /extracted_data->>'_rev'/);
  assert.equal(upd.params[10], 3, "only if nobody saved in between");
  const stale = harness(() => ({ rows: [motorRow] }));
  assert.equal((await stale.call("POST /api/internal/wa/clients/:id/fields", { id: POL }, { set: { premium: 14500 }, expectRev: 2 })).status, 409);
});

test("policy fields: refused when the save would blank a column only the record's columns hold", async () => {
  const old = { ...motorRow, extracted_data: { _rev: 0, premium: 15400 } };
  const h = harness(() => ({ rows: [old] }));
  const r = await h.call("POST /api/internal/wa/clients/:id/fields", { id: POL }, { set: { premium: 14500 }, expectRev: 0 });
  assert.equal(r.status, 400);
  assert.equal(r.json.error, "NOT_EDITABLE");
  assert.ok(!h.calls.some((c) => c.sql.startsWith("UPDATE")));
});

test("policy fields undo: needs the token from the save, and the value must still be what was saved", async () => {
  process.env.WA_BOT_KEY = "k".repeat(40);
  const s = harness((sql) => (sql.startsWith("UPDATE") ? { rows: [], rowCount: 1 } : { rows: [motorRow] }));
  const saved = await s.call("POST /api/internal/wa/clients/:id/fields", { id: POL }, { set: { premium: 14500 }, expectRev: 3 });
  const now = { ...motorRow, extracted_data: { ...motorRow.extracted_data, premium: 14500, _rev: 4 } };
  const forged = harness(() => ({ rows: [now] }));
  const f = await forged.call("POST /api/internal/wa/clients/:id/fields", { id: POL }, { restore: true, set: { premium: 1 }, expect: { premium: 14500 }, expectRev: 4, token: saved.json.undoToken });
  assert.equal(f.status, 400);
  const moved = harness(() => ({ rows: [{ ...now, extracted_data: { ...now.extracted_data, premium: 99 } }] }));
  const m = await moved.call("POST /api/internal/wa/clients/:id/fields", { id: POL }, { restore: true, set: { premium: 15400 }, expect: { premium: 14500 }, expectRev: 4, token: saved.json.undoToken });
  assert.equal(m.status, 409, "changed again in the portal: undo does nothing");
  const ok = harness((sql) => (sql.startsWith("UPDATE") ? { rows: [], rowCount: 1 } : { rows: [now] }));
  const u = await ok.call("POST /api/internal/wa/clients/:id/fields", { id: POL }, { restore: true, set: { premium: 15400 }, expect: { premium: 14500 }, expectRev: 4, token: saved.json.undoToken });
  assert.equal(u.status, 200);
  assert.deepEqual(u.json.after, { premium: 15400 });
});

test("client details on a policy: compare-before, any type; sharing only flips the flag", async () => {
  const h = harness((sql) => (sql.startsWith("UPDATE") ? { rows: [{ client_phone: "9812345678" }], rowCount: 1 } : { rows: [] }));
  const nb = await h.call("POST /api/internal/wa/clients/:id/client-details", { id: POL }, { set: { client_phone: "98123 45678" } });
  assert.equal(nb.status, 400, "no blind writes");
  const r = await h.call("POST /api/internal/wa/clients/:id/client-details", { id: POL }, { set: { client_phone: "98123 45678" }, expect: { client_phone: null } });
  assert.equal(r.status, 200);
  assert.equal(r.json.after.client_phone, "9812345678");
  const bad = await h.call("POST /api/internal/wa/clients/:id/client-details", { id: POL }, { set: { score: 100 }, expect: {} });
  assert.equal(bad.status, 400);
  const sh = await h.call("POST /api/internal/wa/clients/:id/sharing", { id: POL }, { enabled: false, expectEnabled: true });
  assert.equal(sh.status, 200);
  const upd = h.calls.filter((c) => c.sql.startsWith("UPDATE")).pop()!;
  assert.match(upd.sql, /SET share_enabled = \$3\s+WHERE/);
  assert.doesNotMatch(upd.sql, /share_token/, "the link stays, so turning sharing back on gives the same link");
  const none = harness(() => ({ rows: [], rowCount: 0 }));
  assert.equal((await none.call("POST /api/internal/wa/clients/:id/sharing", { id: POL }, { enabled: false, expectEnabled: true })).status, 409);
});

/* ── Stage 2b critic findings (2026-10-22) ── */

test("amounts are read exactly as written: never letters or stray numbers stripped away", () => {
  assert.equal(strictAmount("Rs. 5,00,000/-"), 500000);
  assert.equal(strictAmount("₹15,400"), 15400);
  assert.equal(strictAmount("2 lakh 50 hazar"), null);
  assert.equal(strictAmount("1 crore for family of 4"), null);
  assert.deepEqual(cleanFixValue("money", "15,400 right"), { ok: false, error: "not an amount" });
});

test("UNDO of a detail that was empty before is allowed (the token proves this chat filled it)", async () => {
  process.env.WA_BOT_KEY = "k".repeat(40);
  const empty = { ...motorRow, sum_insured: null, extracted_data: { ...motorRow.extracted_data, idv: null } };
  const s = harness((sql) => (sql.startsWith("UPDATE") ? { rows: [], rowCount: 1 } : { rows: [empty] }));
  const saved = await s.call("POST /api/internal/wa/clients/:id/fields", { id: POL }, { set: { idv: 600000 }, expectRev: 3 });
  assert.equal(saved.status, 200);
  const now = { ...empty, sum_insured: "600000", extracted_data: { ...empty.extracted_data, idv: 600000, _rev: 4 } };
  const u = harness((sql) => (sql.startsWith("UPDATE") ? { rows: [], rowCount: 1 } : { rows: [now] }));
  const r = await u.call("POST /api/internal/wa/clients/:id/fields", { id: POL }, { restore: true, set: { idv: null }, expect: { idv: 600000 }, expectRev: 4, token: saved.json.undoToken });
  assert.equal(r.status, 200);
});

test("a detail kept only in the column: shown as the portal shows it, and not overwritten blind", async () => {
  const colOnly = { ...motorRow, id: POL, policy_identifier: null, client_email: null, client_phone: null, share_enabled: null, extracted_data: { ...motorRow.extracted_data, idv: null } };
  const g = harness(() => ({ rows: [colOnly] }));
  const got = await g.call("GET /api/internal/wa/clients/:id/fields", { id: POL });
  assert.equal(got.json.fields.find((f: any) => f.key === "idv").value, "500000.00");
  assert.equal(got.json.shareEnabled, false, "null share_enabled is off, as the public report treats it");
  const r = await g.call("POST /api/internal/wa/clients/:id/fields", { id: POL }, { set: { idv: 600000 }, expectRev: 3 });
  assert.equal(r.json.error, "NOT_EDITABLE");
});

test("a column fixed elsewhere is never put back by a premium fix; a policy still being read is refused", async () => {
  const fixed = { ...motorRow, insurer: "Corrected General" };
  const h = harness(() => ({ rows: [fixed] }));
  assert.equal((await h.call("POST /api/internal/wa/clients/:id/fields", { id: POL }, { set: { premium: 14500 }, expectRev: 3 })).json.error, "NOT_EDITABLE");
  const reading = harness(() => ({ rows: [{ ...motorRow, status: "processing" }] }));
  assert.equal((await reading.call("POST /api/internal/wa/clients/:id/fields", { id: POL }, { set: { premium: 14500 }, expectRev: 3 })).json.error, "NOT_EDITABLE");
  assert.ok(!h.calls.some((c) => c.sql.startsWith("UPDATE")) && !reading.calls.some((c) => c.sql.startsWith("UPDATE")));
});

test("motor with an own-damage date: 'expiry' edits the OD date, the one renewals read", async () => {
  const od = { ...motorRow, extracted_data: { ...motorRow.extracted_data, od_expiry_date: "2026-12-01" }, expiry_date: "2026-12-01" };
  const h = harness((sql) => (sql.startsWith("UPDATE") ? { rows: [], rowCount: 1 } : { rows: [od] }));
  assert.equal(fixFieldsFor("motor", od.extracted_data).find((f) => f.words.includes("expiry"))!.key, "od_expiry_date");
  const r = await h.call("POST /api/internal/wa/clients/:id/fields", { id: POL }, { set: { od_expiry_date: "2027-12-01" }, expectRev: 3 });
  assert.equal(r.status, 200);
  const upd = h.calls.find((c) => c.sql.includes("UPDATE clients SET"))!;
  assert.equal(upd.params[3], "2027-12-01", "clients.expiry_date moves with it");
  assert.equal((await h.call("POST /api/internal/wa/clients/:id/fields", { id: POL }, { set: { policy_expiry_date: "2027-12-01" }, expectRev: 3 })).status, 400);
});

test("a policyholder name fixed on a non-health policy is kept in the saved details too", async () => {
  const h = harness((sql) => (sql.startsWith("UPDATE") ? { rows: [{ policyholder_name: "Ramesh K Kumar" }], rowCount: 1 } : { rows: [] }));
  await h.call("POST /api/internal/wa/clients/:id/client-details", { id: POL }, { set: { policyholder_name: "Ramesh K Kumar" }, expect: { policyholder_name: "Ramesh Kumar" } });
  const upd = h.calls.find((c) => c.sql.startsWith("UPDATE"))!;
  assert.match(upd.sql, /jsonb_set\(jsonb_set\(extracted_data, '\{policyholder_name\}', to_jsonb\(\$3::text\)\), '\{_rev\}'/);
  assert.match(upd.sql, /<> 'health'/, "a health check's stored report is left alone");
});

/* ── Stage 2c: claims ── */

const CLM = "88888888-8888-4888-8888-888888888888";
const claimRowOpen = { id: CLM, status: "submitted", claim_type: "reimbursement", insurer: "Some Health", tpa: null, policy_number: null, hospital: "City Hospital", ailment: null, claimed_amount: "150000.00", settled_amount: null, admitted_on: "2026-10-01", discharged_on: null, customer_id: CUST, customer_name: "Sunita Rao" };

test("claim rules: no settled amount, nothing cleared, strict amounts and dates", () => {
  assert.equal(cleanClaimSet({ settled_amount: 1 }).errors.settled_amount, "cannot be changed from WhatsApp");
  assert.equal(cleanClaimSet({ hospital: "" }).errors.hospital, "a value is needed");
  assert.equal(cleanClaimSet({ claimed_amount: "2 lakh 50 hazar" }).errors.claimed_amount, "not an amount");
  assert.deepEqual(cleanClaimSet({ claimed_amount: "₹1,85,000", claim_type: "Cashless", admitted_on: "2026-10-01" }).set, { claimed_amount: 185000, claim_type: "cashless", admitted_on: "2026-10-01" });
  assert.equal(cleanClaimSet({ admitted_on: "01/10/2026" }).errors.admitted_on, "not a date");
});

test("claim edit: compare-before includes the stage, closed claims refused, settled pair checked", async () => {
  const h = harness((sql) => (sql.startsWith("UPDATE") ? { rows: [claimRowOpen], rowCount: 1 } : { rows: [{ ...claimRowOpen, hospital: "Apollo" }] }));
  const r = await h.call("POST /api/internal/wa/claims/:id/edit", { id: CLM }, { set: { hospital: "Apollo" }, expect: { hospital: "City Hospital" } });
  assert.equal(r.status, 200);
  const upd = h.calls.find((c) => c.sql.startsWith("UPDATE"))!;
  assert.match(upd.sql, /status::text IS NOT DISTINCT FROM/);
  assert.match(upd.sql, /updated_at = now\(\)/);
  const ev = h.calls.find((c) => c.sql.includes("INSERT INTO claim_events"))!;
  assert.equal(ev.params[2], "details_edited");
  assert.match(String(ev.params[3]), /Hospital: City Hospital → Apollo \(WhatsApp\)/);
  const cl = harness(() => ({ rows: [{ ...claimRowOpen, status: "settled" }] }));
  assert.equal((await cl.call("POST /api/internal/wa/claims/:id/edit", { id: CLM }, { set: { hospital: "X" }, expect: { hospital: "City Hospital" } })).json.error, "CLOSED");
  const st = harness(() => ({ rows: [{ ...claimRowOpen, settled_amount: "100000.00" }] }));
  assert.match((await st.call("POST /api/internal/wa/claims/:id/edit", { id: CLM }, { set: { claimed_amount: 90000 }, expect: { claimed_amount: "150000.00" } })).json.fields.claimed_amount, /below the amount already settled/);
  const dt = harness(() => ({ rows: [claimRowOpen] }));
  assert.match((await dt.call("POST /api/internal/wa/claims/:id/edit", { id: CLM }, { set: { discharged_on: "2026-09-01" }, expect: { discharged_on: null } })).json.fields.discharged_on, /before the admission/);
});

test("claim stage: open stages only, never into or out of closed; query_raised only by undo with the token", async () => {
  process.env.WA_BOT_KEY = "k".repeat(40);
  const h = harness((sql) => (sql.startsWith("UPDATE") ? { rows: [{ id: CLM }], rowCount: 1 } : { rows: [] }));
  assert.equal((await h.call("POST /api/internal/wa/claims/:id/stage", { id: CLM }, { to: "settled", from: "submitted" })).status, 400);
  assert.equal((await h.call("POST /api/internal/wa/claims/:id/stage", { id: CLM }, { to: "submitted", from: "rejected" })).status, 400);
  assert.equal((await h.call("POST /api/internal/wa/claims/:id/stage", { id: CLM }, { to: "query_raised", from: "under_process" })).status, 400);
  const ok = await h.call("POST /api/internal/wa/claims/:id/stage", { id: CLM }, { to: "under_process", from: "query_raised" });
  assert.equal(ok.status, 200);
  const upd = h.calls.find((c) => c.sql.startsWith("UPDATE"))!;
  assert.match(upd.sql, /status = \$4 AND status NOT IN \('settled', 'rejected'\)/);
  const back = await h.call("POST /api/internal/wa/claims/:id/stage", { id: CLM }, { to: "query_raised", from: "under_process", restore: true, token: ok.json.undoToken });
  assert.equal(back.status, 200);
  const forged = await h.call("POST /api/internal/wa/claims/:id/stage", { id: CLM }, { to: "query_raised", from: "submitted", restore: true, token: ok.json.undoToken });
  assert.equal(forged.status, 400);
});

test("query logged: in one transaction with the claim locked, refused if the stage moved", async () => {
  const h = harness((sql) => (sql.includes("FOR UPDATE") ? { rows: [{ status: "submitted" }] } : sql.includes("MAX(seq)") ? { rows: [{ next: 2 }] } : { rows: [], rowCount: 1 }));
  const r = await h.call("POST /api/internal/wa/claims/:id/queries", { id: CLM }, { question: "Discharge summary needed", from: "submitted" });
  assert.equal(r.status, 200);
  assert.equal(r.json.seq, 2);
  assert.deepEqual(h.calls.map((c) => c.sql.split(/\s/)[0]).filter((w) => ["BEGIN", "COMMIT"].includes(w)), ["BEGIN", "COMMIT"]);
  const moved = harness((sql) => (sql.includes("FOR UPDATE") ? { rows: [{ status: "under_process" }] } : { rows: [], rowCount: 1 }));
  assert.equal((await moved.call("POST /api/internal/wa/claims/:id/queries", { id: CLM }, { question: "Bills", from: "submitted" })).status, 409);
  assert.ok(!moved.calls.some((c) => c.sql.startsWith("INSERT INTO claim_queries")));
});

test("query answered moves the claim on only from query_raised, and its undo needs the token", async () => {
  process.env.WA_BOT_KEY = "k".repeat(40);
  const h = harness((sql) => (sql.includes("FOR UPDATE") ? { rows: [{ status: "query_raised" }] } : sql.startsWith("UPDATE claim_queries") ? { rows: [{ resolved_on: "2026-10-22" }], rowCount: 1 } : sql.includes("count(*)") ? { rows: [{ n: 0 }] } : { rows: [], rowCount: 1 }));
  const r = await h.call("POST /api/internal/wa/claims/:id/queries/:seq/answered", { id: CLM, seq: "1" });
  assert.equal(r.json.moved, true);
  assert.ok(h.calls.some((c) => c.sql.includes("status = 'under_process'")));
  const u = harness(() => ({ rows: [{ id: CLM }], rowCount: 1 }));
  assert.equal((await u.call("POST /api/internal/wa/claims/:id/queries/:seq/reopen", { id: CLM, seq: "1" }, { resolvedOn: "2026-10-22", moved: true, token: r.json.undoToken })).status, 200);
  assert.equal((await u.call("POST /api/internal/wa/claims/:id/queries/:seq/reopen", { id: CLM, seq: "1" }, { resolvedOn: "2026-10-22", moved: false, token: r.json.undoToken })).status, 400);
});

test("claim open needs an existing customer; undo-create compares every created value and nothing added", async () => {
  const h = harness((sql) => (sql.includes("FROM customers WHERE") ? { rows: [{ id: CUST }] } : sql.startsWith("INSERT INTO claims") ? { rows: [{ id: CLM }] } : { rows: [{ ...claimRowOpen, status: "opened" }] }));
  assert.equal((await h.call("POST /api/internal/wa/claims", {}, { set: {} })).status, 400);
  const r = await h.call("POST /api/internal/wa/claims", {}, { customerId: CUST, set: { claim_type: "cashless", hospital: "Apollo" } });
  assert.equal(r.status, 200);
  assert.equal(Object.keys(r.json.created).length, 10);
  const d = harness(() => ({ rows: [], rowCount: 0 }));
  assert.equal((await d.call("POST /api/internal/wa/claims/:id/undo-create", { id: CLM }, { expect: { hospital: "Apollo" } })).status, 400);
  const ok = harness(() => ({ rows: [{ id: CLM }], rowCount: 1 }));
  await ok.call("POST /api/internal/wa/claims/:id/undo-create", { id: CLM }, { expect: r.json.created });
  const del = ok.calls.find((c) => c.sql.startsWith("DELETE"))!;
  for (const re of [/interval '15 minutes'/, /status = 'opened'/, /claim_queries/, /claim_documents/, /x.status <> 'opened'/, /hospital::text IS NOT DISTINCT FROM/]) assert.match(del.sql, re);
});
