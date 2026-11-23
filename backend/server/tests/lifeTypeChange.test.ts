/**
 * PATCH /api/agent/clients/:id/insurance-type (changeInsuranceType in
 * services/policyValueStore.ts): life <-> term only, scoped to the verified
 * agent, the stored read kept intact, expiry_date re-derived.
 *
 * NO NETWORK, NO REAL DB, NO MODEL CALL.
 * Run:  npx tsx --test backend/server/tests/lifeTypeChange.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { changeInsuranceType, lifeLaneExpiry, type Db } from "../services/policyValueStore";
import { deriveSharedColumns } from "../services/extractionFields";

type Row = { id: string; agent_id: string; insurance_type: string; extracted_data: any; expiry_date: string | null; insurer?: string | null };

function fakeDb(rows: Row[]): Db & { rows: Row[]; queries: string[] } {
  return {
    rows,
    queries: [],
    async query(text: string, params: unknown[]) {
      this.queries.push(text);
      const t = text.replace(/\s+/g, " ").trim();
      if (t.startsWith("SELECT insurance_type, extracted_data, expiry_date FROM clients WHERE id = $1 AND agent_id = $2")) {
        const r = rows.find((x) => x.id === params[0] && x.agent_id === params[1]);
        return { rows: r ? [{ insurance_type: r.insurance_type, extracted_data: structuredClone(r.extracted_data), expiry_date: r.expiry_date }] : [] };
      }
      if (t.startsWith("UPDATE clients SET insurance_type = $1")) {
        const [to, json, expiry, insurer, , , id, agent, from, rev] = params as any[];
        const r = rows.find((x) => x.id === id && x.agent_id === agent && x.insurance_type === from && (x.extracted_data?._rev ?? 0) === rev);
        if (!r) return { rows: [], rowCount: 0 };
        r.insurance_type = to;
        r.extracted_data = JSON.parse(json);
        r.expiry_date = expiry;
        r.insurer = insurer ?? r.insurer ?? null;
        return { rows: [], rowCount: 1 };
      }
      throw new Error("unexpected query: " + t.slice(0, 60));
    },
  };
}

const deps = { deriveSharedColumns };
const seed = (): Row[] => [
  { id: "l1", agent_id: "A", insurance_type: "life", expiry_date: "2063-01-10",
    extracted_data: { insurer: "ABSLI", maturity_date: "2063-01-10", maturity_amount: 2536800, _rev: 2 } },
  { id: "t1", agent_id: "A", insurance_type: "term", expiry_date: "2078-08-16",
    extracted_data: { insurer: "ABSLI", cover_end_date: "2078-08-16", sum_assured: 20000000 } },
  { id: "h1", agent_id: "A", insurance_type: "health", expiry_date: "2027-01-01", extracted_data: {} },
  { id: "b1", agent_id: "B", insurance_type: "life", expiry_date: null, extracted_data: { maturity_date: "2040-01-01" } },
];

describe("changeInsuranceType", () => {
  test("life to term keeps every stored key, bumps the revision, keeps the date", async () => {
    const db = fakeDb(seed());
    const r = await changeInsuranceType(db, "A", "l1", { to: "term" }, deps);
    assert.equal(r.status, 200);
    const row = db.rows.find((x) => x.id === "l1")!;
    assert.equal(row.insurance_type, "term");
    assert.equal(row.extracted_data.maturity_amount, 2536800);
    assert.equal(row.extracted_data._rev, 3);
    assert.equal(row.expiry_date, "2063-01-10"); // no cover_end_date: falls back to the maturity date
  });

  test("term to life uses the cover end date when no maturity date was read", async () => {
    const db = fakeDb(seed());
    const r = await changeInsuranceType(db, "A", "t1", { to: "life" }, deps);
    assert.equal(r.status, 200);
    const row = db.rows.find((x) => x.id === "t1")!;
    assert.equal(row.insurance_type, "life");
    assert.equal(row.expiry_date, "2078-08-16");
    assert.equal(row.extracted_data.sum_assured, 20000000);
  });

  test("same type: nothing written", async () => {
    const db = fakeDb(seed());
    const r = await changeInsuranceType(db, "A", "l1", { to: "life" }, deps);
    assert.equal(r.status, 200);
    assert.equal((r.body as any).changed, false);
    assert.ok(!db.queries.some((q) => q.includes("UPDATE")));
  });

  test("health cannot be changed to life (a different read lane)", async () => {
    const db = fakeDb(seed());
    const r = await changeInsuranceType(db, "A", "h1", { to: "life" }, deps);
    assert.equal(r.status, 409);
    assert.equal(db.rows.find((x) => x.id === "h1")!.insurance_type, "health");
  });

  test("only life or term is accepted as the new type", async () => {
    const db = fakeDb(seed());
    for (const to of ["health", "motor", "", null, undefined]) {
      const r = await changeInsuranceType(db, "A", "l1", { to }, deps);
      assert.equal(r.status, 400);
    }
    assert.equal((await changeInsuranceType(db, "A", "l1", null, deps)).status, 400);
  });

  test("agent A cannot change agent B's policy", async () => {
    const db = fakeDb(seed());
    const r = await changeInsuranceType(db, "A", "b1", { to: "term" }, deps);
    assert.equal(r.status, 404);
    assert.equal(db.rows.find((x) => x.id === "b1")!.insurance_type, "life");
  });

  test("the UPDATE is scoped to the agent, the old type and the revision", async () => {
    const db = fakeDb(seed());
    await changeInsuranceType(db, "A", "l1", { to: "term" }, deps);
    const upd = db.queries.find((q) => q.includes("UPDATE clients"))!;
    assert.match(upd, /WHERE id = \$7 AND agent_id = \$8 AND insurance_type = \$9/);
    assert.match(upd, /_rev'\)::int, 0\) = \$10/);
  });

  test("a save in between makes the change STALE, and nothing is written", async () => {
    const db = fakeDb(seed());
    const orig = db.query.bind(db);
    db.query = async (text: string, params: unknown[]) => {
      const res = await orig(text, params);
      if (text.trim().startsWith("SELECT")) db.rows.find((x) => x.id === "l1")!.extracted_data._rev = 9;
      return res;
    };
    const r = await changeInsuranceType(db, "A", "l1", { to: "term" }, deps);
    assert.equal(r.status, 409);
    assert.equal(db.rows.find((x) => x.id === "l1")!.insurance_type, "life");
  });
});

describe("lifeLaneExpiry", () => {
  test("own date first, then the other, then what is stored", () => {
    assert.equal(lifeLaneExpiry("life", { maturity_date: "2040-01-01", cover_end_date: "2050-01-01" }, "x"), "2040-01-01");
    assert.equal(lifeLaneExpiry("term", { maturity_date: "2040-01-01", cover_end_date: "2050-01-01" }, "x"), "2050-01-01");
    assert.equal(lifeLaneExpiry("term", { maturity_date: "2040-01-01" }, "x"), "2040-01-01");
    assert.equal(lifeLaneExpiry("life", {}, "2030-05-05"), "2030-05-05");
    assert.equal(lifeLaneExpiry("life", { maturity_date: "" }, null), null);
  });
});
