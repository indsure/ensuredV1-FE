/**
 * Waiting-period row states.
 *
 * NO NETWORK, NO DB, NO GEMINI. Pure functions from shared/policy.
 *
 * Why this file exists: a policy that does not cover maternity at all showed
 * "Maternity  ✅ Served" in the Waiting Periods table, in green, directly under
 * a coverage grid saying Not Covered and beside a finding saying the same.
 *
 * The cause was the shape of the return, not the arithmetic. The helper knew
 * two states, active and served, and opened with `if (!isActive) return served`.
 * Served was therefore the fallback, and a fallback is where every unknown
 * lands: a benefit that is absent, a duration the document never states, a
 * duration of zero. All three came out as a green tick claiming the customer
 * had waited something out.
 *
 * Served is a claim. These tests exist to keep it from ever being the default
 * again, so the cases below are mostly about what must NOT say served.
 *
 * Run:  npx tsx --test backend/server/tests/waitingPeriodStatus.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { getWaitingPeriodStatus, computeUnlockDate, computeUnlockDateMonths } from "../../../shared/policy";

describe("a waiting period that is not there cannot be served", () => {
    test("the real policy that reported this: maternity relevant, not covered", async () => {
        // Verbatim from the stored report for policy 7eac210c. `relevant: true`
        // is correct and means maternity matters to this family; it does not
        // mean the policy carries a maternity waiting period.
        const view = getWaitingPeriodStatus({
            duration: null,
            covered: false,
            isActive: false,
            monthsRemaining: null,
            endDate: null,
        });
        assert.equal(view.status, "not_covered");
        assert.equal(view.tone, "bad");
        assert.match(view.label, /not covered/i);
        assert.doesNotMatch(view.label, /served/i);
    });

    test("coverage is decided before duration", async () => {
        // An absent benefit has no duration by definition. Falling through to
        // "not stated" would send the reader to the insurer to ask about
        // something that does not exist.
        const view = getWaitingPeriodStatus({ duration: 36, covered: false, isActive: true });
        assert.equal(view.status, "not_covered");
    });

    test("a duration the document never states says so", async () => {
        const view = getWaitingPeriodStatus({ duration: null, isActive: false });
        assert.equal(view.status, "not_stated");
        assert.equal(view.tone, "unknown");
        assert.doesNotMatch(view.label, /served/i);
    });

    test("undefined is treated the same as null, not as zero", async () => {
        assert.equal(getWaitingPeriodStatus({ duration: undefined, isActive: false }).status, "not_stated");
    });

    test("a stated zero is day-one cover, which is good news but is not 'served'", async () => {
        const view = getWaitingPeriodStatus({ duration: 0, isActive: false });
        assert.equal(view.status, "none");
        assert.equal(view.tone, "good");
        assert.doesNotMatch(view.label, /served/i);
    });
});

describe("the states that were already right stayed right", () => {
    test("a real period that has elapsed is served", async () => {
        // The same policy's initial 30-day period: inception 2025-09-22.
        const endDate = computeUnlockDate("2025-09-22", 30);
        assert.equal(endDate, "2025-10-22");
        const view = getWaitingPeriodStatus({ duration: 30, isActive: false, endDate });
        assert.equal(view.status, "served");
        assert.equal(view.tone, "good");
    });

    test("a live period counts down from today, not from the policy's full term", async () => {
        // Its 36-month PED period, which unlocks in 2028.
        const endDate = computeUnlockDateMonths("2025-09-22", 36);
        assert.equal(endDate, "2028-09-22");
        const view = getWaitingPeriodStatus({ duration: 36, isActive: true, monthsRemaining: 24, endDate });
        assert.equal(view.status, "active");
        assert.equal(view.tone, "bad");
        assert.match(view.label, /months remaining/);
    });

    test("an active period with no usable end date still reads as active", async () => {
        const view = getWaitingPeriodStatus({ duration: 24, isActive: true, monthsRemaining: null, endDate: null });
        assert.equal(view.status, "active");
        assert.equal(view.label, "⏳ Active");
    });
});

describe("a missing duration cannot produce a date, or the render dies", () => {
    test("computeUnlockDate returns null rather than throwing on an absent duration", async () => {
        // `getUTCDate() + undefined` is NaN, which makes the Date invalid, and
        // toISOString() on an invalid Date throws. Inside a render that takes
        // down the whole report rather than one row.
        assert.equal(computeUnlockDate("2025-09-22", undefined), null);
        assert.equal(computeUnlockDate("2025-09-22", null), null);
        assert.equal(computeUnlockDate("2025-09-22", NaN), null);
    });

    test("computeUnlockDateMonths does the same", async () => {
        assert.equal(computeUnlockDateMonths("2025-09-22", null), null);
        assert.equal(computeUnlockDateMonths("2025-09-22", NaN), null);
    });

    test("a real duration still resolves", async () => {
        assert.equal(computeUnlockDate("2025-09-22", 30), "2025-10-22");
        assert.equal(computeUnlockDateMonths("2025-09-22", 24), "2027-09-22");
    });
});
