// Tones and call-outs for the simplified compare view. Fixture = the four plans a tester
// compared on 2026-10-08 (Acko Health II, Chola Healthline, EquiCover Health, Yes Plus),
// with the displays exactly as the catalogue holds them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { compareMany, type WordingProfile } from "../types/wordingProfile";
import { insights, isSameRow, allRows, coverRupees, plainDisplay } from "../../../frontend/client/src/lib/compareInsights";

const D = (display: string, extra: Record<string, unknown> = {}) => ({ display, note: null, ...extra });
const base = (name: string, insurer: string, axes: Record<string, unknown>) =>
  ({ insurer, plan_name: name, uin: name, sum_insured_options: null, confidence: "high", ...axes }) as unknown as WordingProfile;

const common = {
  initial_waiting: D("30 days", { number: 30 }),
  moratorium: D("60 months", { number: 60 }),
  free_look: D("30 days", { number: 30 }),
  portability: D("Allowed", { exists: true }),
};

const acko = base("Acko Health II", "Acko", {
  ...common,
  room_rent: D("As per Schedule", { ordinal: 0 }),
  icu: D("As per Schedule", { ordinal: 0 }),
  copayment: D("None (base)", { number: 0 }),
  sub_limits: D("As per Schedule", { ordinal: 0 }),
  deductible: D("None (base)", { number: 0 }),
  ped_waiting: D("36 months", { number: 36 }),
  specific_disease_waiting: D("36 months", { number: 36 }),
  maternity: D("Not covered", { exists: false }),
  cumulative_bonus: D("Optional; rate/max as per Schedule", { number: null, optional: true }),
  restoration: D("Optional; conditions as per Schedule", { ordinal: null, optional: true }),
  pre_hosp: D("As per Schedule", { number: null }),
  post_hosp: D("As per Schedule", { number: null }),
  consumables: D("Optional (Waiver of non-payable expenses add-on)", { exists: true, optional: true }),
});
const chola = base("Chola Healthline", "Cholamandalam MS", {
  ...common,
  room_rent: D("Single AC room", { ordinal: 4 }),
  icu: D("No cap", { ordinal: 5 }),
  copayment: D("None", { number: 0 }),
  sub_limits: D("No sub-limits", { ordinal: 5 }),
  deductible: D("None", { number: 0 }),
  ped_waiting: D("36 months", { number: 36 }),
  specific_disease_waiting: D("24 months", { number: 24 }),
  maternity: D("Not covered", { exists: false }),
  cumulative_bonus: D("Up to 100% (5%/yr)", { number: 100 }),
  restoration: D("Not covered", { ordinal: 0 }),
  pre_hosp: D("60 days", { number: 60 }),
  post_hosp: D("90 days", { number: 90 }),
  consumables: D("Not covered", { exists: false }),
});
const equi = base("EquiCover Health", "HDFC ERGO", {
  ...common,
  room_rent: D("1% of SI/day", { ordinal: 3 }),
  icu: D("2% of SI/day", { ordinal: 3 }),
  copayment: D("20% on all claims", { number: 20, note: "can be waived by paying additional optional premium" }),
  sub_limits: D("Cataract ₹40k/eye; Modern treatments 50% of SI", { ordinal: 1 }),
  deductible: D("None", { number: 0 }),
  ped_waiting: D("36 months", { number: 36 }),
  specific_disease_waiting: D("24 months", { number: 24 }),
  maternity: D("Not covered", { exists: false }),
  cumulative_bonus: D("Not specified", { number: null }),
  restoration: D("Not covered", { ordinal: 0 }),
  pre_hosp: D("30 days", { number: 30 }),
  post_hosp: D("60 days", { number: 60 }),
  consumables: D("Not covered", { exists: false }),
});
const yes = base("Yes Plus Health", "IndusInd", {
  ...common,
  room_rent: D("Not specified", { ordinal: 0 }),
  icu: D("No cap (ICU not proportionately reduced)", { ordinal: 5 }),
  copayment: D("None", { number: 0 }),
  sub_limits: D("Maternity capped at ₹1 lakh; Modern treatments capped at 50% of SI", { ordinal: 3 }),
  deductible: D("Aggregate Deductible (amount per Certificate of Insurance)", { number: null }),
  ped_waiting: D("24 months", { number: 24 }),
  specific_disease_waiting: D("24 months", { number: 24 }),
  maternity: D("Covered (12mo wait, ₹1L limit)", { exists: true }),
  cumulative_bonus: D("Not specified", { number: null }),
  restoration: D("Not covered", { ordinal: 0 }),
  pre_hosp: D("60 days", { number: 60 }),
  post_hosp: D("90 days", { number: 90 }),
  consumables: D("Not covered", { exists: false }),
});

