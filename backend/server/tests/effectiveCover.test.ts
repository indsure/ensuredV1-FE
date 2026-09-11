/**
 * Effective-cover tests.
 *
 * NO NETWORK, NO DB, NO GEMINI. Pure arithmetic over report objects.
 *
 * Why this file exists: report 1b520f0d (ManipalCigna Lifetime Health, base 1Cr)
 * displayed "EFFECTIVE COVER 2.0Cr" in its header and cover stack while its own
 * NCAR of 16.67x against an RCT of 6L implied an NEC of 1.0Cr. One report, two
 * answers to the same question, because coverage_structure.total_effective_coverage,
 * audit_score.nec and cover_stack.combined_effective_cover were each written
 * independently by the model with nothing forcing them to agree.
 *
 * The founder's rule, 2026-09-08: effective cover is what the policy can pay in
 * ONE event. A restoration refills the cover for a LATER claim, so it is never
 * added, however good it is. It is scored in STEP 4 of the prompt instead.
 *
 * Run:  npx tsx --test backend/server/tests/effectiveCover.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
    computeSingleEventCover,
    reconcileEffectiveCover,
    enforceRequiredCover,
    lookupRequiredCover,
} from "../services/analysisPipeline";

// The production backend deliberately does NOT import this at runtime (no @shared
// alias, and the EC2 box runs tsx over backend/server alone). The test does, so the
// two implementations cannot drift apart unnoticed.
import { calculateEffectiveCoverage } from "../../../shared/policy";

const CR = 10000000;
const L = 100000;

/** A minimal report with everything off. Spread over it to switch one thing on. */
function report(coverage: Record<string, any> = {}): any {
    return {
        coverage_structure: {
            base_sum_insured: CR,
            top_up: { exists: false, sum_insured: null, deductible: null, type: null, deductible_achievable: null, remarks: "" },
            super_top_up: { exists: false, sum_insured: null, deductible: null, deductible_achievable: null, remarks: "" },
            restoration: { exists: false, type: null, restore_amount: null, trigger_conditions: null, actually_useful: null, remarks: "" },
            no_claim_bonus: { exists: false, rate_per_year: null, cap_percentage: null, current_bonus: null, portability: null, clarity: null, remarks: "" },
            riders: [],
            total_effective_coverage: null,
            confidence: "high",
            ...coverage,
        },
        audit_score: { score: 90, nec: null, rct: 6 * L, ncar: null, breakdown: {} },
    };
}

