/**
 * Surrender-value engine tests.
 *
 * NO NETWORK, NO DB, NO MODEL CALL. Pure arithmetic against a real published
 * benefit illustration.
 *
 * Why this file exists: the agent book shows a surrender value per client and
 * an advisor repeats that figure to the client. Nothing checked it against an
 * insurer's own table, and two of them were wrong in the direction that
 * matters, both too high:
 *
 *   1. gsvShare reached the top rate in policy year term-2 instead of term-1,
 *      so every year from 8 onwards paid more than the filed table does. On the
 *      reference policy, year 13 came out at 90% against a real 84%.
 *   2. The money-back branch computed the surrender value gross of the payouts
 *      already handed to the customer (`gsv - 0`, a placeholder that shipped),
 *      counting every survival benefit twice.
 *
 * The anchor is HDFC Life Click 2 Achieve (UIN 101N186V02), policy 27290434,
 * Dream Achiever, 2,00,000 annualised premium, 15-year term, 7-year premium
 * paying term, issued 16 March 2024. GOLDEN_GSV below is that document's own
 * guaranteed surrender value column.
 *
 * Run:  npx tsx --test backend/server/tests/policyValue.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
    computePolicyValue,
    derivedRate,
    gsvShare,
    isValueGap,
    type ValueSchedule,
} from "../../../frontend/client/src/lib/policyValue";
import { buildParams, type YearBandPct } from "../../../frontend/client/src/lib/policyParams";

/* The factor table filed for this product. Years 8 to term-1 are not listed:
   the table states them as an interpolation, which is the thing under test. */
const HDFC_CLICK2ACHIEVE_GSV: YearBandPct[] = [
    { fromYear: 1, toYear: 1, pct: 0 },
    { fromYear: 2, toYear: 2, pct: 30 },
    { fromYear: 3, toYear: 3, pct: 35 },
    { fromYear: 4, toYear: 7, pct: 50 },
    { fromYear: 8, toYear: 99, pct: 90 },
];

const PARAMS = buildParams({
    gsvFactors: { value: HDFC_CLICK2ACHIEVE_GSV, source: "document" },
});

const TERM = 15;
const PPT = 7;
const ANNUAL_PREMIUM = 200_000;

/** Premiums paid by the end of policy year n. Nothing is paid after the PPT. */
const paidBy = (year: number) => ANNUAL_PREMIUM * Math.min(year, PPT);

/**
 * The plan pays a survival benefit every year, and the insurer's formula is
 * "factor x premiums paid, less survival benefits already paid". This is that
 * deduction, recovered from the illustration: it is the single constant that
 * makes all thirteen published rows come out exactly.
 */
const SURVIVAL_BENEFIT = 40_560;

/** The document's own guaranteed surrender value column, by policy year. */
const GOLDEN_GSV: Record<number, number> = {
    2: 79_440,
    3: 128_880,
    4: 278_320,
    5: 337_760,
    6: 397_200,
    7: 456_640,
    8: 500_080,
    9: 529_520,
    10: 572_960,
    11: 616_400,
    12: 659_840,
    13: 689_280,
    14: 732_720,
};

