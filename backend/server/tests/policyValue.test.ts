/**
 * Factor tables and product rules.
 *
 * NO NETWORK, NO DB, NO MODEL CALL. Synthetic rules only.
 *
 * History, kept so nobody re-adds what was taken out on purpose:
 * - This file used to check the engine against a real customer's benefit
 *   illustration. That document's policy number was written here, in a public
 *   repository; it has been removed from the current file (git history was
 *   not rewritten; that is a separate decision).
 * - The old check only matched the illustration after subtracting a constant
 *   that was fitted to make the rows agree. A constant nobody can explain is
 *   not a test of anything, so that check is gone. No insurer's figures are
 *   reproduced below, and nothing here says what any insurer would pay.
 * - The generic default factor tables and the built-in "year 7 then a ramp"
 *   shape are gone from the engine. A factor now comes only from a rule set,
 *   and steps between bands only when the rule set says so.
 *
 * Run:  npx tsx --test backend/server/tests/policyValue.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  factorForYear, findVerifiedRuleSet, validateRuleSet, VERIFIED_RULE_SETS, type RuleSet,
} from "../../../frontend/client/src/lib/productRules";

const rule = (over: Record<string, any> = {}): any => ({
  schema: 1, id: "syn", insurer: "Example Life", uin: "999N000V01", shape: "endowment",
  surrender: {
    acquiredAfterYears: 2,
    gsv: {
      base: "premiums_paid_excluding_taxes_riders_extras",
      factors: [
        { fromYear: 1, toYear: 1, pct: 0 },
        { fromYear: 2, toYear: 3, pct: 30 },
        { fromYear: 4, toYear: 7, pct: 50 },
        { fromYear: 14, toYear: 99, pct: 90 },
      ],
      interpolation: { fromYear: 7, toYear: "term_minus_1", rounding: "nearest_whole_percent" },
      deductSurvivalBenefitsPaid: false,
    },
    ssv: null,
    selection: "gsv_only",
  },
  loan: null,
  citations: [],
  review: { status: "verified" },
  ...over,
});

describe("the shipped registry", () => {
  test("is empty: no product's factors are assumed", () => {
    assert.equal(VERIFIED_RULE_SETS.length, 0);
  });
});

describe("factorForYear", () => {
  const r = validateRuleSet(rule()).rules!;
  const g = r.surrender!.gsv!;

  test("reads the bands straight", () => {
    assert.equal(factorForYear(g.factors, g.interpolation, 1, 15), 0);
    assert.equal(factorForYear(g.factors, g.interpolation, 3, 15), 0.3);
    assert.equal(factorForYear(g.factors, g.interpolation, 7, 15), 0.5);
  });

  test("steps linearly only where the rule says so, rounded as the rule says", () => {
    // Formula stated by the synthetic rule: 50% + 40% x (year - 7) / ((term - 1) - 7), whole percent.
    // term 15: year 9  -> 50 + 40 x 2/7 = 61.43 -> 61%
    //          year 13 -> 50 + 40 x 6/7 = 84.29 -> 84%
    //          year 14 -> the band itself, 90%
    assert.equal(factorForYear(g.factors, g.interpolation, 9, 15), 0.61);
    assert.equal(factorForYear(g.factors, g.interpolation, 13, 15), 0.84);
    assert.equal(factorForYear(g.factors, g.interpolation, 14, 15), 0.9);
  });

  test("without an interpolation rule, a year between bands has no factor", () => {
    assert.equal(factorForYear(g.factors, null, 9, 15), null);
  });
});

describe("validateRuleSet refuses what it cannot trust", () => {
  const issues = (over: Record<string, any>) => validateRuleSet(rule(over)).issues;

  test("overlapping, unsorted or out-of-range bands", () => {
    const withBands = (factors: any) => ({ surrender: { ...rule().surrender, gsv: { ...rule().surrender.gsv, factors, interpolation: null } } });
    assert.ok(issues(withBands([{ fromYear: 1, toYear: 5, pct: 10 }, { fromYear: 5, toYear: 9, pct: 20 }])).includes("rules_factor_bands_overlap"));
    assert.ok(issues(withBands([{ fromYear: 5, toYear: 9, pct: 20 }, { fromYear: 1, toYear: 4, pct: 10 }])).includes("rules_factor_bands_unsorted"));
    assert.ok(issues(withBands([{ fromYear: 1, toYear: 4, pct: 120 }])).includes("rules_factor_band_invalid"));
    assert.ok(issues(withBands(30)).includes("rules_factor_band_invalid"));
  });

  test("an interpolation that does not start on a band", () => {
    const bad = { surrender: { ...rule().surrender, gsv: { ...rule().surrender.gsv, interpolation: { fromYear: 9, toYear: 12, rounding: "none" } } } };
    assert.ok(issues(bad).includes("rules_interpolation_invalid"));
  });

  test("an SSV method other than a factor table", () => {
    const bad = { surrender: { ...rule().surrender, ssv: { method: "present_value", base: "x", factors: [{ fromYear: 1, toYear: 2, pct: 1 }] }, selection: "higher_of_gsv_ssv" } };
    assert.ok(issues(bad).includes("rules_method_unsupported"));
  });

  test("a selection that needs a table that is not there", () => {
    assert.ok(issues({ surrender: { ...rule().surrender, selection: "higher_of_gsv_ssv" } }).includes("rules_selection_invalid"));
  });

  test("missing identity", () => {
    assert.ok(issues({ uin: "" }).includes("rules_identity_missing"));
  });
});

describe("findVerifiedRuleSet", () => {
  const r = validateRuleSet(rule()).rules as RuleSet;

  test("matches on UIN and insurer, ignoring case and punctuation", () => {
    assert.equal(findVerifiedRuleSet("Example Life Insurance", "999n000v01", null, [r])?.id, "syn");
  });
  test("never on a name alone, or a different UIN", () => {
    assert.equal(findVerifiedRuleSet("Example Life", null, null, [r]), null);
    assert.equal(findVerifiedRuleSet("Example Life", "999N000V02", null, [r]), null);
  });
  test("respects the issue-date window", () => {
    const windowed = { ...r, issuedFrom: "2024-10-01" };
    assert.equal(findVerifiedRuleSet("Example Life", "999N000V01", "2024-09-30", [windowed]), null);
    assert.equal(findVerifiedRuleSet("Example Life", "999N000V01", "2024-10-01", [windowed])?.id, "syn");
    assert.equal(findVerifiedRuleSet("Example Life", "999N000V01", null, [windowed]), null);
  });
  test("ignores anything not reviewed", () => {
    assert.equal(findVerifiedRuleSet("Example Life", "999N000V01", null, [{ ...r, review: { status: "draft" } }]), null);
  });
});
