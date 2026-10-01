/**
 * End to end, with every model call blocked:
 * upload PDF -> deterministic read -> stored as pending -> advisor confirms
 * the fields GSV needs and decides the flags -> gated calculation.
 *
 * NO NETWORK (fetch is replaced and throws), NO MODEL (the AI service is
 * replaced and throws), NO SHARED DB (PGlite, in process). Synthetic PDF.
 *
 * Run:  npx tsx --test backend/server/tests/policyDocEndToEnd.test.ts
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

import { AIService } from "../services/aiService";
import { ingestPolicyDocument } from "../services/policyDocs/ingest";
import { confirmedFactsFrom, getDocumentRules, resolveFlag, reviewFact, type DbTx } from "../services/policyDocStore";
import { shutdownOcr } from "../services/policyDocs/ocr";
import { documentValues } from "../../../shared/documentRules";

const here = path.dirname(fileURLToPath(import.meta.url));
const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const P = "10000000-0000-4000-8000-0000000000aa";

let pg: PGlite;
let db: DbTx;
let modelCalls = 0;
const realFetch = globalThis.fetch;

before(async () => {
  (AIService as any).generateContent = async () => { modelCalls++; throw new Error("model blocked in this test"); };
  globalThis.fetch = (async () => { throw new Error("network blocked in this test"); }) as any;
  pg = new PGlite();
  await pg.exec(`CREATE TABLE agents (id uuid PRIMARY KEY); CREATE TABLE clients (id uuid PRIMARY KEY, agent_id uuid NOT NULL REFERENCES agents(id));
    INSERT INTO agents VALUES ('${A}'), ('${B}'); INSERT INTO clients VALUES ('${P}', '${A}');`);
  await pg.exec(fs.readFileSync(path.join(here, "../../../migrations/025_policy_document_rules.sql"), "utf8"));
  db = {
    query: (t, ps) => pg.query(t, ps as any[]) as any,
    transaction: (fn) => pg.transaction(async (tx) => fn({ query: (t: string, ps?: unknown[]) => tx.query(t, ps as any[]) as any })),
  };
});
after(async () => {
  globalThis.fetch = realFetch;
  await shutdownOcr();
});

const GSV_FIELDS = [
  "schedule.policy_term_years", "schedule.premium_paying_term_years", "schedule.frequency", "schedule.risk_commencement_date",
  "schedule.premium_due_day_month", "schedule.final_premium_due_date", "definitions.policy_anniversary_anchor",
  "surrender.gsv_formula", "surrender.gsv_factor_bands", "surrender.gsv_acquisition_min_premium_years",
  "schedule.instalment_premium_first_year", "schedule.instalment_premium_renewal", "schedule.extra_premium",
  "definitions.total_premiums_paid_excludes", "benefits.survival_recurring", "benefits.survival_terminal", "schedule.deferral_selected",
];

test("upload to pending review to confirmed to gated GSV, with no model call", { timeout: 180000 }, async () => {
  const bytes = new Uint8Array(fs.readFileSync(path.join(here, "fixtures/policyDocs/c2a-digital.pdf")));
  const ing = await ingestPolicyDocument(db, A, P, bytes, "policy-pdfs/synthetic.pdf");
  assert.equal(ing.ok, true);
  assert.equal((ing as any).status, "supported");

  // Uploading the same file again changes nothing.
  const again = await ingestPolicyDocument(db, A, P, bytes, "policy-pdfs/synthetic.pdf");
  assert.equal((again as any).created, false);

  let rules = await getDocumentRules(db, A, P);
  assert.ok(rules.fields.length > 40);
  assert.ok(rules.fields.every((f: any) => f.state === "document_pending"));

  const asOf = "2031-06-01";
  const evidence = { schema: 1, quotes: [{ id: "pt-0001", enteredOn: "2030-03-10", origin: "agent_entered", confirmation: "insurer_document", reference: null, note: null, supersedes: null, voided: false, kind: "quote", quoteType: "premiums_paid_to", amount: null, status: null, paidTo: "2030-03-04", quoteDate: "2030-03-10" }] };
  const calc = () => documentValues({ facts: confirmedFactsFrom(rules.fields), flags: rules.parse.flags, flagDecisions: Object.fromEntries(Object.entries(rules.flagDecisions).map(([k, x]: any) => [k, x.choice])) as any, evidence, asOf });

  // Nothing reviewed yet: no figure.
  assert.equal(calc().gsv.amount, null);

  // Confirm all but one dependency: still no figure.
  for (const key of GSV_FIELDS.slice(0, -1)) {
    const f = rules.fields.find((x: any) => x.field_key === key);
    await reviewFact(db, A, P, { fieldKey: key, action: "confirm", expectedRevision: f.revision, idempotencyKey: `confirm-${key}` });
  }
  rules = await getDocumentRules(db, A, P);
  assert.equal(calc().gsv.amount, null);

  const last = rules.fields.find((x: any) => x.field_key === GSV_FIELDS[GSV_FIELDS.length - 1]);
  await reviewFact(db, A, P, { fieldKey: last.field_key, action: "confirm", expectedRevision: last.revision, idempotencyKey: "confirm-last-0001" });
  rules = await getDocumentRules(db, A, P);
  // All facts confirmed, flags still open: still no figure.
  assert.equal(calc().gsv.amount, null);
  assert.ok(calc().gsv.missing.includes("flag_unresolved:gsv_factor_rounding_not_stated"));

  await resolveFlag(db, A, P, { flagId: "gsv_factor_rounding_not_stated", choice: "exact_as_printed", reason: "synthetic test decision", idempotencyKey: "flag-round-0001" });
  await resolveFlag(db, A, P, { flagId: "survival_benefit_deduction_timing", choice: "payouts_for_completed_policy_years", reason: "synthetic test decision", idempotencyKey: "flag-timing-0001" });
  rules = await getDocumentRules(db, A, P);

  // Year 8: 39/70 x 14,00,000 - 84 x 3,380 = 7,80,000 - 2,83,920 = 4,96,080.
  const r = calc();
  assert.equal(r.gsv.amount?.paise, 49608000);
  assert.equal(r.gsv.scope, "gsv_only_not_surrender_value");
  assert.equal(r.surrender_value.amount, null);

  // Another advisor sees none of it.
  await assert.rejects(getDocumentRules(db, B, P), (e: any) => e.status === 404);

  assert.equal(modelCalls, 0);
});