describe("gsvShare against a filed factor table", () => {
    test("reproduces every published row of the reference illustration", () => {
        for (const [yearKey, expected] of Object.entries(GOLDEN_GSV)) {
            const year = Number(yearKey);
            const actual =
                gsvShare(year, TERM, PARAMS) * paidBy(year) - SURVIVAL_BENEFIT * (year - 1);
            assert.equal(
                Math.round(actual),
                expected,
                `policy year ${year}: engine says ${Math.round(actual)}, the document says ${expected}`,
            );
        }
    });

    test("the ramp reaches the top rate in year term-1, not term-2", () => {
        // The regression: term-2 used to return the full 90%.
        assert.equal(gsvShare(TERM - 2, TERM, PARAMS), 0.84);
        assert.equal(gsvShare(TERM - 1, TERM, PARAMS), 0.9);
        assert.equal(gsvShare(TERM, TERM, PARAMS), 0.9);
    });

    test("flat bands below year 8 are read straight off the table", () => {
        assert.equal(gsvShare(1, TERM, PARAMS), 0);
        assert.equal(gsvShare(2, TERM, PARAMS), 0.3);
        assert.equal(gsvShare(3, TERM, PARAMS), 0.35);
        for (let y = 4; y <= 7; y++) assert.equal(gsvShare(y, TERM, PARAMS), 0.5);
    });

    test("never exceeds the top rate and never goes backwards, at any term", () => {
        // Short terms are where a span of zero or a negative denominator would show up.
        for (let term = 5; term <= 40; term++) {
            let previous = -1;
            for (let year = 1; year <= term; year++) {
                const share = gsvShare(year, term, PARAMS);
                assert.ok(Number.isFinite(share), `term ${term} year ${year} is not a number`);
                assert.ok(share >= 0 && share <= 0.9, `term ${term} year ${year}: ${share} out of range`);
                assert.ok(share >= previous, `term ${term} year ${year}: ${share} fell below ${previous}`);
                previous = share;
            }
        }
    });
});

describe("money-back surrender value", () => {
    const base = {
        premium: ANNUAL_PREMIUM,
        premium_frequency: "Annual",
        policy_term_years: TERM,
        premium_paying_term_years: PPT,
        sum_assured: 2_000_000,
        maturity_amount: 1_400_000,
        plan_type: "money back",
        start_date: "2024-03-16",
        next_premium_date: "2030-03-16",
        payout_frequency: "Annual",
        payout_start_date: "2025-03-16",
        payout_end_date: "2038-03-16",
        policy_parameters: { gsvFactors: { value: HDFC_CLICK2ACHIEVE_GSV, source: "document" } },
    };

    const schedule = (payout: number): ValueSchedule => {
        const result = computePolicyValue(
            "life",
            { ...base, payout_amount: payout },
            { asOf: new Date(2029, 5, 1) },
        );
        assert.ok(!isValueGap(result), "the fixture should have enough fields to compute");
        return result as ValueSchedule;
    };

    test("nets off the payouts already handed to the customer", () => {
        const rows = schedule(100_000).rows;
        for (const row of rows.slice(0, TERM - 1)) {
            if (row.received <= 0 || row.back <= 0) continue;
            const gross = gsvShare(row.year, TERM, PARAMS) * row.paid;
            assert.equal(
                Math.round(row.back),
                Math.round(gross - row.received),
                `year ${row.year} pays ${Math.round(row.back)}, gross of payouts already received`,
            );
        }
    });

    test("a plan that pays out is worth less on surrender than one that does not", () => {
        // The direct guard on the `gsv - 0` placeholder: with it back, these match.
        const paying = schedule(100_000).rows;
        const silent = schedule(0).rows;
        const year = 6;
        assert.ok(paying[year - 1].received > 0, "fixture should have banked payouts by year 6");
        assert.ok(
            paying[year - 1].back < silent[year - 1].back,
            "surrender value ignores the payouts already made",
        );
    });

    test("never returns a negative surrender value", () => {
        // Payouts large enough to exceed the guaranteed value outright.
        for (const row of schedule(500_000).rows) {
            assert.ok(row.back >= 0, `year ${row.year} returned ${row.back}`);
        }
    });
});

/* ── Everything below is the zero-model half of the product: a rate is a formula
      on a published yield, a lapsed policy is worth its paid-up share, and a
      customer who needs money can borrow against the policy instead of ending
      it. None of it needs a model call, and none of it may invent a number. ── */

describe("derivedRate", () => {
    test("is the reference yield plus the spread, rounded up to 25 basis points", () => {
        assert.equal(derivedRate(7.0, 150), 8.5);      // 8.50 lands on a boundary
        assert.equal(derivedRate(6.9, 200), 9.0);      // 8.90 rounds up to 9.00
        assert.equal(derivedRate(6.51, 200), 8.75);    // 8.51 rounds up to 8.75
    });

    test("returns nothing at all when no reference yield has been set", () => {
        // The whole point: no yield means no quotable rate, not a default one.
        assert.equal(derivedRate(null, 200), null);
    });
});

