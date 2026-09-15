/**
 * Term rider detection and scoring.
 *
 * Run:
 *   npx tsx --test backend/server/tests/termRiders.test.ts
 *
 * The fixtures below are real text lifted from two real policies on
 * 2026-09-11, kept verbatim including their flattened column spacing, because
 * that spacing is exactly what the detector has to survive:
 *
 *   ABSLI Poorna Suraksha Kawach        explicit elections + plan options
 *   Bajaj Allianz Smart Protection Goal a slot table of abbreviations
 *
 * The test that matters most is the first one. Both documents NAME every rider
 * they do not sell, so a detector that merely searched for rider names would
 * report both policies as fully loaded. Absence has to be proved.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  scanTermRiders,
  scoreTermPolicy,
  termScoreCaption,
  enumeratesRiders,
  TERM_RIDER_CATALOG,
  MAX_RIDER_POINTS,
  HOLDING_TERM_PLAN_POINTS,
} from "../../../shared/termRiders";

/** Bajaj: every rider listed, only the base cover carries a value. */
const BAJAJ = `
Sum Assured/Guaranteed Maturity Benefit (GMB) Proposed Insured   2nd Proposer Insured
Add on/Riders   SA/GMB   Add on/Riders   SA/GMB
Main Coverage (Basic)   10000000   Main Coverage (Basic) ADB   ADB APTPDB   APTPDB
CI   CI FIB   FIB WOP for base policy & Riders   WOP for base policy & Riders
Multiplier   Premium Paying Term  37   Benefit Term   76
*Child Education Extra Cover   C1   C2
`;

/** The same table, with a critical illness rider actually bought. */
const BAJAJ_WITH_CI = BAJAJ.replace("CI   CI FIB", "CI   2500000 FIB");

/** ABSLI: an explicit election, and terminal illness described as built in. */
const ABSLI = `
Sum Assured   :   ` + "`" + `   20,000,000.00   Plan Option   : Level Cover Option
Accelerated Critical Illness Benefit   : No
Terminal Illness  In case the Life Insured is diagnosed with a Terminal Illness while the
Policy is in force, all future due Premiums shall be automatically waived under the Policy.
`;

describe("a named rider is not a purchased rider", () => {
  it("reads the Bajaj slot table as proven absences, not as cover", () => {
    const scan = scanTermRiders(BAJAJ);
    const byId = Object.fromEntries(scan.findings.map((f) => [f.id, f]));

    for (const id of ["critical_illness", "accidental_death", "accidental_disability", "waiver_of_premium"]) {
      assert.equal(byId[id].state, "absent_proven", `${id} is listed with no value and must be proven absent`);
    }
    assert.equal(scoreTermPolicy(scan).score, HOLDING_TERM_PLAN_POINTS);
  });

  it("recognises the same table when a rider really was bought", () => {
    const scan = scanTermRiders(BAJAJ_WITH_CI);
    const ci = scan.findings.find((f) => f.id === "critical_illness")!;
    assert.equal(ci.state, "present");
    assert.ok((scoreTermPolicy(scan).score ?? 0) > HOLDING_TERM_PLAN_POINTS);
  });

  it("knows which documents enumerate their riders and which do not", () => {
    assert.equal(enumeratesRiders(BAJAJ), true);
    assert.equal(enumeratesRiders("a policy that simply mentions critical illness once"), false);
  });

  it("sends an uninterpretable mention to a human rather than guessing", () => {
    // No slot table, so a bare mention proves nothing either way.
    const scan = scanTermRiders("This plan may be enhanced with a critical illness option.");
    const ci = scan.findings.find((f) => f.id === "critical_illness")!;
    assert.equal(ci.state, "check_manually");
  });
});

describe("the ABSLI grammar", () => {
  it("reads an explicit No as a proven absence", () => {
    const scan = scanTermRiders(ABSLI);
    const ci = scan.findings.find((f) => f.id === "critical_illness")!;
    assert.equal(ci.state, "absent_proven");
    assert.match(ci.evidence ?? "", /Accelerated Critical Illness/i);
  });

  /* THE KNOWN GAP, pinned rather than wished away.
     ABSLI provides Terminal Illness as a built-in benefit of the plan: the
     wording says future premiums are waived on diagnosis, with no election and
     no sum assured anywhere. A reader can see that it is included. This
     detector cannot, because "described in the benefit wording" and "named as
     a rider nobody bought" look identical in flattened text, and guessing
     present would invent cover on some other policy that merely defines the
     term. So it goes to a human, and the score is 50 with the point set aside
     rather than 55 claimed on inference. Closing this needs a third grammar:
     recognising an unconditional benefit clause. */
  it("cannot yet prove a built-in benefit, and says so rather than guessing", () => {
    const scan = scanTermRiders(ABSLI);
    const ti = scan.findings.find((f) => f.id === "terminal_illness")!;
    assert.equal(ti.state, "check_manually");
    const s = scoreTermPolicy(scan);
    assert.equal(s.score, 50);
    assert.ok(s.setAside > 0, "the unprovable benefit must be visibly set aside");
  });
});

describe("our uncertainty never costs the customer points", () => {
  it("a rider nobody could read leaves the denominator", () => {
    const scan = scanTermRiders(ABSLI);
    const s = scoreTermPolicy(scan);
    const unreadable = scan.findings.filter(
      (f) => f.state === "not_found" || f.state === "check_manually",
    ).length;
    assert.equal(s.setAside, unreadable);
    assert.ok(s.possible < MAX_RIDER_POINTS, "unreadable riders must not sit in the denominator");
  });

  it("a policy with no readable riders still scores the base, not zero", () => {
    const s = scoreTermPolicy(scanTermRiders("a term policy with nothing else in it"));
    assert.equal(s.score, HOLDING_TERM_PLAN_POINTS);
  });

  it("scores null when no term cover was confirmed at all", () => {
    assert.equal(scoreTermPolicy(scanTermRiders(BAJAJ), false).score, null);
  });
});

describe("the weighting is the founder's, and stays that way", () => {
  it("keeps the 50/50 split", () => {
    assert.equal(HOLDING_TERM_PLAN_POINTS, 50);
    assert.equal(MAX_RIDER_POINTS, 50);
  });

  it("uses only 10, 5 and 0, with no invented precision", () => {
    for (const r of TERM_RIDER_CATALOG) {
      assert.ok([10, 5, 0].includes(r.weight), `${r.id} has an off-scale weight`);
    }
  });

  it("scores income benefit and dependent cover at zero, while still detecting them", () => {
    for (const id of ["income_benefit", "dependent"]) {
      const entry = TERM_RIDER_CATALOG.find((r) => r.id === id)!;
      assert.equal(entry.weight, 0);
      assert.ok(entry.aliases.length > 0, `${id} must still be detected so a customer sees it`);
    }
  });
});

describe("the caption", () => {
  it("says the base is half the score and what the number is not", () => {
    const c = termScoreCaption(scoreTermPolicy(scanTermRiders(ABSLI)));
    assert.match(c, /half the score/);
    assert.match(c, /not whether the cover amount is enough/);
  });
});
