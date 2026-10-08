/**
 * The book: every row visible, totals that reconcile, duplicates counted once.
 *
 * NO NETWORK, NO DB, NO MODEL CALL. Synthetic rows only. Expected counts and
 * sums are worked out by hand beside each assertion.
 *
 * Run:  npx tsx --test backend/server/tests/policyBook.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { buildBook, bookTotals, type SourceRow } from "../../../frontend/client/src/lib/policyBook";

const AS_OF = "2026-10-01";

const life = (id: string, data: Record<string, any>, extra: Partial<SourceRow> = {}): SourceRow => ({
  id, name: "Synthetic " + id, insurance_type: "life", status: "done", extracted_data: data, ...extra,
});

const savings = (over: Record<string, any> = {}) => ({
  insurer: "Example Life", plan_type: "Endowment", premium: 50000, premium_frequency: "Annual",
  policy_term_years: 20, premium_paying_term_years: 20, start_date: "2018-03-15", maturity_amount: 1000000, ...over,
});

const quote = (amount: number, quoteDate: string, quoteType = "surrender_payable") => ({
  schema: 1,
  quotes: [{
    id: "q-" + amount, enteredOn: "2026-09-30", origin: "agent_entered", confirmation: "self_reported",
    reference: null, note: null, supersedes: null, voided: false,
    kind: "quote", quoteType, amount, status: null, paidTo: null, quoteDate,
  }],
});

describe("every candidate policy is visible", () => {
  test("pending, failed, missing, unsupported, broken and term rows all appear with a reason", () => {
    const rows: SourceRow[] = [
      life("a-pending", {}, { status: "processing" }),
      life("b-failed", {}, { status: "error" }),
      life("c-missing", { plan_type: "Endowment" }),
      life("d-pension", savings({ plan_type: "Pension plan" })),
      life("e-term", savings({ plan_type: "Term" })),
      life("f-sparse", { premium: 50000, policy_term_years: 20, plan_name: "Jeevan Plan" }),
      life("g-health", {}, { insurance_type: "health" }),
    ];
    const book = buildBook(rows, { asOf: AS_OF });
    // The health row is not a life policy; the other six all show.
    assert.equal(book.length, 6);
    const by = Object.fromEntries(book.map((r) => [r.id, r]));
    assert.equal(by["a-pending"].state, "pending");
    assert.equal(by["a-pending"].nextStep, "wait_for_reading");
    assert.equal(by["b-failed"].state, "failed");
    assert.equal(by["b-failed"].nextStep, "reupload");
    assert.equal(by["c-missing"].state, "needs_data");
    assert.equal(by["d-pension"].state, "unsupported");
    assert.equal(by["e-term"].state, "term_cover");
    assert.equal(by["f-sparse"].state, "needs_data");
    assert.equal(by["f-sparse"].nextStep, "confirm_plan_type");
  });

  test("a row whose data would break the calculation stays visible and the rest still work", () => {
    const evil: Record<string, any> = savings();
    Object.defineProperty(evil, "value_evidence", { get() { throw new Error("boom"); }, enumerable: true });
    const book = buildBook([life("bad", evil), life("ok", { ...savings(), value_evidence: quote(240000, "2026-09-20") })], { asOf: AS_OF });
    assert.equal(book.length, 2);
    assert.equal(book.find((r) => r.id === "bad")!.state, "error");
    assert.equal(book.find((r) => r.id === "ok")!.state, "quote_on_file");
  });
});

describe("totals", () => {
  test("only dated quotes and calculations are added, apart, and the counts reconcile", () => {
    const rows = [
      life("q1", { ...savings(), value_evidence: quote(240000, "2026-09-20") }),
      life("q2", { ...savings(), value_evidence: quote(100000, "2026-05-01") }),
      life("n1", savings()),
      life("t1", savings({ plan_type: "Term" })),
      life("p1", {}, { status: "processing" }),
    ];
    const t = bookTotals(buildBook(rows, { asOf: AS_OF }));
    // 2,40,000 + 1,00,000 = 3,40,000 from two quotes; the oldest is 1 May.
    assert.equal(t.surrender.quotes.sum, 340000);
    assert.equal(t.surrender.quotes.count, 2);
    assert.equal(t.surrender.quotes.oldest, "2026-05-01");
    assert.equal(t.surrender.calculated.count, 0);
    assert.equal(t.surrender.calculated.sum, 0);
    // 5 rows = 2 included + 3 excluded.
    assert.equal(t.rows, 5);
    assert.equal(t.included, 2);
    assert.equal(t.excluded, 3);
    assert.equal(t.excludedBy.no_cash_figure, 2);
    assert.equal(t.excludedBy.pending, 1);
  });

  test("a book with nothing qualifying has zero counts, which the page shows as Not available", () => {
    const t = bookTotals(buildBook([life("n1", savings())], { asOf: AS_OF }));
    assert.equal(t.surrender.quotes.count + t.surrender.calculated.count, 0);
    assert.equal(t.included, 0);
    assert.equal(t.excluded, 1);
  });

  test("a premium date that passed with no record is counted, never called lapsed", () => {
    const book = buildBook([life("n1", savings())], { asOf: AS_OF });
    assert.equal(book[0].state, "check_payments");
    assert.equal(book[0].datePassed, "2026-03-15");
    assert.equal(bookTotals(book).datePassed, 1);
  });

  test("maturity within the next twelve months is flagged from the date", () => {
    const book = buildBook([life("m1", savings({ start_date: "2007-03-15" }))], { asOf: AS_OF });
    // 2007-03-15 + 20 years = 2027-03-15, inside the year.
    assert.equal(book[0].maturingSoon, true);
  });
});

describe("duplicates", () => {
  test("the same policy uploaded twice, agreeing, is counted once", () => {
    const d = { ...savings({ policy_number: "SYN-001" }), value_evidence: quote(240000, "2026-09-20") };
    const book = buildBook([life("x1", d), life("x2", { ...d })], { asOf: AS_OF });
    const t = bookTotals(book);
    assert.equal(t.surrender.quotes.sum, 240000);
    assert.equal(t.surrender.quotes.count, 1);
    assert.equal(book.filter((r) => r.duplicate?.kind === "confirmed").length, 2);
  });

  test("copies that disagree are disputed and left out of every total", () => {
    const a = { ...savings({ policy_number: "SYN-002" }), value_evidence: quote(240000, "2026-09-20") };
    const b = { ...savings({ policy_number: "SYN-002", premium: 55000 }), value_evidence: quote(260000, "2026-09-20") };
    const book = buildBook([life("y1", a), life("y2", b)], { asOf: AS_OF });
    const t = bookTotals(book);
    assert.equal(t.surrender.quotes.count, 0);
    assert.equal(t.excludedBy.duplicate_disputed, 2);
    assert.ok(book.every((r) => r.nextStep === "review_duplicate"));
  });

  test("same number, one insurer missing: possible duplicate, excluded pending review", () => {
    const a = { ...savings({ policy_number: "SYN-003" }), value_evidence: quote(240000, "2026-09-20") };
    const b = { ...savings({ policy_number: "SYN-003", insurer: null }), value_evidence: quote(240000, "2026-09-20") };
    const t = bookTotals(buildBook([life("z1", a), life("z2", b)], { asOf: AS_OF }));
    assert.equal(t.surrender.quotes.count, 0);
  });

  test("same number at two different insurers is two policies", () => {
    const a = { ...savings({ policy_number: "SYN-004" }), value_evidence: quote(240000, "2026-09-20") };
    const b = { ...savings({ policy_number: "SYN-004", insurer: "Other Life" }), value_evidence: quote(100000, "2026-09-20") };
    const t = bookTotals(buildBook([life("w1", a), life("w2", b)], { asOf: AS_OF }));
    assert.equal(t.surrender.quotes.count, 2);
    assert.equal(t.surrender.quotes.sum, 340000);
  });

  test("the same customer name with no policy number is never merged", () => {
    const d = { ...savings(), value_evidence: quote(240000, "2026-09-20") };
    const t = bookTotals(buildBook([life("v1", d, { name: "Same Name" }), life("v2", { ...d }, { name: "Same Name" })], { asOf: AS_OF }));
    assert.equal(t.surrender.quotes.count, 2);
  });
});