describe("computeSingleEventCover", () => {
    test("base cover alone", () => {
        assert.equal(computeSingleEventCover(report()), CR);
    });

    test("regression 1b520f0d: unlimited SAME-illness restoration is NOT added", () => {
        const r = report({
            restoration: {
                exists: true,
                type: "full",
                restore_amount: CR,
                same_illness_covered: true,
                unlimited: true,
                triggers_on_first_claim: false,
                trigger_conditions:
                    "Multiple Restoration is available in a Policy Year for all illnesses, whether unrelated or same, in addition to the Sum Insured of the Underlying Policy.",
                actually_useful: true,
                remarks: "ManipalCigna Health 360 - Advance",
            },
        });
        assert.equal(computeSingleEventCover(r), CR, "a restore must never enlarge a single event");
    });

    test("unrelated-illness restoration is not added either", () => {
        const r = report({
            restoration: { exists: true, type: "full", restore_amount: CR, same_illness_covered: false, unlimited: true, triggers_on_first_claim: false, trigger_conditions: "unrelated illnesses only", actually_useful: true, remarks: "" },
        });
        assert.equal(computeSingleEventCover(r), CR);
    });

    test("accrued NCB in rupees is added", () => {
        const r = report({
            no_claim_bonus: { exists: true, rate_per_year: 10, cap_percentage: 50, current_bonus: 5 * L, portability: "yes", clarity: "clear", remarks: "" },
        });
        assert.equal(computeSingleEventCover(r), CR + 5 * L);
    });

    test("NCB expressed as a percentage is DISCARDED, never multiplied", () => {
        // Motor NCB is a percentage by nature and reaches this field as one.
        // Reading 20 as rupees costs 20 rupees; reading 5,00,000 as a percentage
        // would multiply the cover by 5,000. The unsafe direction is refused.
        const r = report({
            base_sum_insured: 1250000,
            no_claim_bonus: { exists: true, rate_per_year: 20, cap_percentage: 50, current_bonus: 20, portability: "yes", clarity: "clear", remarks: "" },
        });
        assert.equal(computeSingleEventCover(r), 1250000);
    });

    test("a bonus above its own cap is DROPPED, not clamped to base", () => {
        // Clamping to base would turn a bad 5Cr bonus into a tidy-looking 2.0Cr
        // headline on a 1Cr policy: the very number this change exists to remove.
        const r = report({
            no_claim_bonus: { exists: true, rate_per_year: 10, cap_percentage: 50, current_bonus: 5 * CR, portability: "yes", clarity: "clear", remarks: "" },
        });
        assert.equal(computeSingleEventCover(r), CR);
    });

    test("a bonus within its stated cap is kept", () => {
        const r = report({
            no_claim_bonus: { exists: true, rate_per_year: 10, cap_percentage: 50, current_bonus: 40 * L, portability: "yes", clarity: "clear", remarks: "" },
        });
        assert.equal(computeSingleEventCover(r), CR + 40 * L);
    });

    test("no base sum insured yields 0, never a figure built from leftovers", () => {
        // A percentage NCB of 50 with no base used to render as "Effective Cover Rs 50",
        // which then drove ncar 0.0001, a 60-point penalty and an INADEQUATE verdict.
        const r = report({
            base_sum_insured: null,
            no_claim_bonus: { exists: true, rate_per_year: 10, cap_percentage: 50, current_bonus: 50, portability: "yes", clarity: "clear", remarks: "" },
        });
        assert.equal(computeSingleEventCover(r), 0);
    });

    test("top-up counts ONLY when its deductible is bridged", () => {
        const bridged = report({
            top_up: { exists: true, sum_insured: 50 * L, deductible: 5 * L, type: "top-up", deductible_achievable: true, remarks: "" },
        });
        assert.equal(computeSingleEventCover(bridged), CR + 50 * L);

        const unbridged = report({
            top_up: { exists: true, sum_insured: 50 * L, deductible: 5 * CR, type: "top-up", deductible_achievable: false, remarks: "" },
        });
        assert.equal(computeSingleEventCover(unbridged), CR, "an unreachable deductible adds nothing");

        const unknown = report({
            top_up: { exists: true, sum_insured: 50 * L, deductible: null, type: "top-up", deductible_achievable: null, remarks: "" },
        });
        assert.equal(computeSingleEventCover(unknown), CR, "unknown is not a yes");
    });

    test("missing or malformed base does not throw", () => {
        assert.equal(computeSingleEventCover({}), 0);
        assert.equal(computeSingleEventCover(report({ base_sum_insured: null })), 0);
        assert.equal(computeSingleEventCover(report({ base_sum_insured: -5 })), 0);
    });
});

