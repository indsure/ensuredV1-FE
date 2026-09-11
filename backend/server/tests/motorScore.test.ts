/**
 * The motor score.
 *
 * Run:
 *   npx tsx --test backend/server/tests/motorScore.test.ts
 *
 * This number is shown to a customer and forwarded by an advisor, so the tests
 * that matter most are not the arithmetic ones. They are the two places the
 * score could lie: marking a policy down because OUR reader was unsure, and
 * saying "own damage is not covered" about a car that is in fact covered.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { AddOnScan, AddOnFinding } from "../../../shared/motorAddOns";
import {
  scoreMotorPolicy,
  readOwnDamage,
  motorScoreCaption,
  OWN_DAMAGE_WEIGHT,
  ADD_ON_WEIGHT,
} from "../../../shared/motorScore";

function finding(id: string, state: AddOnFinding["state"]): AddOnFinding {
  return { id, label: id, state, evidence: state === "present" ? "found here" : null, amount: null };
}

function scan(findings: AddOnFinding[], basicOd: number | null = null): AddOnScan {
  return {
    version: 1,
    vehicleClass: "car",
    scannedAt: "2026-09-11T00:00:00.000Z",
    declaredListFound: true,
    pricedLines: [],
    arithmetic: basicOd === null ? null : { basicOd, totalOd: basicOd, headroom: 0 },
    reconciliation: null,
    findings,
    present: findings.filter((f) => f.state === "present").length,
    applicable: findings.length,
    unrecognisedDeclared: [],
  };
}

describe("own damage is read from money first, words second", () => {
  it("an own-damage premium proves the cover, whatever the document calls itself", () => {
    assert.equal(readOwnDamage(scan([], 8400), "Third Party Only"), "covered");
  });

  it("reads the coverage type when there is no premium arithmetic", () => {
    assert.equal(readOwnDamage(scan([]), "Comprehensive"), "covered");
    assert.equal(readOwnDamage(scan([]), "Bundled - Two Wheeler Policy"), "covered");
    assert.equal(readOwnDamage(scan([]), "Package Policy"), "covered");
  });

  it("recognises a genuinely third-party-only policy", () => {
    assert.equal(readOwnDamage(scan([]), "Third Party Only"), "not_covered");
    assert.equal(readOwnDamage(scan([]), "Liability Only"), "not_covered");
  });

  it("says unknown rather than guessing when nothing reads", () => {
    assert.equal(readOwnDamage(scan([]), null), "unknown");
    assert.equal(readOwnDamage(scan([]), ""), "unknown");
    assert.equal(readOwnDamage(null, undefined), "unknown");
  });

  it("never reports not_covered on no evidence", () => {
    // The dangerous direction: telling somebody their car is uninsured when we
    // simply could not read the document.
    assert.notEqual(readOwnDamage(scan([]), "some unparseable marketing name"), "not_covered");
  });
});

describe("our uncertainty never costs the customer points", () => {
  it("leaves not_found and check_manually out of the denominator entirely", () => {
    const s = scoreMotorPolicy(
      scan([
        finding("zero_depreciation", "present"),
        finding("ncb_protect", "not_found"),
        finding("engine_protect", "check_manually"),
      ], 9000),
    null);

    // Own damage (2) + one decidable add-on (1) = 3 possible, all earned.
    assert.equal(s.possible, OWN_DAMAGE_WEIGHT + ADD_ON_WEIGHT);
    assert.equal(s.earned, OWN_DAMAGE_WEIGHT + ADD_ON_WEIGHT);
    assert.equal(s.score, 100);
    assert.equal(s.counted, 1);
    assert.equal(s.setAside, 2);
  });

  it("a policy full of unreadable findings scores null, not zero", () => {
    const s = scoreMotorPolicy(
      scan([finding("a", "not_found"), finding("b", "check_manually")]),
      null,
    );
    assert.equal(s.score, null);
    assert.equal(s.possible, 0);
  });

  it("scores zero only when absence was actually proven", () => {
    const s = scoreMotorPolicy(
      scan([finding("a", "absent_proven"), finding("b", "absent_proven")]),
      "Third Party Only",
    );
    assert.equal(s.score, 0);
    assert.ok(s.possible > 0, "a proven-absent policy must still be scoreable");
  });
});

describe("a score needs more than one fact behind it", () => {
  it("refuses to score a policy where only the word Comprehensive was readable", () => {
    /* The exact shape of a real Acko policy: nine add-ons all not_found, no
       own-damage premium arithmetic, and coverage_type "Comprehensive". It used
       to score 2 of 2 possible and publish 100 out of 100 with "Strong cover"
       against a document we had barely read. */
    const acko = scoreMotorPolicy(
      scan(["zero_depreciation", "consumables", "roadside_assistance"].map((i) => finding(i, "not_found"))),
      "Comprehensive",
    );
    assert.equal(acko.score, null);
    assert.equal(acko.ownDamage, "covered", "the useful fact is still reported");
    assert.equal(acko.counted, 0);
  });

  it("scores as soon as one add-on is genuinely decidable", () => {
    const s = scoreMotorPolicy(
      scan([finding("a", "absent_proven"), finding("b", "not_found")]),
      "Comprehensive",
    );
    assert.notEqual(s.score, null);
    assert.equal(s.counted, 1);
  });
});

