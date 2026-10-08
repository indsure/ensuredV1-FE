/**
 * The general benefit-illustration reader, on SYNTHETIC fixtures only (a made-up
 * "Sample Money Back Plan", see fixtures/policyDocs/genericTemplate.mjs):
 * 50,000 a year for 10 years from 1 Apr 2021, term 20, payouts of 75,000 in years
 * 5, 10 and 15, maturity 2,50,000, death benefit the higher of 5,00,000 and 105% of
 * premiums paid, GSV = factor x premiums paid less payouts paid.
 */
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parsePolicyDocument } from "../services/policyDocs/index";
import { policySnapshot } from "../../../shared/policySnapshot";
// @ts-ignore: plain JS fixture helper
import { figures } from "./fixtures/policyDocs/genericTemplate.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = async (f: string) => (await parsePolicyDocument(fs.readFileSync(path.join(here, "fixtures/policyDocs", f)), {} as any)).outcome;
const rows = (o: any) => Object.entries<any>(o.fields).map(([k, f]) => ({ field_key: k, revision: 1, state: "document_pending", document_field: f, corrected_value: null }));
const P = (rupees: number) => ({ paise: rupees * 100 });
let main: any;

before(async () => { main = await read("generic-moneyback.pdf"); });

describe("general reader: which reader wins", () => {
  test("a plan with no product reader is read by the general reader", () => {
    assert.equal(main.status, "supported");
    assert.equal(main.adapterId, "general-benefit-illustration");
    assert.deepEqual(main.flags.map((f: any) => f.id), ["read_from_illustration"]);
  });
  test("product readers still win for the plans they know", async () => {
    assert.equal((await read("c2a-digital.pdf")).adapterId, "hdfc-click2achieve-101N186V02-dream-achiever-early-income");
    assert.equal((await read("absli-digital.pdf")).adapterId, "absli-nishchit-aayush-109N137V01-long-term-income-level-lumpsum");
  });
});

describe("general reader: the table", () => {
  test("every year and column matches the illustration", () => {
    const got = main.fields["illustration.rows"].value;
    const want = figures();
    assert.equal(got.length, 20);
    for (const w of want) {
      const g = got[w.y - 1];
      assert.deepEqual(g, { year: w.y, premium: P(w.premium), survival: P(w.survival), maturity: P(w.maturity), death: P(w.death), gsv: P(w.gsv) }, `year ${w.y}`);
    }
  });
  test("start date, term and premium paying term", () => {
    assert.equal(main.fields["schedule.commencement_date"].value, "2021-04-01");
    assert.equal(main.fields["schedule.policy_term_years"].value, 20);
    assert.equal(main.fields["schedule.premium_paying_term_years"].value, 10);
    assert.equal(main.fields["identity.uin"]?.value, "999N001V01");   // printed on the page before the illustration
  });
  test("columns in another order, other wording and right-aligned figures read the same", async () => {
    const o = await read("generic-variants/reordered.pdf");
    assert.deepEqual((o.fields["illustration.rows"] as any).value, main.fields["illustration.rows"].value);
  });
  for (const [f, re] of [
    ["two-gsv", /more than one surrender value column/],
    ["no-gsv", /no guaranteed surrender value column/],
    ["gap-year", /No year-by-year benefit illustration table/],
    ["no-illustration", /No year-by-year benefit illustration table/],
  ] as const) {
    test(`${f}: refused, never guessed`, async () => {
      const o = await read(`generic-variants/${f}.pdf`);
      assert.equal(o.status, "unsupported");
      assert.ok(o.reasons.some((r: string) => re.test(r)), o.reasons.join(" | "));
    });
  }
  test("no customer identity row is read", () => {
    const s = JSON.stringify(main);
    assert.ok(!s.includes("SYNTHETIC TEST HOLDER") && !s.includes("SYN-POL-3307") && !s.includes("Example Road"));
  });
});

describe("general reader: summary card", () => {
  test("as on 8 Oct 2026 (policy year 6)", () => {
    const s = policySnapshot(rows(main), main.flags, {}, "2026-10-08");
    assert.equal(s.source, "illustration");
    assert.equal(s.illustration?.yearNow, 6);
    assert.equal(s.illustration?.yearNowFrom, "2026-04-01");
    assert.equal(s.premium.paidCount, 6);
    assert.deepEqual(s.premium.paidSoFar, P(300000));
    assert.deepEqual(s.premium.totalPayable, P(500000));
    // Year 6: 50% of 3,00,000 less the 75,000 paid in year 5.
    assert.deepEqual(s.gsvToday, P(75000));
    // Year 7, from 1 Apr 2027: 50% of 3,50,000 less 75,000.
    assert.deepEqual(s.nextDue, { date: "2027-04-01", gsv: P(100000) });
    assert.deepEqual(s.atEnd, { date: "2041-04-01", maturity: P(250000), maturityNotApplicable: false, finalPayout: null });
    assert.deepEqual(s.illustration?.payouts, { perYear: P(75000), years: [5, 10, 15], consecutive: false, total: P(225000) });
    assert.deepEqual(s.totalReceived, P(475000));
    assert.deepEqual(s.gainOverPremiums, P(-25000));
    assert.deepEqual(s.lifeCover, P(500000));
  });
  test("after the premium paying term, all premiums count and cover follows the illustration", () => {
    const s = policySnapshot(rows(main), main.flags, {}, "2032-06-01");   // year 12
    assert.equal(s.premium.paidCount, 10);
    assert.deepEqual(s.premium.paidSoFar, P(500000));
    assert.deepEqual(s.lifeCover, P(525000));
  });
  test("without a start date, nothing is placed in a policy year", () => {
    const r = rows(main).map((f) => f.field_key === "schedule.commencement_date" ? { ...f, document_field: { state: "missing", reason: "x" } } : f);
    const s = policySnapshot(r, main.flags, {}, "2026-10-08");
    assert.equal(s.gsvToday, null);
    assert.equal(s.premium.paidSoFar, null);
    assert.deepEqual(s.missing, ["start_date_missing"]);
    assert.deepEqual(s.totalReceived, P(475000));
  });
});
