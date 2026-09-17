/**
 * Sach AI retrieval tests.
 *
 * NO NETWORK, NO DB, NO AI. JSON in, rendered answer out.
 *
 * Every fixture below is the SHAPE of a real row, copied from the live
 * analysis_jobs.result and policy_catalog.profile on 2026-09-15 and scrubbed of
 * personal data. The shapes are the point: the feature this replaces was broken
 * precisely because it read paths that do not exist in these objects.
 *
 * Run:
 *   npx tsx --test backend/server/tests/sachRetrieval.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  CLAUSE_MAP,
  parseIntent,
  resolveFromAudit,
  resolveFromCatalogProfile,
  renderClauseAnswer,
  answerFromData,
  type ClauseKey,
} from "../services/sachRetrieval";

/* ─── fixtures ──────────────────────────────────────────────────────────────── */

/** Shape of a real stored analysis. Only the sections under test are filled. */
const OWN_ANALYSIS = {
  identity: { insurer_name: "Star Health And Allied Insurance Company Limited", confidence: "high" },
  coverage_structure: {
    base_sum_insured: 500000,
    no_claim_bonus: {
      exists: true, clarity: "clear", current_bonus: 750000,
      remarks: "Accrued bonus of ₹7,50,000 is explicitly listed on the schedule.",
      portability: "unclear", rate_per_year: null, cap_percentage: null,
    },
    restoration: {
      type: null, exists: false, unlimited: null, restore_amount: null,
      remarks: "Restoration benefits are not detailed in the provided policy schedule.",
      actually_useful: null, trigger_conditions: null, same_illness_covered: null,
      triggers_on_first_claim: null,
    },
  },
  supplementary_coverage: {
    modern_treatments: {
      covered: true,
      examples: ["Robotic surgery", "Stem cell therapy", "Oral chemotherapy"],
      conditions: "Capped at 25% of the Sum Insured.",
      remarks: "Modern treatments are severely restricted to Rs. 1,25,000 (25% of the Rs. 5 Lakhs SI).",
    },
    consumables: { limit: null, covered: false, coverage_type: "none", remarks: "Consumables are excluded by default under standard terms." },
    opd: { covered: false, utility: "none", conditions: null, limit_per_year: null, remarks: "OPD benefits are not mentioned in the schedule." },
  },
  claim_risk_analysis: {
    room_rent: {
      limit_type: "category", risk_level: "low", limit_value: "Single Private A/C Room",
      penalty_type: "none", zone_adequacy: "adequate", penalty_calculation: null,
      limit_amount_per_day: 3000,
      explanation: "Star Comprehensive covers a Single Private A/C room, which is adequate for Zone C reference rates.",
    },
    co_payment: { exists: false, applies_to: null, conditions: null, percentage: null, risk_level: "low", oop_on_5L_claim: 0, waiver_conditions: null },
    sub_limits: { exists: false, categories: [], risk_level: "low", remarks: "No sub-limits are explicitly stated in the policy schedule." },
  },
  waiting_period_analysis: {
    pre_existing_disease: {
      stated: false, end_date: null, start_date: null, duration_months: null,
      is_active_today: null, months_remaining: null,
      risk_commentary: "PED waiting period duration is not explicitly stated in the schedule.",
    },
    specific_diseases: {
      end_date: "2017-10-12", duration_months: 24, is_active_today: false,
      diseases_covered: ["Specific illnesses listed in policy terms"],
      risk_commentary: "24-month specific disease waiting period is fully served.",
    },
  },
};

/** Shape of a real policy_catalog row. */
const CARE_SUPREME_ROW = {
  insurer: "Care Health Insurance",
  plan_name: "Care Supreme",
  status: "unverified",
  confidence: "high",
  profile: {
    insurer: "Care Health Insurance",
    plan_name: "Care Supreme",
    modern_treatments: { exists: true, display: "Covered (up to SI)", optional: false },
    ped_waiting: { display: "36 months", number: 36, optional: false, note: "Reducible to 24 months via Optional Cover 12 (PED reduction)" },
    sub_limits: { display: "Few/minor sub-limits", ordinal: 3, optional: false, note: "VERIFY per variant; some plan variants apply disease/room sub-limits per schedule" },
    global_cover: { exists: false, display: "Not covered", optional: false },
  },
};

