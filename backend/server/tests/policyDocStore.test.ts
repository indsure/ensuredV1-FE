/**
 * Migration 025 and the document-rules store, on a real Postgres engine
 * (PGlite, in process, throwaway). NOT Supabase, NOT the shared database.
 *
 * What this proves: the migration applies and rolls back; the handlers' SQL
 * scopes every read, write and review to the verified advisor; composite keys
 * stop provenance from crossing policies; history cannot be edited; retries
 * are idempotent; a stale review is refused; a new reading never inherits
 * approval. It also proves a non-service role sees no rows.
 *
 * What it cannot prove: the live database's settings (roles, RLS state), which
 * must be checked on the live project before release.
 *
 * Run:  npx tsx --test backend/server/tests/policyDocStore.test.ts
 */

import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

import {
  buildProductRuleCandidate, confirmedFactsFrom, confirmMany, getDocumentRules, recordParse, resolveFlag, reviewFact,
  type DbTx, type RecordParseInput,
} from "../services/policyDocStore";
import type { ParseOutcome } from "../../../shared/policyDocTypes";

const here = path.dirname(fileURLToPath(import.meta.url));
const sql = (f: string) => fs.readFileSync(path.join(here, "../../../migrations", f), "utf8");

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const POLICY_A = "10000000-0000-4000-8000-00000000000a";
const POLICY_B = "10000000-0000-4000-8000-00000000000b";

let pg: PGlite;
let db: DbTx;

function adapter(p: PGlite): DbTx {
  return {
    query: (text, params) => p.query(text, params as any[]) as any,
    transaction: (fn) => p.transaction(async (tx) => fn({ query: (t: string, ps?: unknown[]) => tx.query(t, ps as any[]) as any })),
  };
}

const src = (page: number) => ({ documentSha256: "a".repeat(64), pdfPage: page, printedPage: String(page), clause: "Part D 1. Surrender Value", excerpt: "x", region: null, method: "embedded_text" as const, parser: "p", parserVersion: "1.0.0" });
const outcome = (premium = 20000000, version = "1.0.0"): ParseOutcome => ({
  status: "supported", adapterId: "test-adapter", adapterVersion: version, reasons: [],
  fields: {
    "schedule.annualized_premium": { state: "found", value: { paise: premium }, raw: "₹ x", source: src(1) },
    "surrender.gsv_acquisition_min_premium_years": { state: "found", value: 2, raw: "2 (two)", source: src(4) },
    "benefits.maturity": { state: "not_applicable", raw: "NA", source: src(2) },
  },
  flags: [{ id: "gsv_factor_rounding_not_stated", fieldKeys: [], note: "", choices: ["exact_as_printed", "whole_percent_as_in_illustration"], blocksCalculation: true }],
});
const input = (sha: string, o: ParseOutcome = outcome()): RecordParseInput => ({
  sha256: sha.repeat(64).slice(0, 64), byteSize: 1000, pageCount: 5, storageRef: "policies/x.pdf",
  extractor: { id: "pdfjs-columns", version: "1.0.0" }, pageMethods: [], outcome: o,
});

before(async () => {
  pg = new PGlite();
  await pg.exec(`
    CREATE TABLE agents (id uuid PRIMARY KEY);
    CREATE TABLE clients (id uuid PRIMARY KEY, agent_id uuid NOT NULL REFERENCES agents(id));
    INSERT INTO agents VALUES ('${A}'), ('${B}');
    INSERT INTO clients VALUES ('${POLICY_A}', '${A}'), ('${POLICY_B}', '${B}');
  `);
  await pg.exec(sql("025_policy_document_rules.sql"));
  db = adapter(pg);
});

