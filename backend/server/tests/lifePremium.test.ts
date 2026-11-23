/**
 * Next life/term premium date (frontend/client/src/lib/lifePremium.ts) and the
 * Policies list's follow-up date (getNextPremiumDate in lib/insuranceTypes.ts).
 *
 * NO NETWORK, NO DB, NO MODEL CALL. Expected dates are worked by hand.
 *
 * Run:  npx tsx --test backend/server/tests/lifePremium.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { isoDay, nextLifePremium } from "../../../frontend/client/src/lib/lifePremium";
import { getNextPremiumDate } from "../../../frontend/client/src/lib/insuranceTypes";

const TODAY = new Date(2026, 10, 23); // 23 Nov 2026, local
const day = (d: { date: Date } | null) => (d ? isoDay(d.date) : null);

describe("nextLifePremium", () => {
  test("a stale stated date rolls forward by the frequency", () => {
    // Stored at upload a year ago; yearly; still paying.
    const due = nextLifePremium({ next: "2025-12-10", start: "2020-12-10", freq: "Yearly", ppt: 15 }, TODAY);
    assert.equal(day(due), "2026-12-10");
    assert.equal(due?.kind, "scheduled");
    assert.equal(due?.perYear, 1);
  });

  test("no stated date: rolls from the start date", () => {
    const due = nextLifePremium({ next: null, start: "2021-03-05", freq: "Quarterly", ppt: 10 }, TODAY);
    assert.equal(day(due), "2026-12-05");
  });

  test("a yearly date that passed in the last 30 days stays, marked passed", () => {
    const due = nextLifePremium({ next: "2026-11-01", start: "2020-11-01", freq: "Annual", ppt: 20 }, TODAY);
    assert.equal(day(due), "2026-11-01");
    assert.equal(due?.kind, "passed");
  });

  test("a monthly date that passed rolls to the next instalment", () => {
    const due = nextLifePremium({ next: "2026-11-01", start: "2024-01-01", freq: "Monthly", ppt: 10 }, TODAY);
    assert.equal(day(due), "2026-12-01");
    assert.equal(due?.kind, "scheduled");
  });

  test("paying term over: nothing is due", () => {
    assert.equal(nextLifePremium({ next: null, start: "2010-01-01", freq: "Yearly", ppt: 10 }, TODAY), null);
  });

  test("the last instalment is inside the paying term; the one after is not", () => {
    // Starts 1 Jan 2017, pays 10 years: last premium 1 Jan 2026, so none left.
    assert.equal(nextLifePremium({ next: null, start: "2017-01-01", freq: "Yearly", ppt: 10 }, TODAY), null);
    // Starts 1 Dec 2017, pays 10 years: last premium 1 Dec 2026, still due.
    assert.equal(day(nextLifePremium({ next: null, start: "2017-12-01", freq: "Yearly", ppt: 10 }, TODAY)), "2026-12-01");
  });

  test("single premium: nothing is due", () => {
    assert.equal(nextLifePremium({ next: "2027-01-01", start: "2026-01-01", freq: "Single premium", ppt: 1 }, TODAY), null);
  });

  test("no readable frequency: the printed date, not rolled", () => {
    const due = nextLifePremium({ next: "2025-06-01", start: "2020-06-01", freq: "", ppt: 20 }, TODAY);
    assert.equal(day(due), "2025-06-01");
    assert.equal(due?.kind, "printed");
  });

  test("no dates at all: nothing", () => {
    assert.equal(nextLifePremium({ next: null, start: null, freq: "Yearly", ppt: 20 }, TODAY), null);
  });
});

describe("getNextPremiumDate", () => {
  test("life never falls back to the maturity date", () => {
    // expiry_date is the maturity date on a life row. No premium dates were read.
    assert.equal(getNextPremiumDate("2045-06-19", { premium_frequency: "Yearly" }, "life", TODAY), null);
  });

  test("term never falls back to the cover end date", () => {
    assert.equal(getNextPremiumDate("2065-03-01", {}, "term", TODAY), null);
  });

  test("life: a stale stored date comes back rolled forward", () => {
    const data = { next_premium_date: "2025-12-10", start_date: "2020-12-10", premium_frequency: "Yearly", premium_paying_term_years: 15 };
    assert.equal(getNextPremiumDate("2040-12-10", data, "life", TODAY), "2026-12-10");
  });

  test("health and motor keep the stated date, else the expiry date", () => {
    assert.equal(getNextPremiumDate("2027-02-01", {}, "health", TODAY), "2027-02-01");
    assert.equal(getNextPremiumDate("2027-02-01", { next_premium_date: "2027-01-15" }, "motor", TODAY), "2027-01-15");
    assert.equal(getNextPremiumDate("2027-02-01", null, undefined, TODAY), "2027-02-01");
  });
});