/* ─── the question the product advertises and could not answer ──────────────── */

describe("the robotic surgery question", () => {
  test("'Am I covered for Robotic in my Care Health policy' resolves to modern_treatments", () => {
    const intent = parseIntent("Am I covered for Robotic in my Care Health policy");
    assert.equal(intent.kind, "clause");
    assert.equal(intent.clauseKey, "modern_treatments");
    assert.equal(intent.aboutOwnPolicy, true);
    assert.equal(intent.namedPlanText, "care health");
  });

  test("answers from the reader's own policy with the cap, at zero tokens", () => {
    const { fact, text } = answerFromData("Am I covered for Robotic in my Care Health policy", {
      ownAnalysis: OWN_ANALYSIS,
      catalogRow: CARE_SUPREME_ROW,
    });

    assert.ok(fact, "a fact must be retrieved, not escalated to a model");
    // Covered, but capped, so the verdict must not read as a clean yes.
    assert.equal(fact!.verdict, "conditional");
    assert.match(text!, /Includes: Robotic surgery/);
    assert.match(text!, /25% of the Sum Insured/);
    assert.match(text!, /Source: your uploaded policy analysis\./);
    // The reader's own schedule outranks the published catalog wording, which
    // would have said the softer "Covered (up to SI)".
    assert.doesNotMatch(text!, /policy catalog/);
  });

  test("the old broken paths are genuinely absent, so this test would have caught the bug", () => {
    assert.equal((OWN_ANALYSIS as any).cost_structure, undefined);
    assert.equal((OWN_ANALYSIS as any).coverage_structure.exclusions, undefined);
    assert.equal((OWN_ANALYSIS as any).coverage_structure.policy_name, undefined);
    assert.equal((OWN_ANALYSIS as any).policy_timeline, undefined);
  });

  test("with no uploaded policy it falls back to the catalog and says so", () => {
    const { fact, text } = answerFromData("Does Care Supreme cover robotic surgery", {
      ownAnalysis: null,
      catalogRow: CARE_SUPREME_ROW,
    });
    assert.ok(fact);
    assert.equal(fact!.verdict, "yes");
    assert.match(text!, /Covered \(up to SI\)/);
    assert.match(text!, /not your own policy schedule/);
    assert.match(text!, /status: unverified/);
  });
});

/* ─── intent parsing ────────────────────────────────────────────────────────── */

describe("parseIntent", () => {
  test("every clause in the map is reachable by at least one of its own synonyms", () => {
    for (const [key, def] of Object.entries(CLAUSE_MAP)) {
      const hits = def.synonyms
        .map((s) => parseIntent(`tell me about ${s}`).clauseKey)
        .filter((k) => k === key);
      assert.ok(hits.length > 0, `${key} is unreachable: no synonym resolves back to it`);
    }
  });

  test("longest synonym wins, so a specific phrase is not swallowed by a general one", () => {
    assert.equal(parseIntent("what is my pre existing disease waiting").clauseKey, "ped_waiting");
    assert.equal(parseIntent("does it pay pre hospitalisation costs").clauseKey, "pre_hosp");
  });

  test("a compare question outranks a clause hit", () => {
    const i = parseIntent("compare room rent on Care Supreme vs Star Comprehensive");
    assert.equal(i.kind, "compare");
    assert.equal(i.clauseKey, "room_rent");
  });

  test("cover-need questions route to the calculator, not to a clause", () => {
    assert.equal(parseIntent("how much cover do I need for a family of four").kind, "cover_need");
    assert.equal(parseIntent("kitna cover lena chahiye").kind, "cover_need");
  });

  test("a genuine education question stays general and is the only thing a model sees", () => {
    const i = parseIntent("what does IRDAI actually do");
    assert.equal(i.kind, "general");
    assert.equal(i.clauseKey, null);
    assert.equal(answerFromData("what does IRDAI actually do", { ownAnalysis: OWN_ANALYSIS }).text, null);
  });

  test("word boundaries hold, so a substring does not fire a clause", () => {
    // "si" is a sum_insured synonym; it must not fire inside another word.
    assert.notEqual(parseIntent("please consider my situation").clauseKey, "sum_insured");
    // "ped" must not fire inside "expedite".
    assert.notEqual(parseIntent("can you expedite this").clauseKey, "ped_waiting");
  });
});

