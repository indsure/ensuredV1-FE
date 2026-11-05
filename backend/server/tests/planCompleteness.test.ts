/**
 * Plan completeness and the top-3 ranking behind "Compare Plans With This Coverage".
 *
 * Run:
 *   npx tsx --test backend/server/tests/planCompleteness.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { maxSumInsured, scoreCompleteness } from "../services/planCompleteness";
import { ageEligible, rankPlans } from "../services/planRecommend";
import type { WordingProfile } from "../types/wordingProfile";

const profile = (axes: Record<string, object>): WordingProfile =>
  ({ insurer: "X", plan_name: "Y", uin: "U", sum_insured_options: null, confidence: "high", ...axes }) as any;

const STRONG = profile({
  room_rent: { display: "No cap", ordinal: 5 },
  icu: { display: "No cap", ordinal: 5 },
  copayment: { display: "None", number: 0 },
  sub_limits: { display: "No sub-limits", ordinal: 5 },
  deductible: { display: "None", number: 0 },
  ped_waiting: { display: "24 months", number: 24 },
  restoration: { display: "Unlimited, 100%", ordinal: 5 },
});

const WEAK = profile({
  room_rent: { display: "1% of SI/day", ordinal: 3 },
  icu: { display: "2% of SI/day", ordinal: 3 },
  copayment: { display: "20% on all claims", number: 20 },
  sub_limits: { display: "Cataract, knee capped", ordinal: 1 },
  deductible: { display: "₹50,000", number: 50000 },
  ped_waiting: { display: "48 months", number: 48 },
  restoration: { display: "None", ordinal: 0 },
});

describe("scoreCompleteness", () => {
  it("scores a broad plan well above a capped one", () => {
    const s = scoreCompleteness(STRONG).score;
    const w = scoreCompleteness(WEAK).score;
    assert.ok(s > w + 30, `strong ${s} should clear weak ${w} by a wide margin`);
    assert.ok(s >= 0 && s <= 100 && w >= 0 && w <= 100);
  });

  it("names the heaviest strengths and gaps", () => {
    assert.ok(scoreCompleteness(STRONG).strengths.some((x) => x.startsWith("Room Rent")));
    const gaps = scoreCompleteness(WEAK).gaps;
    assert.equal(gaps.length, 3);
    assert.ok(gaps.some((x) => x.startsWith("Co-payment")));
  });

  it("is deterministic", () => {
    assert.deepEqual(scoreCompleteness(STRONG), scoreCompleteness(STRONG));
  });
});

describe("maxSumInsured", () => {
  it("reads lakh and crore ranges", () => {
    assert.equal(maxSumInsured("₹5L – ₹2Cr"), 2e7);
    assert.equal(maxSumInsured("₹30/40/50/75 Lakhs, ₹1/2/2.5/3/5 Crores"), 5e7);
    assert.equal(maxSumInsured("₹5L – ₹300L"), 3e7);
    assert.equal(maxSumInsured("₹25/50/75/100/200 Lakhs"), 2e7);
  });

  it("treats unlimited as no ceiling", () => {
    assert.ok((maxSumInsured("₹5L, ₹1Cr, Unlimited") ?? 0) > 1e9);
  });

  it("returns null when the wording states no amount", () => {
    assert.equal(maxSumInsured("Not specified in wording"), null);
    assert.equal(maxSumInsured("Entry age 18 to 65"), null);
    assert.equal(maxSumInsured(null), null);
  });
});

describe("rankPlans", () => {
  const plan = (key: string, insurer: string, score: number, max_si: number | null) => ({
    plan_key: key, uin: key, variant: "", insurer, plan_name: key,
    sum_insured_options: null, max_si, score, strengths: [], gaps: [], unknown: 0,
  });
  const catalog = [
    plan("a1", "A", 95, 1e7), plan("a2", "A", 94, 1e7),
    plan("b1", "B", 90, 5e6), plan("c1", "C", 88, 3e6),
    plan("d1", "D", 99, null), plan("e1", "E", 80, 2e7),
  ];

  it("keeps one plan per insurer, best first", () => {
    assert.deepEqual(rankPlans(catalog, 0).map((p) => p.plan_key), ["d1", "a1", "b1"]);
  });

  it("drops plans that cannot carry the cover, and plans with no stated cover", () => {
    assert.deepEqual(rankPlans(catalog, 40e5).map((p) => p.plan_key), ["a1", "b1", "e1"]);
  });

  it("ranks only within an advisor's list when given one", () => {
    assert.deepEqual(rankPlans(catalog, 40e5, new Set(["e1", "c1", "a2"])).map((p) => p.plan_key), ["a2", "e1"]);
  });

  it("leaves out plans the adults cannot join by age", () => {
    const aged = [
      { ...plan("y1", "Y", 99, 1e7), entry_age: { adult_min: 18, adult_max: 40, segment: "youth" as const } },
      { ...plan("s1", "S", 98, 1e7), entry_age: { adult_min: 61, adult_max: 75, segment: "senior" as const } },
      ...catalog,
    ];
    assert.deepEqual(rankPlans(aged, 40e5, undefined, [35, 33]).map((p) => p.plan_key), ["y1", "a1", "b1"]);
    // A 58-year-old spouse is too young for the 61-to-75 senior plan.
    assert.deepEqual(rankPlans(aged, 40e5, undefined, [66, 58]).map((p) => p.plan_key), ["a1", "b1", "e1"]);
    assert.deepEqual(rankPlans(aged, 40e5, undefined, [68]).map((p) => p.plan_key), ["s1", "a1", "b1"]);
    // No ages: only plans a typical adult (18 to 65) can join.
    assert.deepEqual(rankPlans(aged, 40e5).map((p) => p.plan_key), ["a1", "b1", "e1"]);
  });
});

describe("ageEligible", () => {
  it("keeps general plans with no stated ages, drops age-group plans with none", () => {
    assert.equal(ageEligible(null, [70]), true);
    assert.equal(ageEligible({ adult_min: null, adult_max: null, segment: null }, [70]), true);
    assert.equal(ageEligible({ adult_min: null, adult_max: null, segment: "senior" }, [70]), false);
  });

  it("checks every adult against both limits", () => {
    const ea = { adult_min: 18, adult_max: 65, segment: null };
    assert.equal(ageEligible(ea, [42, 38]), true);
    assert.equal(ageEligible(ea, [42, 67]), false);
    assert.equal(ageEligible({ adult_min: 18, adult_max: null, segment: null }, [90]), true);
  });
});