describe("own damage carries double an add-on", () => {
  it("a third-party-only policy with every add-on still loses the own-damage weight", () => {
    const addOns = ["a", "b", "c", "d"].map((i) => finding(i, "present"));
    const s = scoreMotorPolicy(scan(addOns), "Liability Only");
    // 4 earned of 6 possible (4 add-ons + 2 for own damage, unearned).
    assert.equal(s.possible, 4 * ADD_ON_WEIGHT + OWN_DAMAGE_WEIGHT);
    assert.equal(s.earned, 4 * ADD_ON_WEIGHT);
    assert.equal(s.score, 67);
  });

  it("comprehensive with no add-ons beats third-party with one", () => {
    const comprehensive = scoreMotorPolicy(scan([finding("a", "absent_proven")], 7000), null);
    const thirdParty = scoreMotorPolicy(scan([finding("a", "present")]), "Third Party Only");
    assert.ok(
      (comprehensive.score ?? 0) > (thirdParty.score ?? 0),
      "own damage must outweigh a single add-on",
    );
  });
});

describe("the caption says what the number measures", () => {
  it("names the own-damage position and the add-ons counted", () => {
    const s = scoreMotorPolicy(scan([finding("a", "present"), finding("b", "not_found")], 9000), null);
    const c = motorScoreCaption(s);
    assert.match(c, /Own damage covered/);
    assert.match(c, /1 add-on checked/);
    assert.match(c, /1 left out as unreadable/);
    assert.match(c, /not the quality of the wording/);
  });

  it("is explicit when nothing could be scored, and still says what it does know", () => {
    // Nothing readable at all.
    assert.match(
      motorScoreCaption(scoreMotorPolicy(scan([]), null)),
      /could not read the add-on cover/,
    );
    // Own damage known but no add-on decidable: the useful half is still said.
    const odOnly = scoreMotorPolicy(scan([finding("a", "not_found")]), "Comprehensive");
    assert.equal(odOnly.score, null, "one readable word must not produce a score");
    assert.match(motorScoreCaption(odOnly), /Own damage is covered/);
  });

  it("always carries the line that stops it being compared to a health score", () => {
    for (const s of [
      scoreMotorPolicy(scan([finding("a", "present")], 100), null),
      scoreMotorPolicy(scan([finding("a", "absent_proven")]), "Third Party Only"),
    ]) {
      assert.match(motorScoreCaption(s), /how completely the vehicle is covered/);
    }
  });
});