const result = compareMany([acko, chola, equi, yes]);
const row = (k: string) => allRows(result).find((r) => r.key === k)!;
const tones = (k: string) => row(k).cells.map((c) => c.tone);

test("As per Schedule is unknown and never ranked", () => {
  assert.deepEqual(tones("room_rent"), ["unknown", "good", "bad", "unknown"]);
  // Before: ordinal 0 counted as worst, so Chola and EquiCover both "beat" an unread schedule.
  assert.deepEqual(row("room_rent").cells.map((c) => c.winner), [false, true, false, false]);
  assert.equal(row("room_rent").cells[0].value, null);
});

test("claim-day tones", () => {
  assert.deepEqual(tones("copayment"), ["good", "good", "bad", "good"]);
  assert.deepEqual(tones("icu"), ["unknown", "good", "limit", "good"]);
  assert.deepEqual(tones("sub_limits"), ["unknown", "good", "bad", "limit"]);
  // A deductible whose amount is on the certificate still exists.
  assert.deepEqual(tones("deductible"), ["good", "good", "good", "bad"]);
  assert.deepEqual(tones("consumables"), ["limit", "bad", "bad", "bad"]);
});

test("waits, maternity and growth", () => {
  assert.deepEqual(tones("ped_waiting"), ["limit", "limit", "limit", "good"]);
  assert.deepEqual(tones("maternity"), ["bad", "bad", "bad", "good"]);
  assert.deepEqual(tones("cumulative_bonus"), ["limit", "good", "unknown", "unknown"]);
  assert.deepEqual(tones("restoration"), ["limit", "bad", "bad", "bad"]);
});

test("a co-pay that hits only some people is a limit, not a cost", () => {
  const r = compareMany([
    base("A", "X", { copayment: D("20% (age 61+)", { number: 20 }) }),
    base("B", "Y", { copayment: D("None", { number: 0 }) }),
  ]);
  assert.equal(allRows(r).find((x) => x.key === "copayment")!.cells[0].tone, "limit");
});

test("call-outs name the right plans", () => {
  const cards = insights(result);
  assert.deepEqual(cards.find((c) => c.kind === "strongest"), { kind: "strongest", side: 1, rowKeys: ["room_rent", "icu", "copayment", "sub_limits", "deductible"] });
  assert.deepEqual(cards.find((c) => c.kind === "only"), { kind: "only", side: 3, rowKey: "maternity" });
  assert.deepEqual(cards.find((c) => c.kind === "watch"), { kind: "watch", side: 2, rowKeys: ["room_rent", "copayment", "sub_limits", "consumables"] });
  const papers = cards.filter((c) => c.kind === "papers");
  assert.equal(papers.length, 1);
  assert.equal(papers[0].side, 0);
});

test("identical rows are folded away", () => {
  assert.equal(isSameRow(row("initial_waiting")), true);
  assert.equal(isSameRow(row("moratorium")), true);
  assert.equal(isSameRow(row("room_rent")), false);
  assert.equal(isSameRow(row("ped_waiting")), false);
});

test("old saved results without tones still render sensibly", () => {
  const old = structuredClone(result);
  for (const r of allRows(old)) for (const c of r.cells) { delete c.tone; delete c.value; }
  const cards = insights(old);
  assert.ok(cards.every((c) => c.kind !== "watch")); // no tones, no red call-out invented
  assert.equal(isSameRow(allRows(old).find((r) => r.key === "initial_waiting")!), true);
});

test("percent-of-cover limits in rupees, in plain words", () => {
  assert.equal(coverRupees("1% of SI/day", 1000000), "₹10,000");
  assert.equal(coverRupees("2% of Sum Insured per day", 500000), "₹10,000");
  assert.equal(coverRupees("Single AC room", 1000000), null);
  assert.equal(plainDisplay("1% of SI/day"), "1% of cover a day");
  // The catalogue often says "Base SI".
  assert.equal(coverRupees("1% of Base SI/day", 500000), "₹5,000");
  assert.equal(plainDisplay("1% of Base SI/day"), "1% of Base cover a day");
});
