/** Book edits: every path refuses another advisor's rows. Fake db, no network, no model. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addManualPolicy, carryLeadPolicies, deleteClaim, linkRenewal, mergeCustomers, readFacts, saveHealthFacts,
} from "../services/bookStore";
import { deriveSharedColumns } from "../services/extractionFields";

const A = "aaaaaaaa-0000-4000-8000-000000000001";
const B = "bbbbbbbb-0000-4000-8000-000000000001";
const P = "11111111-0000-4000-8000-000000000001";
const Q = "22222222-0000-4000-8000-000000000001";
const L = "33333333-0000-4000-8000-000000000001";

type Handler = [RegExp, (p: any[], sql: string) => any];
function db(handlers: Handler[]) {
  const calls: { sql: string; params: any[] }[] = [];
  return {
    calls,
    async query(sql: string, params: any[]) {
      const t = sql.replace(/\s+/g, " ").trim();
      calls.push({ sql: t, params });
      for (const [re, fn] of handlers) if (re.test(t)) { const r = fn(params, t); return Array.isArray(r) ? { rows: r, rowCount: r.length } : r; }
      throw new Error("unexpected query: " + t.slice(0, 120));
    },
  };
}
const tx = (d: any) => async (fn: any) => fn(d);
const report = {
  identity: { insurer_name: "Care" }, policy_timeline: { policy_expiry_date: "2026-01-01" },
  coverage_structure: { base_sum_insured: 500000 }, premium: { amount: 100, frequency: "yearly" }, audit_score: { score: 60 },
};
const health = (over: any = {}) => db([
  [/^SELECT status/, ([id, ag]) => (id === P && ag === A ? [{ status: "done", insurance_type: "health", report_data: report, extracted_data: null, ...over }] : [])],
  [/^UPDATE clients SET insurer/, () => ({ rows: [], rowCount: 1 })],
]);

test("health facts: another advisor gets 404 and nothing is written", async () => {
  const d = health();
  assert.equal((await saveHealthFacts(d, B, P, { insurer: "X" })).status, 404);
  assert.ok(!d.calls.some((c) => c.sql.startsWith("UPDATE")));
});

test("health facts: report and columns move together, score stays, old values kept internal", async () => {
  const d = health();
  const r = await saveHealthFacts(d, A, P, { expiry_date: "2027-03-31", sum_insured: "10 lakh", premium: 24000 }, new Date("2026-11-24T05:00:00Z"));
  assert.equal(r.status, 200);
  const u = d.calls.find((c) => c.sql.startsWith("UPDATE"))!;
  const next = JSON.parse(u.params[8]);
  assert.equal(next.policy_timeline.policy_expiry_date, "2027-03-31");
  assert.equal(next.coverage_structure.base_sum_insured, 1000000);
  assert.equal(next.identity.insurer_name, "Care");
  assert.equal(next.audit_score.score, 60);
  assert.equal(next.__corrected_on, "2026-11-24");
  assert.equal(next.__internal.corrections[0].was["policy_timeline.policy_expiry_date"], "2026-01-01");
  assert.equal(u.params[2], false, "insurer was not sent, so it is not written");
});

test("health facts: refused while being read, for other types, and for unreadable values", async () => {
  assert.equal((await saveHealthFacts(health({ status: "processing" }), A, P, { insurer: "X" })).status, 409);
  assert.equal((await saveHealthFacts(health({ insurance_type: "motor" }), A, P, { insurer: "X" })).status, 409);
  assert.equal((await saveHealthFacts(health(), A, P, { expiry_date: "31/03/2027" })).status, 400);
  assert.equal(readFacts({ premium: "approx 5k" }).errors.length, 1);
  assert.deepEqual(readFacts({ expiry_date: "" }).facts, { expiry_date: null });
});

test("manual add: name needed, another advisor's customer refused, dates checked", async () => {
  const mk = () => db([
    [/^SELECT id FROM customers/, ([id, ag]) => (id === Q && ag === A ? [{ id }] : [])],
    [/^INSERT INTO clients/, () => [{ id: P }]],
  ]);
  const deps = { deriveSharedColumns: deriveSharedColumns as any };
  assert.equal((await addManualPolicy(mk(), A, { type: "motor" }, deps)).status, 400);
  assert.equal((await addManualPolicy(mk(), B, { type: "motor", policyholder_name: "R", customer_id: Q }, deps)).status, 404);
  assert.equal((await addManualPolicy(mk(), A, { type: "motor", policyholder_name: "R", fields: { policy_expiry_date: "soon" } }, deps)).status, 400);
  const d = mk();
  const ok = await addManualPolicy(d, A, { type: "motor", policyholder_name: "Ramesh", customer_id: Q, policy_number: "PN1", fields: { policy_expiry_date: "2027-01-02", idv: "450000" } }, deps);
  assert.equal(ok.body.id, P);
  const ins = d.calls.find((c) => c.sql.startsWith("INSERT"))!;
  assert.equal(ins.params[0], A);
  assert.equal(ins.params[10], "2027-01-02");
  assert.equal(JSON.parse(ins.params[7]).policy_number, "PN1");
});

test("renewal link: both policies must be the advisor's; works without the column", async () => {
  const mk = (owner: string) => db([
    [/^SELECT id, customer_id/, ([ids, ag]) => (ag === owner ? ids.map((id: string) => ({ id, customer_id: Q })) : [])],
    [/renewed_from/, () => { throw Object.assign(new Error("no column"), { code: "42703" }); }],
    [/^UPDATE clients SET customer_id/, () => ({ rows: [], rowCount: 1 })],
  ]);
  assert.equal((await linkRenewal(mk(A), B, P, Q)).status, 404);
  assert.equal((await linkRenewal(mk(A), A, P, P)).status, 404);
  const r = await linkRenewal(mk(A), A, P, Q);
  assert.equal(r.status, 200);
  assert.equal(r.body.linked, false);
});

test("merge: another advisor's customer stops it before any write", async () => {
  const d = db([[/FROM customers WHERE id = ANY/, () => [{ id: P }]]]);
  assert.equal((await mergeCustomers(tx(d), A, P, Q)).status, 404);
  assert.equal(d.calls.length, 1);
});

test("merge: moves every table it finds, checks none is left, deletes last", async () => {
  const cols = [{ tbl: "clients", col: "customer_id" }, { tbl: "claims", col: "customer_id" }];
  const mk = (left: number) => db([
    [/FROM customers WHERE id = ANY/, () => [{ id: P }, { id: Q }]],
    [/pg_constraint/, () => cols],
    [/^UPDATE public\./, () => ({ rows: [], rowCount: 2 })],
    [/^SELECT count/, () => [{ n: left }]],
    [/^UPDATE customers k/, () => ({ rows: [], rowCount: 1 })],
    [/^DELETE FROM customers/, () => ({ rows: [], rowCount: 1 })],
  ]);
  const d = mk(0);
  const r = await mergeCustomers(tx(d), A, P, Q);
  assert.deepEqual(r.body.moved, { clients: 2, claims: 2 });
  assert.match(d.calls.at(-1)!.sql, /^DELETE FROM customers/);
  assert.deepEqual(d.calls.at(-1)!.params, [Q, A]);
  const bad = mk(1);
  await assert.rejects(mergeCustomers(tx(bad), A, P, Q));
  assert.ok(!bad.calls.some((c) => c.sql.startsWith("DELETE")));
});

test("carry: needs a converted lead; a file that cannot move undoes the rest", async () => {
  const lp = [
    { id: "x1", insurance_type: "motor", due_date: "2027-02-01", file_url: "f1", premium: "9000", extracted_data: { idv: 400000 } },
    { id: "x2", insurance_type: "life", due_date: "2027-03-01", file_url: "f2", extracted_data: { maturity_date: "2040-01-01" } },
  ];
  const mk = () => db([
    [/FROM agent_leads/, ([id, ag]) => (id === L && ag === A ? [{ id, name: "R", customer_id: Q }] : [])],
    [/FROM lead_policies WHERE lead_id/, () => lp],
    [/^INSERT INTO clients/, () => ({ rows: [], rowCount: 1 })],
    [/^DELETE FROM lead_policies/, () => ({ rows: [], rowCount: 1 })],
  ]);
  const undone: string[] = []; const dropped: string[] = [];
  const files = (fail?: string) => ({
    newId: () => P, copy: async (f: string) => (f === fail ? null : { url: "u" + f, path: "p" + f }),
    undo: async (p: string) => { undone.push(p); }, drop: async (f: string) => { dropped.push(f); },
  });
  assert.equal((await carryLeadPolicies(tx(mk()), B, L, files())).status, 409);
  assert.equal((await carryLeadPolicies(tx(mk()), A, L, files("f2"))).status, 502);
  assert.deepEqual(undone, ["pf1"]);
  assert.deepEqual(dropped, []);
  const d = mk();
  assert.equal((await carryLeadPolicies(tx(d), A, L, files())).body.moved, 2);
  const [m, l] = d.calls.filter((c) => c.sql.startsWith("INSERT"));
  assert.equal(m.params[10], "2027-02-01");
  assert.equal(l.params[10], "2040-01-01", "life keeps its maturity date, not the premium date");
  assert.equal(JSON.parse(l.params[7]).next_premium_date, "2027-03-01");
  assert.deepEqual(dropped, ["f1", "f2"]);
});

test("claim delete: own claims only; kept when the files cannot go; foreign paths untouched", async () => {
  const mk = () => db([
    [/FROM claims WHERE/, ([id, ag]) => (id === P && ag === A ? [{ id }] : [])],
    [/FROM claim_documents/, () => [{ storage_path: `${A}/claims/1.pdf` }, { storage_path: `${B}/claims/2.pdf` }]],
    [/^DELETE FROM claims/, () => ({ rows: [], rowCount: 1 })],
  ]);
  assert.equal((await deleteClaim(mk(), B, P, async () => true)).status, 404);
  const kept = mk();
  assert.equal((await deleteClaim(kept, A, P, async () => false)).status, 502);
  assert.ok(!kept.calls.some((c) => c.sql.startsWith("DELETE")));
  let sent: string[] = [];
  assert.equal((await deleteClaim(mk(), A, P, async (p) => { sent = p; return true; })).status, 200);
  assert.deepEqual(sent, [`${A}/claims/1.pdf`]);
});

test("sharing a hand-added policy: health shows what was typed, never the number; nothing typed, no link", async () => {
  const { shareDetails, canOpenShare, ADDED_BY_HAND } = await import("../../../shared/dataEntryShare");
  const h = { insurance_type: "health", filename: ADDED_BY_HAND, policyholder_name: "R", insurer: "Care", sum_insured: 500000, expiry_date: "2027-01-02", extracted_data: { premium: 2000, premium_frequency: "monthly", policy_number: "SECRET" } };
  const d = shareDetails(h)!;
  assert.equal(d.type, "other");
  assert.equal(d.byHand, true);
  assert.deepEqual(Object.keys(d.fields).sort(), ["insurer", "policy_expiry_date", "policy_type_stated", "policyholder_name", "sum_insured"]);
  assert.equal(shareDetails({ ...h, extracted_data: { premium: 24000, premium_frequency: "yearly" } })!.fields.premium, 24000);
  assert.equal(canOpenShare({ insurance_type: "health", filename: ADDED_BY_HAND, policyholder_name: "R", extracted_data: {} }), false);
  assert.equal(shareDetails({ ...h, report_data: { a: 1 } }), null, "a report is shared as the report");
  assert.equal(shareDetails({ ...h, filename: "x.pdf" }), null);
  assert.equal(shareDetails({ insurance_type: "motor", filename: ADDED_BY_HAND, extracted_data: { policyholder_name: "R" } }), null);
  assert.equal(shareDetails({ insurance_type: "motor", filename: "x.pdf", extracted_data: { insurer: "A" } })!.byHand, false);
});

test("hand-added policies start with sharing off", async () => {
  const d = db([[/^INSERT INTO clients/, () => [{ id: P }]]]);
  await addManualPolicy(d, A, { type: "motor", policyholder_name: "R" }, { deriveSharedColumns: deriveSharedColumns as any });
  assert.match(d.calls[0].sql, /customer_id, share_enabled, created_at\).*\$13, false, NOW\(\)/);
});
