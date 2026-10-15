/**
 * Clause source quote and premium tests.
 *
 * NO NETWORK, NO DB, NO GEMINI. Pure string work over report objects.
 *
 * Founder rule, 2026-10-15: "if we dont find, how are we quoting it? we have to
 * be sure about it." A quote is shown only when the server found it in the
 * document the model was sent and it carries nothing personal. Everything else
 * is dropped without a trace, so these tests are mostly about what must FAIL.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  verifyQuote,
  attachClauseSources,
  mentionsInsuredName,
  normalizePremium,
} from "../services/clauseSources";

const UPLOADED = `SCHEDULE OF BENEFITS
Insured: Ramesh Kumar Sharma   Mobile 9876543210
Section 4.1 Room Rent: Room rent is payable up to 1% of the Sum Insured per day,
subject to a maximum of Rs. 5,000 per day.
A co-payment of 20% shall apply on every admissible claim
where the Insured Person is aged 61 years or above.
Ramesh Kumar Sharma has declared hypertension at proposal stage.`;

const WORDING = `Policy Wordings
Pre-existing Diseases are covered after 36 months of continuous coverage since inception of the first policy with us.
The Sum Insured will be restored once in a policy year.`;

const docs = { evidence: UPLOADED, wordings: WORDING, insuredNames: ["Ramesh Kumar Sharma"] };

describe("verifyQuote: gate 1, is it in the document", () => {
  test("a verbatim sentence from the uploaded policy passes and is labelled uploaded", () => {
    const q = "A co-payment of 20% shall apply on every admissible claim where the Insured Person is aged 61 years or above.";
    assert.deepEqual(verifyQuote(q, docs), { quote: q, origin: "uploaded", verified: true });
  });

  test("a sentence the PDF broke across lines still passes", () => {
    const q = "Room rent is payable up to 1% of the Sum Insured per day, subject to a maximum of Rs. 5,000 per day.";
    const r = verifyQuote(q, docs);
    assert.ok(r);
    assert.equal(r.origin, "uploaded");
  });

  test("extra spaces and line breaks in the model's copy are collapsed and still pass", () => {
    const r = verifyQuote("Room rent is payable\n  up to 1% of the\tSum Insured per day", docs);
    assert.ok(r);
    assert.equal(r.quote, "Room rent is payable up to 1% of the Sum Insured per day");
  });

  test("a sentence found only in the insurer wording is labelled official_wording", () => {
    const r = verifyQuote("The Sum Insured will be restored once in a policy year.", docs);
    assert.ok(r);
    assert.equal(r.origin, "official_wording");
  });

  test("a paraphrase fails", () => {
    assert.equal(verifyQuote("Room rent is capped at one percent of the sum insured each day.", docs), null);
    assert.equal(verifyQuote("A 20% co-payment applies to all claims for insured persons over 60.", docs), null);
  });

  test("a gap marked with an ellipsis fails even when both halves are real", () => {
    assert.equal(verifyQuote("Room rent is payable up to 1% ... per day.", docs), null);
    assert.equal(verifyQuote("Room rent is payable up to 1% … per day.", docs), null);
  });

  test("a fragment too short to prove anything fails", () => {
    assert.equal(verifyQuote("per day", docs), null);
    assert.equal(verifyQuote("Room rent", docs), null);
  });

  test("a sentence from the wording is rejected when no wording was matched", () => {
    assert.equal(
      verifyQuote("The Sum Insured will be restored once in a policy year.", { ...docs, wordings: null }),
      null,
    );
  });

  test("non-strings and empty strings fail", () => {
    assert.equal(verifyQuote(null, docs), null);
    assert.equal(verifyQuote(42, docs), null);
    assert.equal(verifyQuote("   ", docs), null);
  });
});

describe("verifyQuote: gate 2, nothing personal", () => {
  test("a real line from the document with a phone number fails", () => {
    assert.equal(verifyQuote("Insured: Ramesh Kumar Sharma   Mobile 9876543210", docs), null);
    assert.equal(verifyQuote("Mobile 9876543210", docs), null);
  });

  test("a real line naming the insured fails", () => {
    assert.equal(verifyQuote("Ramesh Kumar Sharma has declared hypertension at proposal stage.", docs), null);
  });

  test("one part of the insured's name is enough to fail", () => {
    assert.ok(mentionsInsuredName("Sharma has declared hypertension", ["Ramesh Kumar Sharma"]));
    assert.ok(!mentionsInsuredName("Pharmacy charges are covered", ["Ramesh Kumar Sharma"]));
  });

  test("short name parts are not matched inside ordinary words", () => {
    assert.ok(!mentionsInsuredName("The room rent cap applies", ["Om Rao"]));
    assert.ok(mentionsInsuredName("om rao is insured", ["Om Rao"]));
  });
});

describe("attachClauseSources", () => {
  const report = () => ({
    identity: { insured_names: ["Ramesh Kumar Sharma"] },
    claim_risk_analysis: {
      room_rent: { source_quote: "Room rent is payable up to 1% of the Sum Insured per day" },
      co_payment: { source_quote: "A co-payment of 20% applies to everyone." },
      sub_limits: { source_quote: null, source: { quote: "model wrote this", origin: "uploaded", verified: true } },
      deductibles: {},
    },
    waiting_period_analysis: {
      pre_existing_disease: {
        source_quote: "Pre-existing Diseases are covered after 36 months of continuous coverage since inception of the first policy with us.",
      },
      personal_waiting_periods: [{ condition: "x", source_quote: "Ramesh Kumar Sharma has declared hypertension at proposal stage." }],
    },
    coverage_structure: { restoration: { source_quote: "Insured: Ramesh Kumar Sharma   Mobile 9876543210" } },
  });

  test("keeps verified quotes, drops the rest, and leaves no model-written source behind", () => {
    const r: any = report();
    const counts = attachClauseSources(r, { evidence: UPLOADED, wordings: WORDING, insuredNames: r.identity.insured_names });

    assert.deepEqual(counts, { offered: 4, kept: 2 });
    assert.equal(r.claim_risk_analysis.room_rent.source.origin, "uploaded");
    assert.equal(r.waiting_period_analysis.pre_existing_disease.source.origin, "official_wording");
    // dropped entirely: no quote, no flag, no note
    assert.ok(!("source" in r.claim_risk_analysis.co_payment));
    assert.ok(!("source" in r.coverage_structure.restoration));
    // a `source` the model wrote itself never survives
    assert.ok(!("source" in r.claim_risk_analysis.sub_limits));
    // personal waiting periods never carry a quote
    assert.ok(!("source_quote" in r.waiting_period_analysis.personal_waiting_periods[0]));
    // the raw model field is gone everywhere
    assert.ok(!JSON.stringify(r).includes("source_quote"));
  });

  test("a report with none of the fields is left alone", () => {
    const r: any = { audit_score: { score: 50 } };
    assert.deepEqual(attachClauseSources(r, docs), { offered: 0, kept: 0 });
    assert.deepEqual(r, { audit_score: { score: 50 } });
  });
});

describe("normalizePremium", () => {
  test("keeps a clean premium and parses a rupee string", () => {
    const r: any = { premium: { amount: "23,456", frequency: "annual", gst_included: true, evidence: "Total Premium (incl. GST) 23,456" } };
    normalizePremium(r, []);
    assert.deepEqual(r.premium, { amount: 23456, frequency: "annual", gst_included: true, evidence: "Total Premium (incl. GST) 23,456" });
  });

  test("drops an evidence line with a policy number or the insured's name but keeps the amount", () => {
    const r: any = { premium: { amount: 18000, frequency: "annual", gst_included: null, evidence: "Policy No: 12345/ABC Premium 18,000" } };
    normalizePremium(r, []);
    assert.equal(r.premium.amount, 18000);
    assert.equal(r.premium.evidence, null);

    const n: any = { premium: { amount: 18000, frequency: "annual", gst_included: null, evidence: "Ramesh Kumar Sharma premium 18,000" } };
    normalizePremium(n, ["Ramesh Kumar Sharma"]);
    assert.equal(n.premium.evidence, null);
  });

  test("an unknown frequency becomes null rather than a guess", () => {
    const r: any = { premium: { amount: 5000, frequency: "yearly-ish", gst_included: "yes", evidence: null } };
    normalizePremium(r, []);
    assert.equal(r.premium.frequency, null);
    assert.equal(r.premium.gst_included, null);
  });

  test("a missing, zero or unreadable amount removes the whole block", () => {
    for (const premium of [undefined, null, { amount: null }, { amount: 0 }, { amount: "not stated" }, "23456"]) {
      const r: any = { premium };
      normalizePremium(r, []);
      assert.equal(r.premium, null);
    }
  });
});
