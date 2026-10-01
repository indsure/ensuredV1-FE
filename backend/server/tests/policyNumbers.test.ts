/**
 * Strict number and date grammar for policy values.
 *
 * NO NETWORK, NO DB, NO MODEL CALL. Synthetic inputs only.
 *
 * Why: the old `num()` stripped every character that was not a digit, a dot
 * or a minus sign. "Rs. 50,000" became ".50000", which is 0.5, and "1.5 lakh"
 * became 1.5. Both then drove an exact-looking surrender value. Expected
 * values below are written out by hand from the grammar, not taken from the
 * parser.
 *
 * Run:  npx tsx --test backend/server/tests/policyNumbers.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseRupees, parsePercent, percentNeedsConfirmation, parseWholeNumber, parseIsoDate,
  addMonthsIso, completedPolicyYears, anniversaryIso, valuationDateIso,
} from "../../../frontend/client/src/lib/policyNumbers";

const ok = <T,>(r: { ok: boolean; value?: T }) => {
  assert.equal(r.ok, true, JSON.stringify(r));
  return r.value as T;
};
const bad = (r: { ok: boolean; reason?: string }, reason?: string) => {
  assert.equal(r.ok, false, JSON.stringify(r));
  if (reason) assert.equal(r.reason, reason);
};

describe("parseRupees", () => {
  test("plain and grouped amounts", () => {
    assert.equal(ok(parseRupees(50000)), 50000);
    assert.equal(ok(parseRupees("50000")), 50000);
    assert.equal(ok(parseRupees("50,000")), 50000);
    assert.equal(ok(parseRupees("5,00,000")), 500000);
    assert.equal(ok(parseRupees("500,000")), 500000);
    assert.equal(ok(parseRupees("12,34,567.50")), 1234567.5);
  });

  test("the two strings the old parser destroyed", () => {
    assert.equal(ok(parseRupees("Rs. 50,000")), 50000);
    assert.equal(ok(parseRupees("1.5 lakh")), 150000);
  });

  test("prefixes and suffixes in the known grammar", () => {
    assert.equal(ok(parseRupees("₹ 2,56,500")), 256500);
    assert.equal(ok(parseRupees("INR 1,000")), 1000);
    assert.equal(ok(parseRupees("Rs 75,000/-")), 75000);
    assert.equal(ok(parseRupees("2 lakhs")), 200000);
    assert.equal(ok(parseRupees("1.25 crore")), 12500000);
    assert.equal(ok(parseRupees("3 Cr")), 30000000);
  });

  test("keeps the original and says it was normalised", () => {
    const r = parseRupees("Rs. 50,000");
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.original, "Rs. 50,000");
      assert.equal(r.normalized, true);
    }
    const plain = parseRupees(50000);
    if (plain.ok) assert.equal(plain.normalized, false);
  });

  test("rejects anything outside the grammar instead of stripping it", () => {
    bad(parseRupees("50,000 paise"), "not_a_number");
    bad(parseRupees("approx 50k"), "not_a_number");
    bad(parseRupees("5,0000"), "not_a_number");
    bad(parseRupees("50.000.00"), "not_a_number");
    bad(parseRupees("12.345"), "not_a_number"); // three decimals: paise or a typo, not rupees
    bad(parseRupees("1.5L"), "not_a_number"); // L alone is ambiguous
    bad(parseRupees("-5000"), "not_a_number");
    bad(parseRupees(-5000), "negative");
    bad(parseRupees(Number.NaN), "non_finite");
    bad(parseRupees(Number.POSITIVE_INFINITY), "non_finite");
    bad(parseRupees(""), "empty");
    bad(parseRupees(null), "empty");
    bad(parseRupees({}), "not_a_number");
  });
});

describe("parsePercent", () => {
  test("accepts plain percentages", () => {
    assert.equal(ok(parsePercent("7")), 7);
    assert.equal(ok(parsePercent("7.25 %")), 7.25);
    assert.equal(ok(parsePercent(80)), 80);
  });
  test("does not silently turn 0.07 into 7, and does not reject a real 0.3% charge", () => {
    assert.equal(ok(parsePercent(0.07)), 0.07);
    assert.equal(ok(parsePercent("0.3")), 0.3);
    assert.equal(percentNeedsConfirmation(0.07), true);
    assert.equal(percentNeedsConfirmation(7), false);
    assert.equal(percentNeedsConfirmation(0), false);
  });
  test("obeys the mathematical bounds of a percentage", () => {
    bad(parsePercent(101), "out_of_range");
    bad(parsePercent(-1), "out_of_range");
    assert.equal(ok(parsePercent(0)), 0);
    assert.equal(ok(parsePercent(100)), 100);
  });
});

describe("parseWholeNumber", () => {
  test("years and counts", () => {
    assert.equal(ok(parseWholeNumber("20", { min: 1, max: 100 })), 20);
    bad(parseWholeNumber("20.5", { min: 1 }), "not_integer");
    bad(parseWholeNumber("0", { min: 1 }), "out_of_range");
    bad(parseWholeNumber("twenty"), "not_a_number");
  });
});

describe("parseIsoDate", () => {
  test("real calendar dates only", () => {
    assert.equal(ok(parseIsoDate("2018-03-15")), "2018-03-15");
    assert.equal(ok(parseIsoDate("2024-02-29")), "2024-02-29");
    assert.equal(ok(parseIsoDate("2018-03-15T00:00:00.000Z")), "2018-03-15");
    bad(parseIsoDate("2023-02-29"), "invalid_date");
    bad(parseIsoDate("2018-13-01"), "invalid_date");
  });
  test("rejects formats whose day and month order is a guess", () => {
    bad(parseIsoDate("03/04/2018"), "ambiguous_date");
    bad(parseIsoDate("3 April 2018"), "ambiguous_date");
    bad(parseIsoDate("2018-03-15T10:30:00+05:30"), "ambiguous_date");
  });
});

describe("policy calendar", () => {
  test("adds months by calendar, clamping to the month end", () => {
    assert.equal(addMonthsIso("2018-03-15", 12), "2019-03-15");
    assert.equal(addMonthsIso("2024-01-31", 1), "2024-02-29");
    assert.equal(addMonthsIso("2023-01-31", 1), "2023-02-28");
    assert.equal(addMonthsIso("2024-02-29", 12), "2025-02-28");
  });

  test("counts completed policy years by anniversary, not by days", () => {
    // Three calendar years from 16 March 2024 is 1,095 days; days / 365.2425 floors to 2.
    assert.equal(completedPolicyYears("2024-03-16", "2027-03-16"), 3);
    assert.equal(completedPolicyYears("2024-03-16", "2027-03-15"), 2);
    assert.equal(completedPolicyYears("2018-03-15", "2026-10-01"), 8);
    assert.equal(completedPolicyYears("2018-03-15", "2018-03-14"), 0);
  });

  test("a policy that started on 29 February has its anniversary on 28 February in other years", () => {
    assert.equal(anniversaryIso("2024-02-29", 1), "2025-02-28");
    assert.equal(completedPolicyYears("2024-02-29", "2025-02-28"), 1);
    assert.equal(completedPolicyYears("2024-02-29", "2025-02-27"), 0);
    assert.equal(anniversaryIso("2024-02-29", 4), "2028-02-29");
  });

  test("the valuation date is the India calendar date, whatever the machine's zone", () => {
    // 20:00 UTC on 30 Sep is 01:30 on 1 Oct in India.
    assert.equal(valuationDateIso(new Date(Date.UTC(2026, 8, 30, 20, 0))), "2026-10-01");
    assert.equal(valuationDateIso(new Date(Date.UTC(2026, 8, 30, 18, 0))), "2026-09-30");
  });
});

describe("backend copy", () => {
  test("shared/policyNumbers.ts is byte-identical to the frontend module", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const norm = (s: string) => s.replace(/\r\n/g, "\n");
    const a = norm(fs.readFileSync(path.resolve(here, "../../../shared/policyNumbers.ts"), "utf8"));
    const b = norm(fs.readFileSync(path.resolve(here, "../../../frontend/client/src/lib/policyNumbers.ts"), "utf8"));
    assert.equal(a, b, "run: cp frontend/client/src/lib/policyNumbers.ts shared/policyNumbers.ts");
  });
});