const savings = (over: Record<string, unknown> = {}) => ({
    premium: 100_000,
    premium_frequency: "Annual",
    policy_term_years: TERM,
    premium_paying_term_years: PPT,
    sum_assured: 1_000_000,
    plan_type: "Endowment / savings",
    start_date: "2024-03-16",
    ...over,
});

const run = (data: Record<string, unknown>, asOf: Date): ValueSchedule => {
    const result = computePolicyValue("life", data, { asOf });
    assert.ok(!isValueGap(result), "fixture should have enough fields to compute");
    return result as ValueSchedule;
};

describe("a policy that stopped being paid for", () => {
    // Premiums paid for 3 of the 7 years payable, then stopped.
    const lapsed = () => run(savings({ next_premium_date: "2027-03-16" }), new Date(2030, 5, 1));
    const current = () => run(savings({ next_premium_date: "2030-09-16" }), new Date(2030, 5, 1));

    test("is reduced to the share of the premium paying term actually paid", () => {
        const s = lapsed();
        assert.equal(s.premiumStatus, "paid_up");
        assert.equal(s.paidThrough, 3);
        assert.ok(Math.abs(s.paidUpFactor - 3 / 7) < 1e-9, `paid-up factor was ${s.paidUpFactor}`);
    });

    test("is worth less than the same policy still being paid for", () => {
        // The regression this replaces: a lapsed policy used to be shown at its
        // full in-force value with a line of text underneath apologising.
        assert.ok(lapsed().maturity < current().maturity);
        assert.ok(lapsed().rows[9].cover < current().rows[9].cover);
    });

    test("stops counting premiums at the point they stopped", () => {
        const s = lapsed();
        // Year 6 of a 7-year paying term, but only 3 years were ever paid.
        assert.equal(s.rows[5].paid, 3 * 100_000);
    });

    test("leaves a merely late policy alone", () => {
        // A premium a few weeks late is still on risk. Reducing it there would
        // understate the cover at the exact moment the customer might claim.
        const late = run(savings({ next_premium_date: "2030-05-01" }), new Date(2030, 5, 1));
        assert.equal(late.premiumStatus, "overdue");
        assert.equal(late.paidUpFactor, 1);
    });

    test("ends the cover outright on term insurance, which has no paid-up value", () => {
        const term = run(
            { ...savings({ next_premium_date: "2027-03-16" }), plan_type: "Term cover only" },
            new Date(2030, 5, 1),
        );
        assert.equal(term.shape, "pure_term");
        assert.ok(term.rows.every((r) => r.cover === 0), "a lapsed term policy still showed cover");
    });
});

describe("reviving a lapsed policy", () => {
    const quote = (over: Record<string, unknown> = {}) =>
        run(savings({ next_premium_date: "2027-03-16", ...over }), new Date(2030, 5, 1)).revival!;

    test("counts the instalments actually missed", () => {
        // Due 2027, 2028, 2029 and 2030, all before the valuation date.
        const r = quote();
        assert.equal(r.missedInstalments, 4);
        assert.equal(r.arrears, 4 * 100_000);
    });

    test("quotes the arrears even while the interest rate is unset", () => {
        const r = quote();
        assert.equal(r.interest, null);
        assert.equal(r.payable, r.arrears);
        assert.ok(r.rateNote && r.rateNote.length > 0, "an unset rate must say so");
    });

    test("charges interest on the arrears once a reference yield is set", () => {
        const r = quote({ policy_parameters: { gSecYieldPct: 7 } });
        assert.equal(r.ratePct, 9.0);
        assert.ok(r.interest !== null && r.interest > 0);
        assert.ok(r.payable > r.arrears);
        assert.equal(r.rateNote, null);
    });

    test("gives the deadline, which is what decides whether the advisor calls", () => {
        // Five years from the first unpaid premium, capped at the policy's end.
        const r = quote();
        assert.equal(r.deadline, "2032-03-16");
        assert.equal(r.expired, false);
    });

    test("reports an expired window rather than quoting a revival that cannot happen", () => {
        const r = run(savings({ next_premium_date: "2025-03-16" }), new Date(2030, 5, 1)).revival!;
        assert.equal(r.expired, true);
    });

    test("is absent while the policy is in force", () => {
        assert.equal(run(savings({ next_premium_date: "2030-09-16" }), new Date(2030, 5, 1)).revival, null);
    });
});