describe("migration", () => {
  test("creates five tables with RLS on", async () => {
    const r = await pg.query<{ relname: string; relrowsecurity: boolean }>(
      `SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('policy_source_documents','policy_document_parses','policy_rule_facts','product_rule_sets','rule_review_events') ORDER BY relname`
    );
    assert.equal(r.rows.length, 5);
    assert.ok(r.rows.every((x) => x.relrowsecurity));
  });

  test("a browser-side role sees no rows in any of them", async () => {
    await recordParse(db, A, POLICY_A, input("1"));
    await pg.exec(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF; END $$;
      GRANT SELECT, INSERT ON policy_source_documents, policy_document_parses, policy_rule_facts, product_rule_sets, rule_review_events TO authenticated;`);
    await pg.exec("SET ROLE authenticated");
    try {
      for (const t of ["policy_source_documents", "policy_document_parses", "policy_rule_facts", "product_rule_sets", "rule_review_events"]) {
        const r = await pg.query(`SELECT count(*)::int AS n FROM ${t}`);
        assert.equal((r.rows[0] as any).n, 0, t);
      }
      await assert.rejects(pg.query(`INSERT INTO product_rule_sets (insurer, uin, plan_option, benefit_variant, rules, provenance, revision) VALUES ('x','101N186V02','o','b','{}','{}',1)`));
    } finally {
      await pg.exec("RESET ROLE");
    }
  });

  test("the down migration removes exactly what 025 added, and 025 re-applies", async () => {
    const p2 = new PGlite();
    await p2.exec(`CREATE TABLE agents (id uuid PRIMARY KEY); CREATE TABLE clients (id uuid PRIMARY KEY, agent_id uuid NOT NULL);`);
    await p2.exec(sql("025_policy_document_rules.sql"));
    await p2.exec(sql("025_policy_document_rules_down.sql"));
    const left = await p2.query(`SELECT relname FROM pg_class WHERE relname LIKE 'policy_%' OR relname IN ('product_rule_sets','rule_review_events')`);
    assert.equal(left.rows.length, 0);
    const clients = await p2.query(`SELECT 1 FROM pg_class WHERE relname = 'clients'`);
    assert.equal(clients.rows.length, 1);
    await p2.exec(sql("025_policy_document_rules.sql"));
    await p2.close();
  });
});

describe("advisor isolation", () => {
  test("advisor B cannot record, read or review advisor A's policy", async () => {
    await assert.rejects(recordParse(db, B, POLICY_A, input("2")), (e: any) => e.status === 404);
    await assert.rejects(getDocumentRules(db, B, POLICY_A), (e: any) => e.status === 404);
    await assert.rejects(reviewFact(db, B, POLICY_A, { fieldKey: "schedule.annualized_premium", action: "confirm", expectedRevision: 1, idempotencyKey: "b-review-1" }), (e: any) => e.status === 404);
    await assert.rejects(resolveFlag(db, B, POLICY_A, { flagId: "gsv_factor_rounding_not_stated", choice: "exact_as_printed", reason: "insurer said so", idempotencyKey: "b-flag-1" }), (e: any) => e.status === 404);
  });

  test("a parse cannot be attached to another policy's document (composite keys)", async () => {
    const docA = (await pg.query<{ id: string }>(`SELECT id FROM policy_source_documents WHERE client_id = $1 LIMIT 1`, [POLICY_A])).rows[0].id;
    await assert.rejects(pg.query(
      `INSERT INTO policy_document_parses (document_id, client_id, extractor_id, extractor_version, status) VALUES ($1, $2, 'x', 'y', 'supported')`, [docA, POLICY_B]
    ));
  });
});

describe("recording parses", () => {
  test("the same file by the same code is recorded once", async () => {
    const a = await recordParse(db, A, POLICY_A, input("3"));
    const b = await recordParse(db, A, POLICY_A, input("3"));
    assert.equal(a.parseId, b.parseId);
    assert.equal(b.created, false);
  });

  test("every field starts pending review; NA is kept as NA", async () => {
    const r = await getDocumentRules(db, A, POLICY_A);
    for (const f of r.fields) assert.equal(f.state, "document_pending", f.field_key);
    assert.equal(r.fields.find((f: any) => f.field_key === "benefits.maturity").document_field.state, "not_applicable");
    assert.deepEqual(confirmedFactsFrom(r.fields), {});
  });
});

describe("review", () => {
  test("confirming needs the exact revision; a stale tab is refused", async () => {
    const before = await getDocumentRules(db, A, POLICY_A);
    const rev = before.fields.find((f: any) => f.field_key === "schedule.annualized_premium").revision;
    const ok = await reviewFact(db, A, POLICY_A, { fieldKey: "schedule.annualized_premium", action: "confirm", expectedRevision: rev, idempotencyKey: "a-confirm-1" });
    assert.equal(ok.revision, rev + 1);
    await assert.rejects(
      reviewFact(db, A, POLICY_A, { fieldKey: "schedule.annualized_premium", action: "confirm", expectedRevision: rev, idempotencyKey: "a-confirm-2" }),
      (e: any) => e.status === 409
    );
  });

  test("a retried request with the same key changes nothing", async () => {
    const again = await reviewFact(db, A, POLICY_A, { fieldKey: "schedule.annualized_premium", action: "confirm", expectedRevision: 1, idempotencyKey: "a-confirm-1" });
    assert.equal(again.repeated, true);
  });

  test("an NA field cannot be 'confirmed' as a value; a correction needs a reason and a valid value", async () => {
    const r = await getDocumentRules(db, A, POLICY_A);
    const na = r.fields.find((f: any) => f.field_key === "benefits.maturity");
    await assert.rejects(reviewFact(db, A, POLICY_A, { fieldKey: "benefits.maturity", action: "confirm", expectedRevision: na.revision, idempotencyKey: "a-na-0001" }), (e: any) => e.code === "nothing_to_confirm");
    const gsv = r.fields.find((f: any) => f.field_key === "surrender.gsv_acquisition_min_premium_years");
    await assert.rejects(reviewFact(db, A, POLICY_A, { fieldKey: "surrender.gsv_acquisition_min_premium_years", action: "correct", expectedRevision: gsv.revision, value: 3, idempotencyKey: "a-corr-0" }), (e: any) => e.code === "reason_required");
    await assert.rejects(reviewFact(db, A, POLICY_A, { fieldKey: "schedule.annualized_premium", action: "correct", expectedRevision: 2, value: "lots", reason: "typo in the schedule", idempotencyKey: "a-corr-x" }), (e: any) => e.code === "bad_value");
    const c = await reviewFact(db, A, POLICY_A, { fieldKey: "surrender.gsv_acquisition_min_premium_years", action: "correct", expectedRevision: gsv.revision, value: 3, reason: "insurer letter says three years", idempotencyKey: "a-corr-1" });
    assert.equal(c.repeated, false);
  });

  test("the original reading is kept beside every correction (history)", async () => {
    const r = await getDocumentRules(db, A, POLICY_A);
    const h = r.history["surrender.gsv_acquisition_min_premium_years"];
    assert.equal(h.length, 2);
    assert.equal(h[1].state, "corrected");
    assert.equal(h[1].corrected_value, 3);
    assert.equal(h[1].document_field.value, 2);
    const confirmed = confirmedFactsFrom(r.fields);
    assert.equal(confirmed["surrender.gsv_acquisition_min_premium_years"]?.value, 3);
    assert.deepEqual(confirmed["schedule.annualized_premium"]?.value, { paise: 20000000 });
  });

  test("history rows cannot be edited", async () => {
    await assert.rejects(pg.query(`UPDATE policy_rule_facts SET state = 'reviewed' WHERE client_id = $1`, [POLICY_A]), /append-only/);
    await assert.rejects(pg.query(`UPDATE rule_review_events SET reason = 'x'`), /append-only/);
  });

  test("a flag decision must be one of the offered choices, with a reason", async () => {
    await assert.rejects(resolveFlag(db, A, POLICY_A, { flagId: "gsv_factor_rounding_not_stated", choice: "round_down", reason: "made it up", idempotencyKey: "a-flag-x" }), (e: any) => e.code === "bad_choice");
    await assert.rejects(resolveFlag(db, A, POLICY_A, { flagId: "gsv_factor_rounding_not_stated", choice: "exact_as_printed", reason: "", idempotencyKey: "a-flag-y" }), (e: any) => e.code === "reason_required");
    await resolveFlag(db, A, POLICY_A, { flagId: "gsv_factor_rounding_not_stated", choice: "exact_as_printed", reason: "insurer email 3 Oct", idempotencyKey: "a-flag-1" });
    const r = await getDocumentRules(db, A, POLICY_A);
    assert.equal(r.flagDecisions.gsv_factor_rounding_not_stated.choice, "exact_as_printed");
  });
});

describe("a new reading never inherits approval", () => {
  test("same value, new parser version: back to pending", async () => {
    await recordParse(db, A, POLICY_A, input("4", outcome(20000000, "1.1.0")));
    const r = await getDocumentRules(db, A, POLICY_A);
    assert.equal(r.fields.find((f: any) => f.field_key === "schedule.annualized_premium").state, "document_pending");
    // Flag decisions belong to the parse they were made on.
    assert.equal(r.flagDecisions.gsv_factor_rounding_not_stated, undefined);
  });

  test("a new document disagreeing with an advisor correction is marked conflicting, both kept", async () => {
    const o = outcome(20000000, "1.1.0");
    (o.fields as any)["surrender.gsv_acquisition_min_premium_years"] = { state: "found", value: 4, raw: "4 (four)", source: src(4) };
    await recordParse(db, A, POLICY_A, input("5", o));
    const r = await getDocumentRules(db, A, POLICY_A);
    const f = r.fields.find((x: any) => x.field_key === "surrender.gsv_acquisition_min_premium_years");
    assert.equal(f.state, "conflicting");
    assert.equal(f.corrected_value, 3);
    assert.equal(f.document_field.value, 4);
    assert.equal(confirmedFactsFrom(r.fields)["surrender.gsv_acquisition_min_premium_years"], undefined);
  });
});

describe("product rule candidates", () => {
  test("carry contract rules and clause names only: no customer values, hash, excerpt or page region", () => {
    const facts: any = {
      "identity.insurer": { value: "HDFC Life", revision: 2, state: "reviewed" },
      "identity.uin": { value: "101N186V02", revision: 2, state: "reviewed" },
      "identity.option": { value: "Dream Achiever", revision: 2, state: "reviewed" },
      "identity.benefit_choice": { value: "Early Income", revision: 2, state: "reviewed" },
      "schedule.annualized_premium": { value: { paise: 20000000 }, revision: 2, state: "reviewed" },
      "benefits.survival_recurring": { value: { amount: { paise: 338000 } }, revision: 2, state: "reviewed" },
      "loan.cap_pct_of_surrender_value": { value: { bps: 8000 }, revision: 2, state: "reviewed" },
    };
    const c = buildProductRuleCandidate(facts, { "loan.cap_pct_of_surrender_value": { clause: "Part D 8. Loans" } });
    const s = JSON.stringify(c);
    assert.equal(c.review_status, "draft");
    assert.ok(!s.includes("annualized_premium") && !s.includes("survival_recurring") && !s.includes("20000000") && !s.includes("338000"));
    assert.ok(!/sha256|excerpt|region|pdfPage/.test(s));
    assert.deepEqual(c.rules, { "loan.cap_pct_of_surrender_value": { bps: 8000 } });
  });
});

describe("confirm many", () => {
  const POLICY_C = "10000000-0000-4000-8000-00000000000c";
  const ocrOutcome = (): ParseOutcome => {
    const o = outcome();
    o.fields["surrender.gsv_acquisition_min_premium_years"] = { state: "found", value: 2, raw: "2", source: { ...src(4), method: "ocr" } } as any;
    return o;
  };
  const revs = async () => Object.fromEntries((await getDocumentRules(db, B, POLICY_C)).fields.map((f: any) => [f.field_key, f]));

  before(async () => {
    await pg.exec(`INSERT INTO clients VALUES ('${POLICY_C}', '${B}')`);
    await recordParse(db, B, POLICY_C, input("c", ocrOutcome()));
  });

  test("another advisor cannot confirm", async () => {
    await assert.rejects(confirmMany(db, A, POLICY_C, { items: [{ fieldKey: "schedule.annualized_premium", expectedRevision: 1 }], idempotencyKey: "a-many-0001" }), (e: any) => e.status === 404);
  });

  test("a value read by OCR is refused and nothing in the batch is saved", async () => {
    const r = await revs();
    await assert.rejects(confirmMany(db, B, POLICY_C, {
      items: [
        { fieldKey: "schedule.annualized_premium", expectedRevision: r["schedule.annualized_premium"].revision },
        { fieldKey: "surrender.gsv_acquisition_min_premium_years", expectedRevision: r["surrender.gsv_acquisition_min_premium_years"].revision },
      ], idempotencyKey: "b-many-0001",
    }), (e: any) => e.code === "ocr_one_by_one");
    assert.equal((await revs())["schedule.annualized_premium"].state, "document_pending");
  });

  test("a stale or NA field rolls the whole batch back", async () => {
    const r = await revs();
    await assert.rejects(confirmMany(db, B, POLICY_C, {
      items: [
        { fieldKey: "schedule.annualized_premium", expectedRevision: r["schedule.annualized_premium"].revision },
        { fieldKey: "benefits.maturity", expectedRevision: r["benefits.maturity"].revision },
      ], idempotencyKey: "b-many-0002",
    }), (e: any) => e.code === "nothing_to_confirm");
    await assert.rejects(confirmMany(db, B, POLICY_C, {
      items: [{ fieldKey: "schedule.annualized_premium", expectedRevision: 99 }], idempotencyKey: "b-many-0003",
    }), (e: any) => e.status === 409);
    assert.equal((await revs())["schedule.annualized_premium"].state, "document_pending");
  });

  test("confirms each field with its own revision and review event; a retry changes nothing", async () => {
    const r = await revs();
    const items = [{ fieldKey: "schedule.annualized_premium", expectedRevision: r["schedule.annualized_premium"].revision }];
    const ok = await confirmMany(db, B, POLICY_C, { items, idempotencyKey: "b-many-0004" });
    assert.deepEqual(ok, { confirmed: 1, repeated: false });
    const after = await revs();
    assert.equal(after["schedule.annualized_premium"].state, "reviewed");
    assert.equal(after["schedule.annualized_premium"].revision, r["schedule.annualized_premium"].revision + 1);
    const ev = await pg.query(`SELECT count(*)::int n FROM rule_review_events WHERE client_id = $1 AND action = 'confirm'`, [POLICY_C]);
    assert.equal((ev.rows[0] as any).n, 1);
    assert.equal((await confirmMany(db, B, POLICY_C, { items, idempotencyKey: "b-many-0004" })).repeated, true);
  });
});
