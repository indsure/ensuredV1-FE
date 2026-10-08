/**
 * ABSLI Nishchit Aayush (109N137V01, Long Term Income, Level Income with
 * lumpsum Benefit) on SYNTHETIC fixtures only. Hand-worked figures for the
 * synthetic policy: 1,00,000 a year for 12 years from 15 Jun 2022, 40-year
 * term, 3,368 a month from 15 Jul 2022, enhanced lumpsum 16,80,000, sum
 * assured 10,00,000. GSV = factor x premiums paid, less income already paid.
 */
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parsePolicyDocument } from "../services/policyDocs/index";
import { policySnapshot } from "../../../shared/policySnapshot";

const here = path.dirname(fileURLToPath(import.meta.url));
const fx = (f: string) => fs.readFileSync(path.join(here, "fixtures/policyDocs", f));
const read = async (f: string) => (await parsePolicyDocument(fx(f), {} as any)).outcome;
const rows = (o: any) => Object.entries<any>(o.fields).map(([k, f]) => ({ field_key: k, revision: 1, state: "document_pending", document_field: f, corrected_value: null }));
let golden: any;

before(async () => { golden = await read("absli-digital.pdf"); });

describe("ABSLI Nishchit Aayush: identification", () => {
  test("the synthetic document is recognised by this reader, not the HDFC one", () => {
    assert.equal(golden.status, "supported");
    assert.equal(golden.adapterId, "absli-nishchit-aayush-109N137V01-long-term-income-level-lumpsum");
  });
  for (const [f, status, re] of [
    ["other-version", "unsupported", /109N137V02 is not supported/],
    ["other-option", "unsupported", /Whole Life Income" is not supported/],
    ["no-uin", "unsupported", /UIN could not be read/],
    ["two-uins", "needs_review", /more than one product UIN/],
  ] as const) {
    test(`${f}: ${status}`, async () => {
      const o = await read(`absli-variants/${f}.pdf`);
      assert.equal(o.status, status);
      assert.ok(o.reasons.some((r: string) => re.test(r)), o.reasons.join(" | "));
    });
  }
});

describe("ABSLI Nishchit Aayush: fields", () => {
  test("every field is found, with a source page", () => {
    for (const [k, f] of Object.entries<any>(golden.fields)) {
      assert.equal(f.state, "found", k);
      assert.ok(f.source.pdfPage >= 1, k);
    }
  });
  test("schedule and benefit values", () => {
    const v = (k: string) => golden.fields[k].value;
    assert.equal(v("schedule.policy_term_years"), 40);
    assert.equal(v("schedule.premium_paying_term_years"), 12);
    assert.equal(v("schedule.frequency"), "annual");
    assert.equal(v("schedule.commencement_date"), "2022-06-15");
    assert.equal(v("schedule.final_premium_due_date"), "2033-06-15");
    assert.deepEqual(v("schedule.instalment_premium_renewal"), { paise: 10000000 });
    assert.deepEqual(v("schedule.sum_assured_on_death"), { paise: 100000000 });
    assert.deepEqual(v("benefits.survival_recurring"), { amount: { paise: 336800 }, frequency: "monthly", from: "2022-07-15", to: "2062-06-15" });
    assert.deepEqual(v("benefits.maturity"), { amount: { paise: 168000000 }, date: "2062-06-15" });
    assert.deepEqual(v("death.min_pct_of_premiums_paid"), { bps: 10500 });
    assert.equal(v("surrender.payout_deduction"), "paid_before_surrender_date");
    assert.deepEqual(v("loan.cap_pct_of_surrender_value"), { bps: 8000 });
  });
  test("the GSV column is this policy's term, every year", () => {
    const t = golden.fields["surrender.gsv_factor_table"].value;
    assert.equal(t.length, 40);
    assert.deepEqual(t.slice(0, 4).map((r: any) => r.pct.bps), [0, 3000, 3500, 5000]);
    assert.equal(t[11].pct.bps, 5600);   // year 12 in the 40-year column (the 35-year column says 57%)
    assert.equal(t[39].pct.bps, 9000);
  });
  test("a 35-year term reads the 35-year column", async () => {
    const t = (await read("absli-variants/term-35.pdf")).fields["surrender.gsv_factor_table"] as any;
    assert.equal(t.value.length, 35);
    assert.equal(t.value[11].pct.bps, 5700);
  });
  test("faults are marked, never filled in", async () => {
    assert.equal((await read("absli-variants/gsv-year-missing.pdf")).fields["surrender.gsv_factor_table"]?.state, "unsupported");
    assert.equal((await read("absli-variants/conflicting-sa.pdf")).fields["schedule.sum_assured_on_death"]?.state, "conflicting");
    assert.equal((await read("absli-variants/modal-loading.pdf")).fields["schedule.instalment_premium_renewal"]?.state, "missing");
    assert.equal((await read("absli-variants/short-income.pdf")).fields["benefits.survival_recurring"]?.state, "unsupported");
  });
  test("no customer identity row is read", () => {
    const s = JSON.stringify(golden);
    assert.ok(!s.includes("SYNTHETIC TEST HOLDER") && !s.includes("SYN-POL-9902") && !s.includes("Example Road"));
  });
});

describe("ABSLI Nishchit Aayush: summary card (all premiums paid on due dates)", () => {
  test("as on 1 Oct 2026", () => {
    const s = policySnapshot(rows(golden), golden.flags, {}, "2026-10-01");
    assert.equal(s.premium.paidCount, 5);
    assert.deepEqual(s.premium.paidSoFar, { paise: 50000000 });
    assert.deepEqual(s.premium.totalPayable, { paise: 120000000 });
    // Year 5: 50% of 5,00,000 = 2,50,000, less 51 payouts of 3,368 (15 Jul 2022 to 15 Sep 2026).
    assert.deepEqual(s.gsvToday, { paise: 25000000 - 51 * 336800 });
    // 15 Jun 2027, 6th premium paid: year 6, 50% of 6,00,000 = 3,00,000, less 59 payouts.
    assert.deepEqual(s.nextDue, { date: "2027-06-15", gsv: { paise: 30000000 - 59 * 336800 } });
    assert.deepEqual(s.atEnd.maturity, { paise: 168000000 });
    assert.equal(s.regularPayout?.count, 480);
    assert.deepEqual(s.totalReceived, { paise: 480 * 336800 + 168000000 });
    assert.deepEqual(s.gainOverPremiums, { paise: 480 * 336800 + 168000000 - 120000000 });
    assert.deepEqual(s.lifeCover, { paise: 100000000 });
    assert.equal(s.usedIllustrationMethod, false);
  });
  test("before two years' premiums the GSV is zero", () => {
    // 1 May 2023: only the first premium is due.
    assert.deepEqual(policySnapshot(rows(golden), golden.flags, {}, "2023-05-01").gsvToday, { paise: 0 });
  });
  test("year 3: 35% of premiums paid less income already paid", () => {
    // 1 Jul 2024: 35% of 3,00,000 = 1,05,000, less 24 payouts (15 Jul 2022 to 15 Jun 2024).
    assert.deepEqual(policySnapshot(rows(golden), golden.flags, {}, "2024-07-01").gsvToday, { paise: 10500000 - 24 * 336800 });
  });
  test("income already paid can exceed the gross amount: the GSV is zero, never negative", () => {
    // 1 Jun 2024, year 2: 30% of 2,00,000 = 60,000, less 23 payouts (77,464).
    assert.deepEqual(policySnapshot(rows(golden), golden.flags, {}, "2024-06-01").gsvToday, { paise: 0 });
  });
  test("life cover rises to 105% of premiums paid once that is higher", () => {
    assert.deepEqual(policySnapshot(rows(golden), golden.flags, {}, "2034-01-01").lifeCover, { paise: 126000000 });
  });
});