describe("shared/policy.ts parity", () => {
    // The backend copy is duplicated for EC2 boot safety. It must agree exactly.
    const cases = [
        report(),
        report({ restoration: { exists: true, type: "full", restore_amount: CR, same_illness_covered: true, unlimited: true, triggers_on_first_claim: false, trigger_conditions: "x", actually_useful: true, remarks: "" } }),
        report({ no_claim_bonus: { exists: true, rate_per_year: 10, cap_percentage: 50, current_bonus: 5 * L, portability: "yes", clarity: "clear", remarks: "" } }),
        report({ no_claim_bonus: { exists: true, rate_per_year: 20, cap_percentage: 50, current_bonus: 20, portability: "yes", clarity: "clear", remarks: "" } }),
        report({ top_up: { exists: true, sum_insured: 50 * L, deductible: 5 * L, type: "top-up", deductible_achievable: true, remarks: "" } }),
        report({ top_up: { exists: true, sum_insured: 50 * L, deductible: 5 * L, type: "top-up", deductible_achievable: null, remarks: "" } }),
        report({ super_top_up: { exists: true, sum_insured: 90 * L, deductible: 10 * L, deductible_achievable: true, remarks: "" } }),
        // The four expressions written twice are the ones most likely to drift, so
        // each gets a case: the cap rule, the percentage sentinel, an absent base,
        // an absent no_claim_bonus object, and an unbridged super top-up.
        report({ no_claim_bonus: { exists: true, rate_per_year: 10, cap_percentage: 50, current_bonus: 5 * CR, portability: "yes", clarity: "clear", remarks: "" } }),
        report({ no_claim_bonus: { exists: true, rate_per_year: 10, cap_percentage: 50, current_bonus: 40 * L, portability: "yes", clarity: "clear", remarks: "" } }),
        report({ base_sum_insured: null, no_claim_bonus: { exists: true, rate_per_year: 10, cap_percentage: 50, current_bonus: 50, portability: "yes", clarity: "clear", remarks: "" } }),
        report({ base_sum_insured: 50000, no_claim_bonus: { exists: true, rate_per_year: 10, cap_percentage: 50, current_bonus: 20, portability: "yes", clarity: "clear", remarks: "" } }),
        report({ no_claim_bonus: undefined as any }),
        report({ super_top_up: { exists: true, sum_insured: 90 * L, deductible: 10 * L, deductible_achievable: false, remarks: "" } }),
        report({ super_top_up: { exists: true, sum_insured: 90 * L, deductible: 10 * L, deductible_achievable: null, remarks: "" } }),
    ];

    cases.forEach((r, i) => {
        test(`case ${i} agrees across both implementations`, () => {
            assert.equal(computeSingleEventCover(r), calculateEffectiveCoverage(r));
        });
    });
});

describe("reconcileEffectiveCover", () => {
    test("forces header, nec and cover stack to one number", () => {
        const r = report({
            total_effective_coverage: 2 * CR, // what the model wrote
            restoration: { exists: true, type: "full", restore_amount: CR, same_illness_covered: true, unlimited: true, triggers_on_first_claim: false, trigger_conditions: "x", actually_useful: true, remarks: "" },
        });
        r.audit_score.nec = CR; // and the different number it scored on
        r.cover_stack = {
            combined_effective_cover: 2 * CR,
            required_cover: 6 * L,
            counted: ["Base policy sum insured of 1 Crore", "Unlimited same-illness restoration of 1 Crore"],
            excluded: [],
            verdict: "ADEQUATE",
        };

        reconcileEffectiveCover(r);

        assert.equal(r.coverage_structure.total_effective_coverage, CR);
        assert.equal(r.audit_score.nec, CR);
        assert.equal(r.cover_stack.combined_effective_cover, CR);
    });

    test("a restore removed from the number is removed from the prose too", () => {
        const r = report({
            restoration: { exists: true, type: "full", restore_amount: CR, same_illness_covered: true, unlimited: true, triggers_on_first_claim: false, trigger_conditions: "x", actually_useful: true, remarks: "" },
        });
        r.cover_stack = {
            combined_effective_cover: 2 * CR,
            counted: ["Base policy sum insured of 1 Crore", "Unlimited same-illness restoration of 1 Crore"],
            excluded: [],
        };

        reconcileEffectiveCover(r);

        assert.equal(r.cover_stack.counted.length, 1);
        assert.match(r.cover_stack.counted[0], /Base policy/);
        assert.ok(
            r.cover_stack.excluded.some((s: string) => /restor/i.test(s)),
            "the reason it was dropped has to be visible to the reader",
        );
    });

    test("companion cover survives the correction instead of being dropped", () => {
        // The companion portion is taken as the gap between the stated stack and the
        // stated policy total, NOT re-summed from other_cover: usable_today is
        // optional there, so a re-sum silently deletes any companion policy that
        // omitted it while the prose beside the total still lists it as counted.
        const r = report({
            total_effective_coverage: 2 * CR, // inflated by a restore
            restoration: { exists: true, type: "full", restore_amount: CR, same_illness_covered: true, unlimited: true, triggers_on_first_claim: false, trigger_conditions: "x", actually_useful: true, remarks: "" },
        });
        r.cover_stack = {
            combined_effective_cover: 2 * CR + 5 * L, // the restore plus a real 5L corporate cover
            counted: ["Base policy", "Employer group cover Rs 5L"],
            excluded: [],
        };
        r.other_cover = [{ kind: "corporate", sum_insured: 5 * L, counted_in_total: true }]; // no usable_today

        reconcileEffectiveCover(r);

        assert.equal(
            r.cover_stack.combined_effective_cover,
            CR + 5 * L,
            "the restore comes out, the employer cover stays in",
        );
        assert.ok(
            r.cover_stack.counted.some((s: string) => /Employer group/.test(s)),
            "and the prose still agrees with the total",
        );
    });

    test("records the correction so the change is auditable", () => {
        const r = report({ total_effective_coverage: 2 * CR });
        reconcileEffectiveCover(r);
        assert.ok(
            (r.confidence_notes ?? []).some((n: string) => /Effective cover corrected/i.test(n)),
            "a silently corrected number is how the last one went unnoticed",
        );
    });

    test("leaves an empty extraction alone rather than asserting zero cover", () => {
        const r = report({ base_sum_insured: null, total_effective_coverage: 500000 });
        reconcileEffectiveCover(r);
        assert.equal(r.coverage_structure.total_effective_coverage, 500000);
    });
});

