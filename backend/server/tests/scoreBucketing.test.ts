/**
 * Score bucketing tests.
 *
 * NO NETWORK, NO DB, NO GEMINI.
 *
 * The interval moved from 12.5 to 5 on 2026-09-11. Two properties have to hold
 * and neither is obvious from the one-line change:
 *
 *  1. Every displayed score is a whole multiple of 5. `clients.score` is an
 *     integer column, so a half-point score is silently re-rounded on the way
 *     into the database and the stored number stops matching the report.
 *  2. Every score from the OLD 12.5 grid keeps the label it already has. Stored
 *     reports carry no ruleset version, so a label change would rewrite the
 *     wording on reports the reader has already seen.
 *
 * getScoreLabel used to be an exact-value lookup keyed on the nine 12.5-step
 * values. At 5-point steps that returns "Unknown" for 85, 90, 45 and most other
 * real scores, which is the trap this file exists to keep shut.
 *
 * Run:  npx tsx --test backend/server/tests/scoreBucketing.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
    BUCKET_STEP,
    bucketScore,
    getScoreLabel,
    applyScoreBucketing,
    getBucketingExplanation,
} from "../utils/scoreBucketing";

describe("bucketScore", () => {
    test("rounds to the nearest 5", () => {
        assert.equal(bucketScore(87), 85);
        assert.equal(bucketScore(88), 90);
        assert.equal(bucketScore(27), 25);
        assert.equal(bucketScore(2), 0);
        assert.equal(bucketScore(72.5), 75); // .5 rounds up
    });

    test("every result is a whole multiple of 5, so the integer column is lossless", () => {
        for (let raw = -20; raw <= 140; raw += 0.5) {
            const b = bucketScore(raw);
            assert.equal(b % BUCKET_STEP, 0, `${raw} bucketed to ${b}`);
            assert.equal(b, Math.round(b), `${raw} bucketed to a non-integer ${b}`);
        }
    });

    test("clamps to 0-100", () => {
        assert.equal(bucketScore(173), 100); // the negative-penalty inversion case
        assert.equal(bucketScore(-40), 0);
    });

    test("a non-finite score does not escape as NaN", () => {
        assert.equal(bucketScore(NaN), 0);
        assert.equal(bucketScore(Infinity), 0);
    });
});

describe("getScoreLabel", () => {
    test("every score on the old 12.5 grid keeps the label it has today", () => {
        // Exactly the mapping the previous exact-value lookup produced.
        const legacy: Array<[number, string]> = [
            [0, "Critical"],
            [12.5, "Very Poor"],
            [25, "Poor"],
            [37.5, "Below Average"],
            [50, "Marginal"],
            [62.5, "Adequate"],
            [75, "Good"],
            [87.5, "Very Good"],
            [100, "Excellent"],
        ];
        for (const [score, label] of legacy) {
            assert.equal(getScoreLabel(score), label, `score ${score}`);
        }
    });

    test("the new 5-point values all resolve to a real label", () => {
        for (let s = 0; s <= 100; s += BUCKET_STEP) {
            assert.notEqual(getScoreLabel(s), "Unknown", `score ${s} had no label`);
        }
    });

    test("labels never go backwards as the score rises", () => {
        const order = [
            "Critical", "Very Poor", "Poor", "Below Average",
            "Marginal", "Adequate", "Good", "Very Good", "Excellent",
        ];
        let seen = -1;
        for (let s = 0; s <= 100; s += BUCKET_STEP) {
            const rank = order.indexOf(getScoreLabel(s));
            assert.ok(rank >= seen, `score ${s} (${getScoreLabel(s)}) ranked below the score beneath it`);
            seen = rank;
        }
    });
});

describe("applyScoreBucketing", () => {
    test("buckets the score, keeps the raw one, and labels the bucket", () => {
        const out = applyScoreBucketing({ score: 87, ncar: 2.0 });
        assert.equal(out.score, 85);
        assert.equal(out.raw_score, 87);
        assert.equal(out.bucket_label, "Very Good");
        assert.equal(out.bucketing_method, "nearest_5");
        assert.equal(out.ncar, 2.0, "other fields must survive");
    });

    test("a score-less object is returned untouched", () => {
        const input = { ncar: 1.2 };
        assert.equal(applyScoreBucketing(input), input);
        assert.equal(applyScoreBucketing(null), null);
    });
});

describe("getBucketingExplanation", () => {
    test("states the interval actually in use", () => {
        const text = getBucketingExplanation();
        assert.match(text, new RegExp(`nearest ${BUCKET_STEP} points`));
        assert.doesNotMatch(text, /12\.5/, "the note still advertises the old interval");
    });
});
