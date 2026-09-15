/**
 * Required cover: the audit and the calculator must price the same event the same.
 *
 * NO NETWORK, NO DB, NO GEMINI.
 *
 * Why this file exists: for the same man, in the same city, on the same day, the
 * calculator said a bad hospital admission costs ₹14L and the audit said he
 * required ₹8L of cover. Both claimed to describe today. The ₹8L one decided
 * whether his policy scored as well covered, so he read 80 and "Good" on one page
 * while the other page told him to buy four times what he had.
 *
 * The audit's table is now the calculator's cost anchors. Those anchors live in
 * frontend/client/src/lib/health-engine-logic.ts and are duplicated into the
 * backend, because the backend has no @shared alias and the EC2 box runs tsx over
 * backend/server alone: a cross-directory import that resolves locally and not on
 * the box would take the paid audit path down at boot. This test is what keeps
 * the duplicate honest, the same job effectiveCover.test.ts does for cover.
 *
 * It also pins two deliberate absences. There is no floater multiplier, because
 * RCT is a single-event threshold and one admission does not cost more when more
 * people share the policy. And the penalty curve is the prompt's continuous
 * formula, not the step bands the code used to carry beside it.
 *
 * Run:  npx tsx --test backend/server/tests/requiredCover.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { lookupRequiredCover, netCoverPenaltyFor } from "../services/analysisPipeline";

/** Verbatim from getWorstCaseScenario in the calculator engine. */
const calculatorWorstCase = (age: number): number => {
    if (age < 35) return 1400000;
    if (age < 45) return 1750000;
    if (age < 55) return 2500000;
    if (age < 65) return 3500000;
    if (age < 75) return 4500000;
    return 5000000;
};

/** Verbatim from CALCULATOR_CONFIG.cityMultipliers, by the zone each tier maps to. */
const calculatorZoneMultiplier: Record<string, number> = { A: 1.15, B: 1.05, D: 1.05, C: 1.0 };

describe("the audit prices a bad admission exactly as the calculator does", () => {
    for (const age of [18, 34, 35, 44, 45, 54, 55, 64, 65, 74, 75, 92]) {
        for (const zone of ["A", "B", "C", "D"]) {
            test(`age ${age}, zone ${zone}`, async () => {
                const expected =
                    Math.round((calculatorWorstCase(age) * calculatorZoneMultiplier[zone]) / 50000) * 50000;
                assert.equal(lookupRequiredCover(age, zone), expected);
            });
        }
    }
});

describe("the table the prompt prints is the table the code computes", () => {
    // If these drift, the model reads one set of numbers and the server corrects
    // it to another on every single run, and every report carries a confidence
    // note saying so.
    const printed: Array<[number, string, number]> = [
        [30, "A", 1600000], [30, "B", 1450000], [30, "C", 1400000],
        [40, "A", 2000000], [40, "B", 1850000], [40, "C", 1750000],
        [50, "A", 2900000], [50, "B", 2650000], [50, "C", 2500000],
        [60, "A", 4000000], [60, "B", 3700000], [60, "C", 3500000],
        [70, "A", 5200000], [70, "B", 4750000], [70, "C", 4500000],
        [80, "A", 5750000], [80, "B", 5250000], [80, "C", 5000000],
    ];
    for (const [age, zone, value] of printed) {
        test(`${age} / ${zone} is ₹${(value / 100000).toFixed(1)}L in both`, async () => {
            assert.equal(lookupRequiredCover(age, zone), value);
        });
    }

    test("Zone D is priced as Zone B, as the rulebook says", async () => {
        assert.equal(lookupRequiredCover(30, "D"), lookupRequiredCover(30, "B"));
    });
});

describe("required cover does not move with family size", () => {
    test("the figure depends on age and zone only", async () => {
        // There is no lives argument, and there must not be one. A ×1.4 for a
        // 3-life floater took this family from a ratio of 0.68 to 0.49, across
        // the automatic-failure line at 0.50, so a policy covering two thirds of
        // the worst realistic event was labelled Risky. The second-admission
        // risk that multiplier was really pricing belongs in the multi-year
        // target, where the calculator already prices it at 8% rather than 40%.
        assert.equal(lookupRequiredCover.length, 2);
        assert.equal(lookupRequiredCover(32, "B"), 1450000);
    });
});

describe("unusable input returns null rather than a number", () => {
    for (const [age, zone, what] of [
        [NaN, "A", "age is not a number"],
        [Infinity, "A", "age is infinite"],
        [30, "", "zone is empty"],
        [30, "Z", "zone is not one we know"],
    ] as Array<[number, string, string]>) {
        test(what, async () => {
            assert.equal(lookupRequiredCover(age, zone), null);
        });
    }

    test("zone is read case-insensitively", async () => {
        assert.equal(lookupRequiredCover(30, "b"), 1450000);
    });
});

describe("the penalty curve is the prompt's, not the step bands beside it", () => {
    // The code carried 0/10/25/40/60 steps while the prompt specified a
    // continuous formula, so the same policy scored differently depending on
    // which of the two you read. These are the prompt's own worked examples.
    test("the two examples printed in the rulebook", async () => {
        assert.equal(netCoverPenaltyFor(0.9), 4);
        assert.equal(netCoverPenaltyFor(0.6), 19);
    });

    test("adequate cover is never penalised", async () => {
        assert.equal(netCoverPenaltyFor(1.0), 0);
        assert.equal(netCoverPenaltyFor(3.4), 0);
    });

    test("the man who reported this: 10L against 14.5L", async () => {
        // 0.69. The step bands charged a flat 25 anywhere between 0.50 and 0.75,
        // so his shortfall and one twice as bad cost exactly the same.
        assert.equal(netCoverPenaltyFor(1000000 / 1450000), 14);
    });

    test("within a band, a worse shortfall now costs more", async () => {
        // The whole point of a curve. Under the step version every one of these
        // returned 25.
        assert.equal(netCoverPenaltyFor(0.74) < netCoverPenaltyFor(0.62), true);
        assert.equal(netCoverPenaltyFor(0.62) < netCoverPenaltyFor(0.51), true);
    });

    test("no cliff at a band edge", async () => {
        // A step table jumped 10 -> 25 across 0.75. Either side must now differ
        // by about a point, which is what "continuous" has to mean in practice.
        assert.equal(Math.abs(netCoverPenaltyFor(0.7499) - netCoverPenaltyFor(0.7501)) <= 1, true);
        assert.equal(Math.abs(netCoverPenaltyFor(0.4999) - netCoverPenaltyFor(0.5001)) <= 1, true);
        assert.equal(Math.abs(netCoverPenaltyFor(0.2999) - netCoverPenaltyFor(0.3001)) <= 1, true);
    });

    test("it only ever gets worse as cover thins, and never past 60", async () => {
        let previous = -1;
        for (let ncar = 1.2; ncar >= 0; ncar -= 0.01) {
            const p = netCoverPenaltyFor(Number(ncar.toFixed(2)));
            assert.equal(p >= previous, true, `penalty fell at ncar ${ncar.toFixed(2)}`);
            assert.equal(p <= 60, true, `penalty exceeded the cap at ncar ${ncar.toFixed(2)}`);
            previous = p;
        }
        assert.equal(netCoverPenaltyFor(0), 60);
    });
});