/* ─── the audit renderer ────────────────────────────────────────────────────── */

describe("resolveFromAudit", () => {
  test("a plain not-covered benefit reads as a clean no", () => {
    const f = resolveFromAudit(OWN_ANALYSIS, "consumables")!;
    assert.equal(f.verdict, "no");
    assert.match(renderClauseAnswer(f), /not covered/i);
  });

  test("a covered-with-no-cap benefit is not downgraded to conditional", () => {
    const f = resolveFromAudit(OWN_ANALYSIS, "cumulative_bonus")!;
    assert.equal(f.verdict, "yes");
    assert.match(renderClauseAnswer(f), /₹7\.5L/); // current_bonus 750000 via formatINR
  });

  test("'stated: false' reads as 'the document does not say', never as 'no'", () => {
    const f = resolveFromAudit(OWN_ANALYSIS, "ped_waiting")!;
    assert.equal(f.verdict, "unknown");
    const text = renderClauseAnswer(f);
    assert.match(text, /does not say/i);
    assert.doesNotMatch(text, /is not covered/i);
  });

  test("a served waiting period says so, with its duration", () => {
    const text = renderClauseAnswer(resolveFromAudit(OWN_ANALYSIS, "specific_disease_waiting")!);
    assert.match(text, /24 months/);
    assert.match(text, /already served/i);
  });

  test("a room-rent category limit carries its rupee equivalent", () => {
    const text = renderClauseAnswer(resolveFromAudit(OWN_ANALYSIS, "room_rent")!);
    assert.match(text, /Single Private A\/C Room/);
    assert.match(text, /₹3K per day/);
  });

  test("a clause the audit schema has no field for returns null rather than guessing", () => {
    assert.equal(CLAUSE_MAP.ayush.auditPath, null);
    assert.equal(resolveFromAudit(OWN_ANALYSIS, "ayush"), null);
  });

  test("a missing section returns null instead of throwing", () => {
    assert.equal(resolveFromAudit({}, "modern_treatments"), null);
    assert.equal(resolveFromAudit(null, "modern_treatments"), null);
  });
});

/* ─── the catalog renderer and its caveats ──────────────────────────────────── */

describe("resolveFromCatalogProfile", () => {
  test("an optional-only benefit is never presented as built in", () => {
    const row = {
      ...CARE_SUPREME_ROW,
      profile: { ...CARE_SUPREME_ROW.profile, global_cover: { exists: true, display: "Covered", optional: true } },
    };
    const text = renderClauseAnswer(resolveFromCatalogProfile(row, "global_cover")!);
    assert.match(text, /optional cover or rider/i);
  });

  test("a 'VERIFY per variant' note survives to the screen", () => {
    const text = renderClauseAnswer(resolveFromCatalogProfile(CARE_SUPREME_ROW, "sub_limits")!);
    assert.match(text, /varies by variant/i);
  });

  test("every catalog answer carries the not-your-schedule caveat", () => {
    for (const key of ["modern_treatments", "ped_waiting", "sub_limits", "global_cover"] as ClauseKey[]) {
      const fact = resolveFromCatalogProfile(CARE_SUPREME_ROW, key);
      assert.ok(fact, `${key} should resolve from the catalog`);
      assert.ok(
        fact!.caveats.some((c) => /not your own policy schedule/.test(c)),
        `${key} lost its provenance caveat`
      );
    }
  });

  test("an axis the catalog does not carry returns null", () => {
    assert.equal(CLAUSE_MAP.opd.catalogAxis, null);
    assert.equal(resolveFromCatalogProfile(CARE_SUPREME_ROW, "opd"), null);
  });
});

/* ─── provenance is structural, not decorative ──────────────────────────────── */

describe("Claims Ledger", () => {
  test("no rendered answer can ship without a source line", () => {
    const facts = [
      resolveFromAudit(OWN_ANALYSIS, "modern_treatments")!,
      resolveFromAudit(OWN_ANALYSIS, "room_rent")!,
      resolveFromCatalogProfile(CARE_SUPREME_ROW, "modern_treatments")!,
      resolveFromCatalogProfile(CARE_SUPREME_ROW, "ped_waiting")!,
    ];
    for (const f of facts) {
      assert.match(renderClauseAnswer(f), /^Source: /m, `${f.clauseKey} rendered without a source`);
    }
  });
});