describe("enforceRequiredCover derives NCAR even when RCT was already right", () => {
    // Report 1b520f0d stated the right rct for age 26 zone C, nec 2Cr and ncar
    // 16.67. The ratio matched neither its numerator nor the base cover, and the
    // old early-return shipped it untouched because the threshold beside it
    // happened to be right.
    //
    // The threshold is taken from the table rather than written in, so this keeps
    // testing "a correct RCT is left alone" after the table's values change. It
    // was 6L here until the table was re-anchored to what an admission costs.
    const RCT_26_C = lookupRequiredCover(26, "C")!;

    test("a correct RCT no longer skips the NCAR recomputation", () => {
        const r = report();
        r.identity = { ages: [26], assumed_zone: "C" };
        r.audit_score = { score: 90, nec: 2 * CR, rct: RCT_26_C, ncar: 16.67, breakdown: { net_cover_penalty: 0 } };

        enforceRequiredCover(r);

        assert.equal(r.audit_score.rct, RCT_26_C, "the threshold was right and must stay");
        assert.equal(r.audit_score.ncar, Number((2 * CR / RCT_26_C).toFixed(4)), "the ratio must be derived, not accepted");
    });

    test("reconcile then enforce leaves cover, nec and ncar mutually consistent", () => {
        const r = report({
            total_effective_coverage: 2 * CR,
            restoration: { exists: true, type: "full", restore_amount: CR, same_illness_covered: true, unlimited: true, triggers_on_first_claim: false, trigger_conditions: "x", actually_useful: true, remarks: "" },
        });
        r.identity = { ages: [26], assumed_zone: "C" };
        r.audit_score = { score: 90, nec: 2 * CR, rct: RCT_26_C, ncar: 16.67, breakdown: { net_cover_penalty: 0 } };

        reconcileEffectiveCover(r);
        enforceRequiredCover(r);

        assert.equal(r.coverage_structure.total_effective_coverage, CR);
        assert.equal(r.audit_score.nec, CR);
        assert.equal(
            r.audit_score.ncar,
            Number((r.audit_score.nec / r.audit_score.rct).toFixed(4)),
            "ncar must equal nec/rct using the SAME nec the header shows",
        );
    });
});
