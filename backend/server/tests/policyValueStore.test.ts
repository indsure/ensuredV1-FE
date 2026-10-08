/**
 * Reads and saves for the surrender-value screens: tenant scoping, strict
 * values, evidence that cannot be lost, and save conflicts.
 *
 * NO NETWORK, NO REAL DB, NO MODEL CALL. A tiny in-memory stand-in for
 * Postgres answers the exact queries the handlers send, applying their WHERE
 * clauses by the parameters given. This proves the handlers scope every read
 * and write to the verified agent id. It does NOT prove anything about the
 * live database's row security, which is configured outside this repo.
 *
 * Run:  npx tsx --test backend/server/tests/policyValueStore.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  loadPolicyValueRows, saveExtractedData, mergeEvidence, validatePatch, type Db,
} from "../services/policyValueStore";

type Row = { id: string; agent_id: string; insurance_type: string; status: string; extracted_data: any; created_at: number };

function fakeDb(rows: Row[]): Db & { rows: Row[]; queries: string[] } {
  return {
    rows,
    queries: [],
    async query(text: string, params: unknown[]) {
      this.queries.push(text);
      const t = text.replace(/\s+/g, " ").trim();
      if (t.startsWith("SELECT id, name, policyholder_name")) {
        const agent = params[0];
        const out = rows.filter((r) => r.agent_id === agent && (r.insurance_type === "life" || r.insurance_type === "term"));
        return { rows: out.map((r) => ({ ...r })) };
      }
      if (t.startsWith("SELECT insurance_type, extracted_data FROM clients WHERE id = $1 AND agent_id = $2")) {
        const r = rows.find((x) => x.id === params[0] && x.agent_id === params[1]);
        return { rows: r ? [{ insurance_type: r.insurance_type, extracted_data: structuredClone(r.extracted_data) }] : [] };
      }
      if (t.startsWith("UPDATE clients SET")) {
        const [json, , , , , , id, agent, , , rev] = params as any[];
        const r = rows.find((x) => x.id === id && x.agent_id === agent && ((x.extracted_data?._rev ?? 0) === rev));
        if (!r) return { rows: [], rowCount: 0 };
        r.extracted_data = JSON.parse(json);
        return { rows: [], rowCount: 1 };
      }
      throw new Error("unexpected query: " + t.slice(0, 60));
    },
  };
}

const deps = { deriveSharedColumns: () => ({}), scoreFromExtractedData: () => null };

const seed = (): Row[] => [
  { id: "a1", agent_id: "agent-A", insurance_type: "life", status: "done", extracted_data: { premium: 50000 }, created_at: 1 },
  { id: "a2", agent_id: "agent-A", insurance_type: "health", status: "done", extracted_data: {}, created_at: 2 },
  { id: "b1", agent_id: "agent-B", insurance_type: "life", status: "done", extracted_data: { premium: 99999 }, created_at: 3 },
];

describe("tenant scoping", () => {
  test("the book read returns only the verified agent's life and term rows", async () => {
    const db = fakeDb(seed());
    const rows = await loadPolicyValueRows(db, "agent-A");
    assert.deepEqual(rows.map((r: any) => r.id), ["a1"]);
  });

  test("agent A cannot update agent B's policy: 404, and B's data is unchanged", async () => {
    const db = fakeDb(seed());
    const r = await saveExtractedData(db, "agent-A", "b1", { extracted_data: { premium: 1 } }, deps);
    assert.equal(r.status, 404);
    assert.equal(db.rows.find((x) => x.id === "b1")!.extracted_data.premium, 99999);
  });

  test("every UPDATE carries the agent id in its WHERE clause", async () => {
    const db = fakeDb(seed());
    await saveExtractedData(db, "agent-A", "a1", { extracted_data: { premium: 51000 } }, deps);
    const upd = db.queries.find((q) => q.includes("UPDATE clients"))!;
    assert.match(upd, /WHERE id = \$7 AND agent_id = \$8/);
  });
});

describe("values", () => {
  test("'Rs. 50,000' is stored as 50000; 'approx 50k' is refused with the field named", async () => {
    const db = fakeDb(seed());
    const ok = await saveExtractedData(db, "agent-A", "a1", { extracted_data: { premium: "Rs. 51,000" } }, deps);
    assert.equal(ok.status, 200);
    assert.equal(db.rows[0].extracted_data.premium, 51000);
    const bad = await saveExtractedData(db, "agent-A", "a1", { extracted_data: { premium: "approx 50k" } }, deps);
    assert.equal(bad.status, 400);
    assert.deepEqual(bad.body.fields, [{ field: "premium", reason: "not_a_number" }]);
  });

  test("an ambiguous date is refused", () => {
    const { errors } = validatePatch("life", {}, { start_date: "03/04/2018" });
    assert.deepEqual(errors, [{ field: "start_date", reason: "ambiguous_date" }]);
  });

  test("an old bad value nobody touched does not block an unrelated save", () => {
    const stored = { start_date: "03/04/2018", premium: 50000 };
    const { errors, clean } = validatePatch("life", stored, { start_date: "03/04/2018", premium: 52000 });
    assert.deepEqual(errors, []);
    assert.equal(clean.premium, 52000);
  });
});

describe("evidence is never lost", () => {
  const rec = (id: string) => ({ id, enteredOn: "2026-09-30", kind: "payment", amount: 50000, dueDate: "2025-03-15", paidOn: "2025-03-10" });

  test("a save cannot drop or rewrite a stored record", () => {
    const stored = { schema: 1, payments: [rec("p1")] };
    const incoming = { schema: 1, payments: [{ ...rec("p1"), amount: 1 }, rec("p2")] };
    const { evidence } = mergeEvidence(stored, incoming);
    assert.equal(evidence!.payments.length, 2);
    assert.equal(evidence!.payments[0].amount, 50000);
  });

  test("an older client without expected_rev cannot change evidence, even by resending its copy", async () => {
    const rows = seed();
    rows[0].extracted_data = { premium: 50000, _rev: 3, value_evidence: { schema: 1, payments: [rec("p1"), rec("p2")] } };
    const db = fakeDb(rows);
    const r = await saveExtractedData(db, "agent-A", "a1", {
      extracted_data: { premium: 50000, value_evidence: { schema: 1, payments: [rec("p1")] } },
    }, deps);
    assert.equal(r.status, 200);
    assert.equal(db.rows[0].extracted_data.value_evidence.payments.length, 2);
  });

  test("a stale save gets a 409 and changes nothing", async () => {
    const rows = seed();
    rows[0].extracted_data = { premium: 50000, _rev: 5 };
    const db = fakeDb(rows);
    const r = await saveExtractedData(db, "agent-A", "a1", { expected_rev: 4, extracted_data: { premium: 1 } }, deps);
    assert.equal(r.status, 409);
    assert.equal(db.rows[0].extracted_data.premium, 50000);
  });

  test("a current save appends evidence and moves the revision on", async () => {
    const rows = seed();
    rows[0].extracted_data = { premium: 50000, _rev: 5, value_evidence: { schema: 1, payments: [rec("p1")] } };
    const db = fakeDb(rows);
    const r = await saveExtractedData(db, "agent-A", "a1", {
      expected_rev: 5, extracted_data: { value_evidence: { schema: 1, payments: [rec("p1"), rec("p2")] } },
    }, deps);
    assert.equal(r.status, 200);
    assert.equal(r.body.rev, 6);
    assert.equal(db.rows[0].extracted_data.value_evidence.payments.length, 2);
  });

  test("a client cannot set the revision itself", async () => {
    const db = fakeDb(seed());
    await saveExtractedData(db, "agent-A", "a1", { extracted_data: { _rev: 999 } }, deps);
    assert.equal(db.rows[0].extracted_data._rev, 1);
  });

  test("two saves racing on the same revision: only one wins", async () => {
    const rows = seed();
    rows[0].extracted_data = { premium: 50000, _rev: 1 };
    const db = fakeDb(rows);
    // Both read revision 1 before either writes.
    const real = db.query.bind(db);
    let gate!: () => void;
    const both = new Promise<void>((res) => (gate = res));
    let reads = 0;
    db.query = async (text: string, params: unknown[]) => {
      const out = await real(text, params);
      if (text.trim().startsWith("SELECT insurance_type")) { reads += 1; if (reads === 2) gate(); await both; }
      return out;
    };
    const [x, y] = await Promise.all([
      saveExtractedData(db, "agent-A", "a1", { extracted_data: { premium: 51000 } }, deps),
      saveExtractedData(db, "agent-A", "a1", { extracted_data: { premium: 52000 } }, deps),
    ]);
    assert.deepEqual([x.status, y.status].sort(), [200, 409]);
  });
});
