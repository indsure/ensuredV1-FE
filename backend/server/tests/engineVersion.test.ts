/**
 * The scoring version the server stamps and the one the report reads must match.
 *
 * NO NETWORK, NO DB, NO GEMINI.
 *
 * Why this file exists: the number in the circle only means something against
 * the rules that produced it, and those rules changed twice on 2026-09-11. A
 * stored report displays its original score for ever, so without a stamp a
 * reader comparing two reports can be comparing two different questions and
 * never be told.
 *
 * The constant is declared twice, in shared/policy.ts for the report and in
 * analysisPipeline.ts for the server, because the EC2 box runs tsx over
 * backend/server alone: a cross-directory import that resolves locally and not
 * there would take the paid audit path down at boot. That is the same reason
 * computeSingleEventCover is duplicated, and this is the same kind of guard.
 *
 * If this fails, every freshly scored report is about to be labelled as scored
 * under old rules on the day it was produced.
 *
 * Run:  npx tsx --test backend/server/tests/engineVersion.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { SCORING_VERSION, stampEngineVersion } from "../services/analysisPipeline";
import { PROMPT_VERSION } from "../promptTemplate";
import { CURRENT_SCORING_VERSION, isScoredUnderOldRules } from "../../../shared/policy";

describe("the two copies of the scoring version agree", () => {
    test("server and report hold the same value", async () => {
        assert.equal(SCORING_VERSION, CURRENT_SCORING_VERSION);
    });

    test("a freshly stamped report is not labelled as old", async () => {
        const report: any = {};
        stampEngineVersion(report);
        assert.equal(isScoredUnderOldRules(report), false);
    });
});

describe("the stamp records what actually ran", () => {
    test("it carries the prompt, the scoring rules and the date", async () => {
        const report: any = { audit_score: { score: 70 } };
        stampEngineVersion(report);

        assert.equal(report.engine.prompt_version, PROMPT_VERSION);
        assert.equal(report.engine.scoring_version, SCORING_VERSION);
        assert.match(report.engine.scored_at, /^\d{4}-\d{2}-\d{2}$/);
    });

    test("it sits beside the score, not inside it", async () => {
        // So it survives any future rewrite of audit_score, and can be read
        // without knowing anything about how scoring is shaped.
        const report: any = { audit_score: { score: 70 } };
        stampEngineVersion(report);
        assert.equal(report.audit_score.engine, undefined);
        assert.equal(report.audit_score.score, 70, "stamping must not disturb the report");
    });

    test("it refuses anything that is not a report rather than throwing", async () => {
        // Called at the end of a run that has already cost a Gemini call. It must
        // never be the thing that loses one.
        for (const notAReport of [null, undefined, "report", 7]) {
            assert.doesNotThrow(() => stampEngineVersion(notAReport as any));
        }
    });
});

describe("an unstamped report reads as scored under old rules", () => {
    test("nothing carried a stamp before the rules first moved", async () => {
        assert.equal(isScoredUnderOldRules({}), true);
        assert.equal(isScoredUnderOldRules(null), true);
        assert.equal(isScoredUnderOldRules(undefined), true);
    });

    test("a stamp from a superseded version reads as old", async () => {
        assert.equal(
            isScoredUnderOldRules({ engine: { prompt_version: "1.3.0", scoring_version: "1.0.0", scored_at: "2026-09-08" } }),
            true,
        );
    });

    test("only an exact match reads as current", async () => {
        // Not a greater-than comparison. "Different from what runs today" is the
        // question a reader has, and it stays right whichever way a version moves,
        // including a rollback.
        assert.equal(
            isScoredUnderOldRules({ engine: { prompt_version: "9.9.9", scoring_version: "9.9.9", scored_at: "2027-01-01" } }),
            true,
        );
    });
});
