/**
 * Client Plan Match: the advisor-portal pick of the best plan per insurer for
 * one client's calculator answers.
 *
 * Run:
 *   npx tsx --test backend/server/tests/planMatch.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { adultAgesOf, insurerToken, matchPlans, rulesFor, sameInsurer, type MatchPlan } from "../services/planMatch";

const plan = (key: string, insurer: string, axes: Record<string, object>, extra: Partial<MatchPlan> = {}): MatchPlan => ({
  plan_key: key, insurer, plan_name: key, variant: "", max_si: 1e8, score: 80,
  profile: { insurer, plan_name: key, uin: key, sum_insured_options: null, confidence: "high", ...axes } as any,
  entry_age: null,
  ...extra,
});

const GOOD = {
  room_rent: { display: "No cap", ordinal: 5 },
  copayment: { display: "None", number: 0 },
  deductible: { display: "None", number: 0 },
  ped_waiting: { display: "24 months", number: 24 },
};

const rajesh = {
  familyStructure: "Couple + kids", exactAge: 42, spouseAge: 38,
  globalTravel: "Yes, I travel abroad", hospitalPreference: "Large private hospitals",
  okWithDeductibles: false, spousePreExistingConditions: ["hypertension"],
};

describe("rulesFor", () => {
  it("turns answers into must-haves and weights", () => {
    const r = rulesFor(rajesh, 50e5);
    assert.deepEqual(r.needs.map((n) => `${n.key}${n.must ? "!" : ""}`), ["abroad!", "room!", "deductible!", "ped", "cover!", "age!"]);
    assert.equal(r.weights.ped_waiting, 3);
    assert.deepEqual(r.adultAges, [42, 38]);
  });

  it("drops the deductible penalty when the client accepts one", () => {
    assert.equal(rulesFor({ okWithDeductibles: true }, 0).weights.deductible, 0);
  });

  it("counts parents' ages only when they are on the policy", () => {
    assert.deepEqual(adultAgesOf({ familyStructure: "Couple", exactAge: 40, spouseAge: 39, fatherAge: 70 }), [40, 39]);
    assert.deepEqual(adultAgesOf({ familyStructure: "Parents included", exactAge: 40, fatherAge: 70, motherAge: 66 }), [40, 70, 66]);
    assert.equal(rulesFor({ familyStructure: "Parents included", exactAge: 40, fatherAge: 70 }, 0).weights.copayment, 2);
  });
});

describe("matchPlans", () => {
  const pool = [
    plan("tata_premier", "TATA AIG General Insurance Company Limited", { ...GOOD, global_cover: { display: "Inbuilt (planned hospitalisation abroad)", exists: true } }),
    plan("tata_lite", "TATA AIG General Insurance Company Limited", { ...GOOD, global_cover: { display: "Not covered", exists: false } }),
    plan("mc_prime", "ManipalCigna Health Insurance Company Limited", { ...GOOD, global_cover: { display: "Optional (Freedom package)", exists: true, optional: true } }),
    plan("mc_sarvah", "ManipalCigna Health Insurance Company Limited", { ...GOOD, global_cover: { display: "Not covered", exists: false } }, { score: 93 }),
    plan("ab_capped", "Aditya Birla Health Insurance Co. Limited", { ...GOOD, room_rent: { display: "1% of SI/day", ordinal: 3 }, global_cover: { display: "Inbuilt", exists: true } }),
  ];

  it("picks one plan per insurer, inbuilt before add-on", () => {
    const m = matchPlans(rajesh, 50e5, pool);
    assert.deepEqual(m.picks.map((p) => p.plan_key), ["tata_premier", "mc_prime"]);
    assert.equal(m.picks[1].needs.find((n) => n.key === "abroad")!.status, "addon");
  });

  it("explains every plan it did not pick", () => {
    const m = matchPlans(rajesh, 50e5, pool);
    const byKey = Object.fromEntries(m.why_not.map((w) => [w.plan_key, w]));
    assert.equal(byKey.mc_sarvah.kind, "fail");
    assert.equal(byKey.mc_sarvah.need!.key, "abroad");
    assert.equal(byKey.ab_capped.need!.key, "room");
    assert.equal(m.why_not.length, 3);
  });

  it("marks a narrow cover abroad as one to confirm, not a pass", () => {
    const m = matchPlans(rajesh, 50e5, [plan("yuva", "Aditya Birla Health Insurance Co. Limited", { ...GOOD, global_cover: { display: "Optional (maternity only)", optional: true } })]);
    assert.equal(m.picks[0].needs.find((n) => n.key === "abroad")!.status, "unclear");
  });

  it("leaves out plans the family cannot join by age", () => {
    const youth = plan("young", "Star Health and Allied Insurance Co. Ltd.", { ...GOOD, global_cover: { display: "Inbuilt", exists: true } }, { entry_age: { adult_min: 18, adult_max: 40, segment: "youth" } });
    const m = matchPlans(rajesh, 50e5, [youth]);
    assert.equal(m.picks.length, 0);
    assert.equal(m.why_not[0].need!.key, "age");
  });

  it("says when nothing in the pool meets a must-have, and how many plans elsewhere do", () => {
    const m = matchPlans(rajesh, 50e5, [pool[1], pool[3]], [pool[0], pool[2]]);
    assert.equal(m.picks.length, 0);
    assert.equal(m.blocked!.need, "abroad");
    assert.equal(m.blocked!.elsewhere, 2);
  });
});

describe("insurer names", () => {
  it("matches the profile's names to the catalogue's", () => {
    assert.ok(sameInsurer("Tata AIG Health Insurance", "TATA AIG General Insurance Company Limited"));
    assert.ok(sameInsurer("ManipalCigna Health Insurance", "ManipalCigna Health Insurance Company Limited"));
    assert.ok(sameInsurer("Aditya Birla Health Insurance", "Aditya Birla Health Insurance Co. Limited"));
    assert.ok(sameInsurer("Bajaj Allianz Health Insurance", "Bajaj General Insurance Limited"));
    assert.ok(sameInsurer("New India Assurance", "The New India Assurance Co. Ltd."));
    assert.ok(!sameInsurer("Care Health Insurance", "Cholamandalam MS General Insurance Company Limited"));
    assert.equal(insurerToken("Star Health and Allied Insurance Co. Ltd."), "star");
  });
});
