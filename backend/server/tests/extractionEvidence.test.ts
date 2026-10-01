/**
 * Extraction for life and term: no computed due dates, strict values, and
 * source excerpts checked against the document text.
 *
 * NO NETWORK, NO DB, NO MODEL CALL. The "document" is a synthetic string.
 *
 * Run:  npx tsx --test backend/server/tests/extractionEvidence.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { buildExtractionPrompt, EXTRACTION_FIELDS } from "../services/extractionFields";
import { checkFieldSources, coerceLegacy, coerceStrict, fillNextPremiumDate } from "../services/extractionEvidence";
import { SHAREABLE_FIELDS, pickShareableFields } from "../../../shared/dataEntryShare";
import { EXTRACTION_FIELDS as FRONT_FIELDS } from "../../../frontend/client/src/lib/insuranceTypes";

describe("the prompt", () => {
  test("no longer asks the reader to work out a future due date", () => {
    for (const type of ["life", "term"] as const) {
      const p = buildExtractionPrompt(type);
      assert.doesNotMatch(p, /strictly AFTER today/i);
      assert.doesNotMatch(p, /next future occurrence/i);
      assert.match(p, /Do NOT calculate one from a recurring schedule/);
      assert.match(p, /"field_sources"/);
    }
  });

  test("motor's prompt is unchanged in this respect", () => {
    assert.doesNotMatch(buildExtractionPrompt("motor"), /field_sources/);
  });

  test("the portal's field list matches the backend's for life and term", () => {
    for (const type of ["life", "term"] as const) {
      assert.deepEqual(
        (FRONT_FIELDS as any)[type].map((f: any) => [f.key, f.type]),
        EXTRACTION_FIELDS[type].map((f) => [f.key, f.type]),
      );
    }
  });
});

describe("strict values", () => {
  test("rupee strings are read by the grammar, never stripped", () => {
    assert.deepEqual(coerceStrict("Rs. 50,000", "number"), { value: 50000, unparsed: null });
    assert.deepEqual(coerceStrict("1.5 lakh", "number"), { value: 150000, unparsed: null });
    assert.deepEqual(coerceStrict("approx 50k", "number"), { value: null, unparsed: "approx 50k" });
    assert.deepEqual(coerceStrict("03/04/2018", "date"), { value: null, unparsed: "03/04/2018" });
  });

  test("other lines keep the old reading", () => {
    assert.equal(coerceLegacy("20%", "number").value, 20);
  });
});

describe("source excerpts", () => {
  const doc = "POLICY SCHEDULE\nAnnual Premium (excluding GST): Rs. 50,000\nSum Assured on Death: Rs. 12,50,000\nDate of Commencement: 15 March 2018";
  const known = new Set(EXTRACTION_FIELDS.life.map((f) => f.key));

  test("an excerpt that is in the text and holds the value is marked so", () => {
    const out = checkFieldSources({
      premium: 50000,
      field_sources: { premium: { excerpt: "Annual Premium (excluding GST): Rs. 50,000", page: 1 } },
    }, doc, known);
    assert.deepEqual(out.premium, { excerpt: "Annual Premium (excluding GST): Rs. 50,000", pageClaimed: 1, inText: true, valueInExcerpt: true });
  });

  test("an invented excerpt, or one without the value, is marked as not supported", () => {
    const out = checkFieldSources({
      premium: 55000, sum_assured: 1250000,
      field_sources: {
        premium: { excerpt: "Annual Premium (excluding GST): Rs. 50,000" },
        sum_assured: { excerpt: "Sum Assured: Rs. 12,50,000 guaranteed" },
      },
    }, doc, known);
    assert.equal(out.premium.valueInExcerpt, false);
    assert.equal(out.sum_assured.inText, false);
  });

  test("a date is matched in the document's own wording", () => {
    const out = checkFieldSources({
      start_date: "2018-03-15", field_sources: { start_date: { excerpt: "Date of Commencement: 15 March 2018" } },
    }, doc, known);
    assert.equal(out.start_date.valueInExcerpt, true);
    assert.equal(out.start_date.inText, true);
  });

  test("unknown keys are dropped", () => {
    const out = checkFieldSources({ field_sources: { not_a_field: { excerpt: "Sum Assured on Death" } } }, doc, known);
    assert.deepEqual(out, {});
  });
});

describe("the next premium date", () => {
  test("a stated date is kept and labelled stated", () => {
    const d: Record<string, unknown> = { next_premium_date: "2027-03-15" };
    fillNextPremiumDate(d, "2026-10-01");
    assert.equal(d.next_premium_date_basis, "stated");
  });

  test("otherwise it is the next scheduled date, labelled schedule (a reminder, not a payment)", () => {
    const d: Record<string, unknown> = { next_premium_date: null, start_date: "2018-03-15", premium_frequency: "Yearly", premium_paying_term_years: 20 };
    fillNextPremiumDate(d, "2026-10-01");
    assert.equal(d.next_premium_date, "2027-03-15");
    assert.equal(d.next_premium_date_basis, "schedule");
  });

  test("a finished premium term or a single premium gives no date", () => {
    const d: Record<string, unknown> = { next_premium_date: null, start_date: "2018-03-15", premium_frequency: "Yearly", premium_paying_term_years: 5 };
    fillNextPremiumDate(d, "2026-10-01");
    assert.equal(d.next_premium_date, null);
    const s: Record<string, unknown> = { next_premium_date: null, start_date: "2018-03-15", premium_frequency: "Single" };
    fillNextPremiumDate(s, "2026-10-01");
    assert.equal(s.next_premium_date, null);
  });
});

describe("the share page", () => {
  test("never publishes evidence, sources, loans or internal keys", () => {
    const shareable = new Set([...SHAREABLE_FIELDS.life, ...SHAREABLE_FIELDS.term].map((f) => f.key));
    for (const k of ["value_evidence", "field_sources", "_rev", "_unparsed", "loan_outstanding", "loan_interest_accrued", "uin", "policy_status_stated"]) {
      assert.equal(shareable.has(k), false, k);
    }
  });

  test("publishes a fund value only with its date", () => {
    assert.equal("fund_value" in pickShareableFields("life", { fund_value: 493900 }), false);
    assert.equal("fund_value" in pickShareableFields("life", { fund_value: 493900, fund_value_as_on: "2026-06-30" }), true);
  });
});
