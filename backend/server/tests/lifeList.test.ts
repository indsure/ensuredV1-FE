/**
 * Rows for the advisor portal's Life section (frontend/client/src/lib/lifeList.ts).
 * NO NETWORK, NO DB, NO MODEL CALL. Run: npx tsx --test backend/server/tests/lifeList.test.ts
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { lifeStats, maturingSoon, premiumDueSoon, suggestLifeType, toLifeRow } from "../../../frontend/client/src/lib/lifeList";
import { isoDay } from "../../../frontend/client/src/lib/lifePremium";

const TODAY = new Date(2026, 10, 24);
const row = (insurance_type: string, extracted_data: Record<string, any>, extra: Record<string, any> = {}) =>
  toLifeRow({ id: "x", insurance_type, extracted_data, ...extra }, TODAY);

describe("toLifeRow", () => {
  test("health and motor rows are not life rows", () => {
    assert.equal(row("health", {}), null);
    assert.equal(row("motor", {}), null);
  });

  test("a future date is as stated only when the reader recorded that basis", () => {
    const old = row("term", { next_premium_date: "2026-12-10", start_date: "2023-12-10", premium_frequency: "Annual", premium_paying_term_years: 10 })!;
    assert.equal(old.due!.basis, "unconfirmed");
    const r = row("term", { next_premium_date: "2026-12-10", next_premium_date_basis: "stated", start_date: "2023-12-10", premium_frequency: "Annual", premium_paying_term_years: 10 })!;
    assert.equal(isoDay(r.due!.date), "2026-12-10");
    assert.equal(r.due!.basis, "stated");
  });

  test("a stale stated date is rolled and labelled by schedule", () => {
    const r = row("life", { next_premium_date: "2024-06-21", start_date: "2023-06-21", premium_frequency: "Annual", premium_paying_term_years: 37 })!;
    assert.equal(isoDay(r.due!.date), "2027-06-21");
    assert.equal(r.due!.basis, "schedule");
  });

  test("a date the reader itself rolled is never called stated", () => {
    const r = row("term", { next_premium_date: "2026-12-01", next_premium_date_basis: "schedule", start_date: "2024-03-01", premium_frequency: "Monthly", premium_paying_term_years: 15 })!;
    assert.equal(r.due!.basis, "schedule");
  });

  test("no frequency: the printed date, labelled as printed", () => {
    const r = row("life", { next_premium_date: "2025-01-01" })!;
    assert.equal(r.due!.basis, "printed");
    assert.equal(premiumDueSoon(r, TODAY), false);
  });

  test("no next premium: says why, and missing dates are never read as nothing due", () => {
    assert.equal(row("life", { premium_frequency: "Annual" })!.noDue, "not_read");
    assert.equal(row("life", {})!.noDue, "not_read");
    assert.equal(row("life", { premium_frequency: "Single", start_date: "2024-01-01" })!.noDue, "single");
    assert.equal(row("life", { premium_frequency: "Annual", start_date: "2010-01-01", premium_paying_term_years: 5 })!.noDue, "term_over");
  });

  test("end date: the type's own date, then the other, then expiry_date", () => {
    assert.equal(row("life", { maturity_date: "2039-03-04", cover_end_date: "2040-01-01" })!.endDate, "2039-03-04");
    assert.equal(row("term", { maturity_date: "2039-03-04", cover_end_date: "2040-01-01" })!.endDate, "2040-01-01");
    assert.equal(row("term", { maturity_date: "2039-03-04" })!.endDate, "2039-03-04");
    assert.equal(row("life", {}, { expiry_date: "2045-06-19T00:00:00.000Z" })!.endDate, "2045-06-19");
  });

  test("amounts: blanks and zeros are not shown as figures", () => {
    const r = row("term", { sum_assured: "1,00,00,000", premium: 0 })!;
    assert.equal(r.sumAssured, 10000000);
    assert.equal(r.premium, null);
  });
});

describe("views and stats", () => {
  const rows = [
    row("life", { next_premium_date: "2026-12-10", start_date: "2020-12-10", premium_frequency: "Annual", premium_paying_term_years: 15, maturity_date: "2027-01-15" })!,
    row("term", { next_premium_date: "2026-11-10", start_date: "2020-11-10", premium_frequency: "Annual", premium_paying_term_years: 20, cover_end_date: "2060-11-10" })!,
    row("term", { start_date: "2024-03-01", premium_frequency: "Monthly", premium_paying_term_years: 15, cover_end_date: "2074-02-17" })!,
    row("life", { maturity_date: "2026-10-01" })!,
  ];

  test("premium due soon: within 30 days, and a yearly date passed in the last 30 days", () => {
    assert.deepEqual(rows.map((r) => premiumDueSoon(r, TODAY)), [true, true, true, false]);
  });

  test("maturing soon: within 90 days, never a date already passed", () => {
    assert.deepEqual(rows.map((r) => maturingSoon(r, TODAY)), [true, false, false, false]);
  });

  test("stats count life and term separately, and no money", () => {
    assert.deepEqual(lifeStats(rows, TODAY), { life: 2, term: 2, premiumDue: 3, maturing: 1 });
  });
});

describe("suggestLifeType (suggest only, D2)", () => {
  test("a life row read as a plain term plan suggests term", () => {
    assert.equal(suggestLifeType("life", { plan_type: "term" }), "term");
    assert.equal(suggestLifeType("life", { plan_type: "Term Insurance Plan" }), "term");
  });
  test("return of premium and savings plans do not suggest term", () => {
    assert.equal(suggestLifeType("life", { plan_type: "term with return of premium" }), null);
    assert.equal(suggestLifeType("life", { plan_type: "Guaranteed income savings" }), null);
  });
  test("a zero maturity amount suggests term only with the words it came from", () => {
    assert.equal(suggestLifeType("life", { maturity_amount: 0 }), null);
    assert.equal(suggestLifeType("life", { maturity_amount: 0, field_sources: { maturity_amount: { excerpt: "Maturity Benefit (Rs.) 0" } } }), "term");
  });
  test("a term row with a savings plan type or a maturity benefit suggests life", () => {
    assert.equal(suggestLifeType("term", { plan_type: "endowment" }), "life");
    assert.equal(suggestLifeType("term", { maturity_amount: 1400000 }), "life");
    assert.equal(suggestLifeType("term", { payout_amount: 3380 }), "life");
  });
  test("a blank read or a return-of-premium term suggests nothing", () => {
    assert.equal(suggestLifeType("term", {}), null);
    assert.equal(suggestLifeType("term", { plan_type: "return of premium" }), null);
    assert.equal(suggestLifeType("life", {}), null);
  });
});
