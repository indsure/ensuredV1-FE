/**
 * Supplementary benefit states.
 *
 * NO NETWORK, NO DB, NO GEMINI. Pure functions from shared/policy.
 *
 * Why this file exists: a real policy showed "OPD Cover: Covered" in green on a
 * plan whose only outpatient benefit is unlimited video consultations. The model
 * had already said so, in the same object:
 *
 *   { covered: true, utility: "low",
 *     conditions: "Unlimited E-consultations only",
 *     remarks: "Only e-consultations are covered; physical OPD, diagnostics,
 *               and pharmacy are excluded." }
 *
 * Three of those four fields say the benefit is close to worthless. The grid
 * rendered the fourth.
 *
 * This is the same failure as the waiting-period table, which said "Served" for
 * a maternity benefit the policy did not carry: a two-state display collapsing a
 * nuanced answer into the wrong one of two words, on a schema that already held
 * the nuance. So the tests are shaped the same way, mostly asserting what must
 * NOT come back as Covered.
 *
 * Run:  npx tsx --test backend/server/tests/benefitStatus.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { getBenefitStatus } from "../../../shared/policy";

describe("a benefit that exists in name only is not Covered", () => {
    test("the real policy that reported this", async () => {
        const view = getBenefitStatus({
            covered: true,
            utility: "low",
            conditions: "Unlimited E-consultations only",
            remarks: "Only e-consultations are covered; physical OPD, diagnostics, and pharmacy are excluded.",
        });
        assert.equal(view.status, "limited");
        assert.equal(view.label, "Limited");
        assert.equal(view.tone, "partial");
        assert.match(view.detail ?? "", /e-consultations/);
    });

    test("partial cover is not full cover", async () => {
        assert.equal(getBenefitStatus({ covered: true, coverageType: "partial" }).status, "limited");
    });

    test("a benefit graded useless is not covered, whatever the boolean says", async () => {
        // The two disagreeing is itself a reason to trust the grading: a model
        // that writes utility "none" has looked at what the benefit pays.
        const view = getBenefitStatus({ covered: true, utility: "none", remarks: "Nominal cover only." });
        assert.equal(view.status, "absent");
        assert.equal(view.label, "Not Covered");
    });
});

describe("the states that were already right stayed right", () => {
    test("a genuine benefit reads Covered", async () => {
        const view = getBenefitStatus({ covered: true, remarks: "All day care procedures are covered." });
        assert.equal(view.status, "covered");
        assert.equal(view.tone, "good");
    });

    test("Covered carries no explanation, because the word is the whole story", async () => {
        // Six tiles each repeating a remark would bury the one tile that needs it.
        assert.equal(getBenefitStatus({ covered: true, remarks: "Covered up to the sum insured." }).detail, null);
    });

    test("a high or medium grading does not demote a benefit", async () => {
        assert.equal(getBenefitStatus({ covered: true, utility: "high" }).status, "covered");
        assert.equal(getBenefitStatus({ covered: true, utility: "medium" }).status, "covered");
    });

    test("full consumables cover reads Covered", async () => {
        assert.equal(getBenefitStatus({ covered: true, coverageType: "full" }).status, "covered");
    });

    test("an excluded benefit reads Not Covered and says why", async () => {
        const view = getBenefitStatus({
            covered: false,
            coverageType: "none",
            remarks: "Consumables are excluded as the Care Shield rider was not opted.",
        });
        assert.equal(view.status, "absent");
        // Worth showing: it names the rider that would fix it.
        assert.match(view.detail ?? "", /Care Shield/);
    });
});

describe("not knowing is its own answer", () => {
    test("an unclear coverage type is not silently treated as absent", async () => {
        assert.equal(getBenefitStatus({ covered: true, coverageType: "unclear" }).status, "unclear");
    });

    test("a missing boolean is unclear, not Not Covered", async () => {
        // The report has to distinguish "the policy excludes it" from "we could
        // not find it". Only the first is a fact about the policy.
        assert.equal(getBenefitStatus({}).status, "unclear");
        assert.equal(getBenefitStatus({ covered: null }).status, "unclear");
        assert.equal(getBenefitStatus({ covered: undefined, remarks: "x" }).status, "unclear");
    });

    test("an explicit false still wins over a missing coverage type", async () => {
        assert.equal(getBenefitStatus({ covered: false }).status, "absent");
    });
});

describe("Covered is never the fallback", () => {
    test("no combination of empty inputs produces Covered", async () => {
        const utilities = [undefined, null, "high", "medium", "low", "none"] as const;
        const types = [undefined, null, "full", "partial", "none", "unclear"] as const;
        for (const utility of utilities) {
            for (const coverageType of types) {
                for (const covered of [undefined, null, false] as const) {
                    const view = getBenefitStatus({ covered, utility, coverageType } as any);
                    assert.notEqual(view.status, "covered", `${covered} / ${utility} / ${coverageType}`);
                }
            }
        }
    });
});
