/**
 * Breakdown sign-normalisation tests.
 *
 * NO NETWORK, NO DB, NO GEMINI. Pure arithmetic over report objects.
 *
 * Why this file exists: the audit prompt writes every penalty as "-15", so the
 * model sometimes returns the minus sign with it. Three of the first thirty
 * stored reports carry negative penalties. Nothing normalised them, and
 * performScoreArithmeticCheck sums the breakdown raw:
 *
 *     sum   = -25 + -30 + -8 + -10        = -73
 *     score = 100 - (-73)                 = 173
 *     bucket(173)                         = 100  ("Excellent")
 *     reconcileVerdict(173)               = SAFE
 *
 * A policy with a room-rent cap, a co-payment and 0.83x cover, which the model
 * itself scored 27 and RISKY, shipped as 100 out of 100, "Excellent", SAFE, with
 * two confidence notes explaining that the server had corrected the model.
 *
 * Three guards built to catch a bad model output combined to invert one. These
 * tests hold the gate shut.
 *
 * Run:  npx tsx --test backend/server/tests/breakdownSign.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
    enforceBreakdownCaps,
    performScoreArithmeticCheck,
    reconcileVerdict,
    clampDisplayScoreToVerdict,
    enforceRequiredCover,
} from "../services/analysisPipeline";
import { applyScoreBucketing } from "../utils/scoreBucketing";

/** A report shaped exactly like the stored ones, with the breakdown supplied.
 *  nec is the lever: enforceRequiredCover re-derives both ncar and the net cover
 *  penalty from nec divided by the age/zone threshold, so nec has to be set to
 *  the cover the scenario intends rather than the ratio being passed in. */
const reportWith = (
    breakdown: Record<string, unknown>,
    score = 27,
    nec = 1250000, // against a 15L threshold => NCAR 0.83
) => ({
    identity: { ages: [45], assumed_zone: "A", city: "Mumbai" },
    audit_score: { score, nec, rct: 1500000, breakdown },
    final_verdict: { label: "RISKY", summary: "x" },
    confidence_notes: [] as string[],
});

/** The production order from runAnalysisPipeline, minus the health-only
 *  reconcileEffectiveCover (which needs a coverage_structure). */
function runScoringGuards(parsed: any) {
    enforceRequiredCover(parsed);
    enforceBreakdownCaps(parsed);
    performScoreArithmeticCheck(parsed);
    reconcileVerdict(parsed);
    parsed.audit_score = applyScoreBucketing(parsed.audit_score);
    clampDisplayScoreToVerdict(parsed);
    return parsed;
}

describe("enforceBreakdownCaps: sign normalisation", () => {
    test("negative penalties are read as deductions, not bonuses", () => {
        const parsed = reportWith({
            claim_rejection_risk: -25,
            oop_exposure: -30,
            coverage_quality_gap: -8,
            net_cover_penalty: -10,
        });
        enforceBreakdownCaps(parsed);

        assert.equal(parsed.audit_score.breakdown.claim_rejection_risk, 25);
        assert.equal(parsed.audit_score.breakdown.oop_exposure, 30);
        assert.equal(parsed.audit_score.breakdown.coverage_quality_gap, 8);
        assert.equal(parsed.audit_score.breakdown.net_cover_penalty, 10);
    });

    test("a negative beyond its cap is capped, not passed through", () => {
        // -45 was previously invisible to the cap check, which only tested `> cap`.
        const parsed = reportWith({ claim_rejection_risk: -45 });
        enforceBreakdownCaps(parsed);
        assert.equal(parsed.audit_score.breakdown.claim_rejection_risk, 30);
    });

    test("net_cover_penalty is normalised even though it carries no cap", () => {
        // enforceRequiredCover only rewrites this on the health path and returns
        // early when ages or zone are unusable, so it cannot be relied on here.
        const parsed = reportWith({ net_cover_penalty: -60 });
        enforceBreakdownCaps(parsed);
        assert.equal(parsed.audit_score.breakdown.net_cover_penalty, 60);
    });

    test("non-finite values become 0 instead of poisoning the sum", () => {
        const parsed = reportWith({ oop_exposure: NaN, coverage_quality_gap: Infinity });
        enforceBreakdownCaps(parsed);
        assert.equal(parsed.audit_score.breakdown.oop_exposure, 0);
        assert.equal(parsed.audit_score.breakdown.coverage_quality_gap, 0);
    });

    test("well-formed positive penalties are left exactly as they are", () => {
        const parsed = reportWith({
            claim_rejection_risk: 15,
            oop_exposure: 20,
            coverage_quality_gap: 8,
            net_cover_penalty: 10,
        });
        enforceBreakdownCaps(parsed);
        assert.deepEqual(parsed.audit_score.breakdown, {
            claim_rejection_risk: 15,
            oop_exposure: 20,
            coverage_quality_gap: 8,
            net_cover_penalty: 10,
        });
        assert.deepEqual(parsed.confidence_notes, []);
    });
});

describe("the full guard chain cannot invert a bad report into a good one", () => {
    test("the real stored breakdown does not ship as 100 / Excellent / SAFE", () => {
        const parsed = runScoringGuards(reportWith({
            claim_rejection_risk: -25,
            oop_exposure: -30,
            coverage_quality_gap: -8,
            net_cover_penalty: -10,
        }));

        assert.notEqual(parsed.audit_score.score, 100);
        assert.notEqual(parsed.audit_score.bucket_label, "Excellent");
        assert.notEqual(parsed.final_verdict.label, "SAFE");

        // 25 + 30 + 8 + (net cover penalty for NCAR 0.83) = 73, so ~27 before
        // bucketing. The exact bucket may move if the ladder changes; what must
        // never happen again is a score above what the deductions allow.
        assert.ok(
            parsed.audit_score.score <= 40,
            `expected a low score, got ${parsed.audit_score.score}`,
        );
    });

    test("a genuinely clean report still scores at the top", () => {
        const parsed = runScoringGuards(reportWith({
            claim_rejection_risk: 0,
            oop_exposure: 0,
            coverage_quality_gap: 0,
            net_cover_penalty: 0,
        }, 100, 3000000)); // 30L against a 15L threshold => NCAR 2.0, no penalty

        assert.equal(parsed.audit_score.score, 100);
        assert.equal(parsed.audit_score.breakdown.net_cover_penalty, 0);
    });
});