describe("borrowing against the policy instead of surrendering it", () => {
    const inForce = (over: Record<string, unknown> = {}) =>
        run(savings({ next_premium_date: "2030-09-16", ...over }), new Date(2030, 5, 1));

    test("offers the standard share of the surrender value", () => {
        const s = inForce();
        const today = s.rows[s.currentYear! - 1];
        assert.equal(s.loan.sharePct, 80);
        assert.ok(Math.abs(today.maxLoan - today.back * 0.8) < 1e-6);
        assert.ok(s.loan.available > 0, "an in-force savings policy should be lendable against");
    });

    test("nets off a loan already drawn", () => {
        const clean = inForce();
        const drawn = inForce({ policy_parameters: { outstandingLoan: 50_000 } });
        assert.equal(drawn.loan.outstanding, 50_000);
        assert.ok(Math.abs(clean.loan.available - drawn.loan.available - 50_000) < 1e-6);
    });

    test("flags a policy the loan has eaten", () => {
        const s = inForce();
        const today = s.rows[s.currentYear! - 1];
        const drawn = inForce({ policy_parameters: { outstandingLoan: today.back * 0.95 } });
        assert.equal(drawn.loan.forecloses, true);
        assert.equal(s.loan.forecloses, false);
    });

    test("quotes no rate, and says why, until a reference yield is set", () => {
        assert.equal(inForce().loan.ratePct, null);
        assert.equal(inForce({ policy_parameters: { gSecYieldPct: 6.9 } }).loan.ratePct, 9.0);
    });

    test("lends nothing against term cover, which has no surrender value", () => {
        const t = inForce({ plan_type: "Term cover only" });
        assert.equal(t.loan.available, 0);
        assert.ok(t.rows.every((r) => r.maxLoan === 0));
    });
});

describe("the special surrender value", () => {
    const at = (yieldPct: number | null) =>
        run(
            savings({ next_premium_date: "2030-09-16", policy_parameters: yieldPct === null ? {} : { gSecYieldPct: yieldPct } }),
            new Date(2030, 5, 1),
        );

    test("is a present value once a rate exists, and the banded table before that", () => {
        assert.equal(at(null).ssvMethod, "factor_table");
        assert.equal(at(7).ssvMethod, "present_value");
    });

    test("wins over the guaranteed value when the money is close and the rate is low", () => {
        const s = at(1);
        const today = s.rows[s.currentYear! - 1];
        assert.ok(
            today.back > gsvShare(today.year, TERM, PARAMS) * today.paid,
            "a cheap discount rate should make the paid-up value the better of the two",
        );
    });

    test("falls back to the guaranteed value when the discount rate is punishing", () => {
        const s = at(30);
        const today = s.rows[s.currentYear! - 1];
        assert.ok(Math.abs(today.back - gsvShare(today.year, TERM, PARAMS) * today.paid) < 1);
    });
});

describe("when a surrender value is acquired", () => {
    // A filed table that does pay in year one, so the gate is what is under test
    // rather than a zero factor masking it.
    const withYearOne = {
        gsvFactors: {
            value: [
                { fromYear: 1, toYear: 1, pct: 20 },
                { fromYear: 2, toYear: 3, pct: 30 },
                { fromYear: 4, toYear: 7, pct: 50 },
                { fromYear: 8, toYear: 99, pct: 90 },
            ],
            source: "document",
        },
    };
    const started = (on: string) =>
        run(savings({ start_date: on, next_premium_date: "2035-01-01", policy_parameters: withYearOne }), new Date(2035, 0, 1));

    test("takes two years for a policy issued before the 2024 regulations", () => {
        assert.equal(started("2024-04-01").rows[0].back, 0);
    });

    test("takes one for a policy issued after them", () => {
        assert.ok(started("2024-10-01").rows[0].back > 0);
    });
});
