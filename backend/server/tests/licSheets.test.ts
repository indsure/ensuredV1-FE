/**
 * LIC Premium Due + Commission sheet reading and matching.
 *
 * Run:
 *   npx tsx --test backend/server/tests/licSheets.test.ts
 *
 * The real sample sheets hold real client names, and this repo is public, so they are NOT
 * checked in. The sample tests read them from E:/Policiestotest/LIC when that folder exists and
 * skip otherwise. The synthetic tests below always run.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { parseLicSheet, parseDueLines, parseCommissionLines, LicParseError } from "../services/lic/parseSheets";
import { matchDueList, instalmentDueDate, type MatchDueRow, type MatchPaidRow } from "../services/lic/match";

const DIR = "E:/Policiestotest/LIC";
const DUE = `${DIR}/Premdue-202611-02238935.pdf`;
const CM = `${DIR}/CM-935-20261101-02238935.pdf`;
const haveSamples = fs.existsSync(DUE) && fs.existsSync(CM);

test("sample sheets: read, reconcile, and match to the founder's hand count", { skip: !haveSamples }, async () => {
  const due = await parseLicSheet(new Uint8Array(fs.readFileSync(DUE)), "due");
  const cm = await parseLicSheet(new Uint8Array(fs.readFileSync(CM)), "commission");
  assert.equal(due.kind, "due");
  assert.equal(cm.kind, "commission");
  if (due.kind !== "due" || cm.kind !== "commission") return;

  assert.equal(due.period, "2026-11");
  assert.equal(due.rows.length, 73);
  assert.equal(due.grandTotalPremium, 3212585);
  assert.equal(cm.period, "2026-11");
  assert.equal(cm.batch, 1);
  assert.equal(cm.rows.length, 24);
  assert.equal(cm.summary.netPayable, 43254);
  assert.equal(cm.summary.incomeTax, 883);

  const r = matchDueList(due.rows, due.period, cm.rows, "2026-11-28");
  assert.equal(r.totals.paid.count, 19);
  assert.equal(r.totals.paid.amount, 679461);
  assert.equal(r.totals.notPaid.count, 54);
  assert.equal(r.totals.notPaid.amount, 2533124);
  // As of 28 Nov: Jun to Oct arrears plus three monthly November premiums are past grace.
  assert.equal(r.totals.pastGrace.count, 33);
  assert.equal(r.totals.inGrace.count + r.totals.notYetDue.count, 21);
  assert.equal(r.extras.newPolicies, 2);
  assert.equal(r.extras.newPremium, 48907);
  assert.equal(r.extras.paidBeforeList, 3);

  await assert.rejects(parseLicSheet(new Uint8Array(fs.readFileSync(CM)), "due"), (e: any) => e instanceof LicParseError && e.code === "wrong_kind");
  await assert.rejects(parseLicSheet(new Uint8Array(fs.readFileSync(DUE)), "commission"), (e: any) => e instanceof LicParseError && e.code === "wrong_kind");
});

const dueSheet = (rows: string[], total: string, comm: string) => [
  "Branch Code: 900 SOME ADDRESS",
  "Agent Code : LIC09999999 SOME ADDRESS",
  "Premium Due List For The Agent LIC09999999 For 11/2026",
  "S.No PolicyNo Name of Assured D.o.C Pln/Tm Mod FUP Flg InstPrem Due GST TotPrem EstCom",
  ...rows,
  `Grand Total Premium : ${total} G S T : 0 Estimated Comn : ${comm}`,
];

test("due list: a missed row is refused, not shown as fewer policies", () => {
  const ok = dueSheet(
    [
      "1 100000001 TEST ONE 01/06/2004 149/60 Yly 06/2026 4375.00 1 0.00 4375 218.75",
      "2 100000002 TEST(LA) TWO(PR) 15/02/2006 89/21 Qly 11/2026 MT 1494.00 2 0.00 2988 74.70",
    ],
    "7363",
    "293.45",
  );
  const s = parseDueLines(ok);
  assert.equal(s.rows.length, 2);
  assert.equal(s.rows[1].holderName, "TEST(LA) TWO(PR)");
  assert.equal(s.rows[1].flag, "MT");
  assert.equal(s.rows[1].dueCount, 2);

  // Row 2 garbled: totals no longer add up, so nothing is saved.
  const bad = [...ok];
  bad[5] = "2 100000002 TEST TWO 15/02/2006 89/21 Qly 11/2026 MT 1494.00 2 0.00";
  assert.throws(() => parseDueLines(bad), (e: any) => e.code === "totals_mismatch");
});

test("commission sheet: Indian number format and batch", () => {
  const lines = [
    "Agent Code : LIC09999999",
    "Agency Commission - Summary",
    "Summary of Premium and Commission of 11/2026(2nd batch) (see annexure-A for details)",
    "1 TEST ONE 100000001 149-30 09/11/2026 09/05/2003 EPS1 07/11/2026 1,12,679.00 5,633.95",
    "Grand Total Premium : 1,12,679.00 Commission : 5,633.95",
  ];
  const s = parseCommissionLines(lines);
  assert.equal(s.batch, 2);
  assert.equal(s.period, "2026-11");
  assert.equal(s.rows[0].premium, 112679);
  assert.equal(s.rows[0].term, 30);
});

const due = (over: Partial<MatchDueRow>): MatchDueRow => ({
  policyNo: "1", holderName: "X", doc: "2010-03-02", planNo: 165, licTerm: 20, mode: "Q", fup: "2026-06",
  flag: null, instPrem: 1000, dueCount: 2, totalPrem: 2000, estComm: 100, ...over,
});
const paid = (over: Partial<MatchPaidRow>): MatchPaidRow => ({
  policyNo: "1", planNo: 165, term: 20, dueDate: "2026-06-02", riskDate: "2010-03-02", adjDate: "2026-11-05",
  premium: 1000, commission: 50, ...over,
});

test("two instalments owed: one paid is part paid, both paid is paid", () => {
  const one = matchDueList([due({})], "2026-11", [paid({})], "2026-11-28");
  assert.equal(one.rows[0].status, "part_paid");
  assert.equal(one.rows[0].stillDue, 1000);
  const both = matchDueList([due({})], "2026-11", [paid({}), paid({ dueDate: "2026-09-02" })], "2026-11-28");
  assert.equal(both.rows[0].status, "paid");
});

test("the same CM sheet uploaded twice does not count a payment twice", () => {
  const r = matchDueList([due({})], "2026-11", [paid({}), paid({})], "2026-11-28");
  assert.equal(r.rows[0].status, "part_paid");
  assert.equal(r.rows[0].paidAmount, 1000);
});

test("part paid is late from the next unpaid instalment", () => {
  // Quarterly, FUP Jun, Due 2: June paid, so September is the first unpaid one.
  const r = matchDueList([due({})], "2026-11", [paid({})], "2026-09-20");
  assert.equal(r.rows[0].dueDate, "2026-09-02");
  assert.equal(r.rows[0].graceEnds, "2026-10-02");
  assert.equal(r.rows[0].status, "part_paid");
  assert.equal(r.totals.inGrace.count, 1);
  assert.equal(r.totals.inGrace.amount, 1000);
});

test("a payment for an older or later instalment does not clear this one", () => {
  const r = matchDueList([due({ fup: "2026-11", dueCount: 1, totalPrem: 1000 })], "2026-11",
    [paid({ dueDate: "2026-08-02" }), paid({ dueDate: "2026-12-02" })], "2026-11-28");
  assert.equal(r.rows[0].status, "in_grace");
});

test("grace: monthly 15 days, others 30, day clamped to month end", () => {
  assert.equal(instalmentDueDate("2019-01-31", "2026-02"), "2026-02-28");
  const m = matchDueList([due({ mode: "M", fup: "2026-11", doc: "2019-11-02", dueCount: 1, totalPrem: 1000 })], "2026-11", [], "2026-11-18");
  assert.equal(m.rows[0].status, "past_grace");
  const y = matchDueList([due({ mode: "Y", fup: "2026-11", doc: "2019-11-02", dueCount: 1, totalPrem: 1000 })], "2026-11", [], "2026-11-18");
  assert.equal(y.rows[0].status, "in_grace");
  assert.equal(y.rows[0].graceEnds, "2026-12-02");
  const early = matchDueList([due({ mode: "Y", fup: "2026-11", doc: "2019-11-25", dueCount: 1, totalPrem: 1000 })], "2026-11", [], "2026-11-18");
  assert.equal(early.rows[0].status, "due");
});