/* --- polarity and cap detection: both caught on real production rows --- */

describe("polarity", () => {
  test("no co-payment is good news, not 'not covered'", () => {
    // The first version of the renderer shared one set of words across benefits
    // and burdens, so a policy with no co-pay was told "No, not covered", which
    // reads as having no cover at all.
    const f = resolveFromAudit(OWN_ANALYSIS, "copayment")!;
    assert.equal(CLAUSE_MAP.copayment.polarity, "burden");
    assert.equal(f.verdict, "no");
    const text = renderClauseAnswer(f);
    assert.match(text, /does not apply to you/i);
    assert.doesNotMatch(text, /not covered/i);
  });

  test("a room-rent category is an answer, not a shrug", () => {
    // claim_risk_analysis.room_rent carries no covered/exists/stated flag at all,
    // only a category and a per-day figure, so a flag-only reader called it
    // "your document does not say" while printing the limit underneath.
    const f = resolveFromAudit(OWN_ANALYSIS, "room_rent")!;
    assert.equal(CLAUSE_MAP.room_rent.polarity, "info");
    assert.notEqual(f.verdict, "unknown");
    assert.match(renderClauseAnswer(f), /Here is what your policy says/);
  });

  test("a benefit that is absent still reads as not covered", () => {
    const f = resolveFromAudit(OWN_ANALYSIS, "consumables")!;
    assert.equal(CLAUSE_MAP.consumables.polarity, "benefit");
    assert.match(renderClauseAnswer(f), /No, not covered/);
  });

  test("every clause carries a polarity", () => {
    for (const [key, def] of Object.entries(CLAUSE_MAP)) {
      assert.ok(
        ["benefit", "burden", "info"].includes(def.polarity),
        `${key} has no valid polarity`
      );
    }
  });
});

describe("cap detection", () => {
  const mt = (conditions: string) => ({
    supplementary_coverage: { modern_treatments: { covered: true, examples: ["Robotic surgery"], conditions, remarks: "" } },
  });

  test("a real cap is reported as a limit", () => {
    for (const c of ["Capped at 25% of SI", "Subject to sub-limits under standard terms", "Limited to Rs. 1,25,000"]) {
      assert.equal(resolveFromAudit(mt(c), "modern_treatments")!.verdict, "conditional", c);
    }
  });

  test("'up to the full sum insured' is NOT a cap", () => {
    // Analyses put full-cover phrasing in the same `conditions` field as a real
    // cap. Reading those as a limit tells someone their robotic surgery is
    // restricted when it is not, which pushes them to buy cover they already have.
    for (const c of [
      "Covered up to the full Sum Insured.",
      "Covered up to Sum Insured",
      "No sub-limits on modern treatments",
      "Covered up to SI",
    ]) {
      const f = resolveFromAudit(mt(c), "modern_treatments")!;
      assert.equal(f.verdict, "yes", c);
      assert.match(renderClauseAnswer(f), /Yes, covered\./);
    }
  });
});

describe("hyphens", () => {
  test("the hyphenated spelling of a clause resolves, not falls through to general", () => {
    // People write "co-pay", "sub-limit", "pre-existing", "day-care". Keeping the
    // hyphen made every one of those miss its synonym and land on the general
    // path, which is the worst answer for a question that named a clause exactly.
    const cases: Array<[string, string]> = [
      ["Is there a co-pay on my policy?", "copayment"],
      ["What are the sub-limits?", "sub_limits"],
      ["How long is the pre-existing disease waiting?", "ped_waiting"],
      ["Are day-care procedures covered?", "day_care"],
      ["Is pre-hospitalisation paid?", "pre_hosp"],
    ];
    for (const [q, key] of cases) {
      const i = parseIntent(q);
      assert.equal(i.kind, "clause", q);
      assert.equal(i.clauseKey, key, q);
    }
  });

  test("the unhyphenated spelling still resolves to the same clause", () => {
    assert.equal(parseIntent("is there a copay").clauseKey, "copayment");
    assert.equal(parseIntent("is there a co pay").clauseKey, "copayment");
  });
});
