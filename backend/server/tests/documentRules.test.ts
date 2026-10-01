/**
 * Calculations from advisor-reviewed document rules.
 *
 * NO NETWORK, NO DB, NO MODEL CALL. The rule values below are the synthetic
 * template's terms (the same as the reference product's published terms for
 * one option). Every expected amount is worked by hand in the comment beside
 * it, with exact fractions, not taken from the code under test.
 *
 * Run:  npx tsx --test backend/server/tests/documentRules.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  documentValues, foreclosureApplies, referenceTenorYears, ssvDiscountRateBps, loanRateBps, gsvFactorForYear,
  type ConfirmedFacts,
} from "../../../frontend/client/src/lib/documentRules";
import { add, eqR, num, op, rat, v } from "../../../frontend/client/src/lib/exactMath";
import type { ReviewFlag } from "../../../frontend/client/src/lib/policyDocTypes";

const ramp = op("add", num(rat(1, 2)), op("div", op("mul", num(rat(2, 5)), op("sub", v("policy_year"), num(rat(7)))), op("sub", v("policy_term"), num(rat(8)))));
const BANDS = [
  { from: 2, to: 2, factor: num(rat(3, 10)), raw: "30%" },
  { from: 3, to: 3, factor: num(rat(7, 20)), raw: "35%" },
  { from: 4, to: 7, factor: num(rat(1, 2)), raw: "50%" },
  { from: 8, to: "term_minus_2", factor: ramp, raw: "ramp" },
  { from: "term_minus_1", to: "term", factor: num(rat(9, 10)), raw: "90%" },
];
const GSV_FORMULA = op("max", op("sub", op("mul", v("gsv_factor"), v("total_premiums_paid")), v("survival_benefits_till_date")), num(rat(0)));

const VALUES: Record<string, unknown> = {
  "schedule.policy_term_years": 15,
  "schedule.premium_paying_term_years": 7,
  "schedule.frequency": "annual",
  "schedule.risk_commencement_date": "2024-03-04",
  "schedule.commencement_date": "2024-03-16",
  "schedule.premium_due_day_month": { day: 4, month: 3 },
  "schedule.final_premium_due_date": "2030-03-04",
  "schedule.policy_end_date": "2039-03-04",
  "schedule.instalment_premium_first_year": { paise: 20000000 },
  "schedule.instalment_premium_renewal": { paise: 20000000 },
  "schedule.extra_premium": { paise: 0 },
  "schedule.deferral_selected": false,
  "schedule.grace_days": 30,
  "definitions.policy_anniversary_anchor": "risk_commencement_date",
  "definitions.total_premiums_paid_excludes": ["extra premium", "rider premium", "taxes"],
  "benefits.survival_recurring": { amount: { paise: 338000 }, frequency: "monthly", from: "2024-04-04", to: "2039-03-04" },
  "benefits.survival_terminal": { amount: { paise: 140000000 }, date: "2039-03-04" },
  "surrender.gsv_formula": GSV_FORMULA,
  "surrender.gsv_factor_bands": BANDS,
  "surrender.gsv_acquisition_min_premium_years": 2,
  "status.paid_up_formula": op("div", op("mul", v("payout"), v("premiums_paid_count")), v("premiums_payable_count")),
  "status.lapse_with_gsv": "paid_up",
  "status.lapse_without_gsv": "lapsed_cover_ceases_no_benefits",
  "grace.rule": { monthlyDays: 15, otherDays: 30 },
  "revival.window": { years: 5, from: "due_date_of_first_unpaid_premium", beforeTermExpiry: true },
  "loan.cap_pct_of_surrender_value": { bps: 8000 },
  "loan.foreclosure": { appliesTo: "other_than_in_force_and_fully_paid_up", thresholdPctOfSurrenderValue: { bps: 9000 }, comparison: "strictly_greater" },
};

const facts = (over: Record<string, unknown> = {}, drop: string[] = []): ConfirmedFacts => {
  const out: any = {};
  for (const [k, val] of Object.entries({ ...VALUES, ...over })) if (!drop.includes(k)) out[k] = { value: val, revision: 1, state: "reviewed" };
  return out;
};

const FLAGS: ReviewFlag[] = [
  { id: "gsv_factor_rounding_not_stated", fieldKeys: ["surrender.gsv_factor_bands"], note: "", choices: ["exact_as_printed", "whole_percent_as_in_illustration"], blocksCalculation: true },
  { id: "survival_benefit_deduction_timing", fieldKeys: ["surrender.gsv_formula"], note: "", choices: ["payouts_made_by_surrender_date", "payouts_for_completed_policy_years"], blocksCalculation: true },
  { id: "ssv_needs_current_rate", fieldKeys: ["surrender.ssv_discount_rule"], note: "", choices: [], blocksCalculation: true },
];
const DECIDED = { gsv_factor_rounding_not_stated: "exact_as_printed", survival_benefit_deduction_timing: "payouts_for_completed_policy_years" } as const;

const rec = (id: string, extra: Record<string, unknown>) => ({
  id, enteredOn: "2026-09-30", origin: "agent_entered", confirmation: "insurer_document", reference: null, note: null, supersedes: null, voided: false, ...extra,
});
const paidTo = (date: string) => ({ schema: 1, quotes: [rec("pt", { kind: "quote", quoteType: "premiums_paid_to", amount: null, status: null, paidTo: date, quoteDate: date })] });

const run = (asOf: string, evidence: unknown, f = facts(), decisions: Record<string, string> = DECIDED) =>
  documentValues({ facts: f, flags: FLAGS, flagDecisions: decisions as any, evidence, asOf });

describe("GSV factor by policy year (15-year term)", () => {
  const f = (y: number) => gsvFactorForYear(BANDS as any, y, 15);
  test("flat bands", () => {
    assert.ok(eqR(f(2)!, rat(3, 10)));
    assert.ok(eqR(f(3)!, rat(7, 20)));
    assert.ok(eqR(f(4)!, rat(1, 2)));
    assert.ok(eqR(f(7)!, rat(1, 2)));
  });
  test("year 8 is exactly 0.5 + 0.4/7 and year 13 exactly 0.5 + 2.4/7", () => {
    assert.ok(eqR(f(8)!, add(rat(1, 2), rat(2, 35))));
    assert.ok(eqR(f(13)!, add(rat(1, 2), rat(12, 35))));
  });
  test("years 14 and 15 are 0.9", () => {
    assert.ok(eqR(f(14)!, rat(9, 10)));
    assert.ok(eqR(f(15)!, rat(9, 10)));
  });
  test("no extrapolation outside the contract's bands", () => {
    assert.equal(f(1), null);
    assert.equal(f(16), null);
    assert.equal(f(0), null);
  });
  test("a term too short for the table makes bands overlap: refused, not picked", () => {
    // Term 8: year 7 is in "4 to 7" and in "(term less 1) to term" = 7 to 8.
    assert.equal(gsvFactorForYear(BANDS as any, 7, 8), null);
  });
  test("the ramp's own denominator at zero is refused (formula level)", () => {
    // Force the ramp band to cover year 8 of an 8-year term: (8 - 8) in the denominator.
    const forced = [{ from: 8, to: 8, factor: (BANDS[3] as any).factor, raw: "ramp" }];
    assert.equal(gsvFactorForYear(forced as any, 8, 8), null);
  });
});

describe("GSV from reviewed rules and recorded premiums", () => {
  test("zero or one year's premium recorded: not acquired", () => {
    // Only the first premium (paid at issue) is accounted for; the second due 2025-03-04 has no record.
    const r = run("2025-06-01", { schema: 1 });
    assert.equal(r.gsv.amount, null);
    assert.ok(r.gsv.missing.includes("payment_records_incomplete"));
    // With the first year only, as of a date before the second due date: acquisition not met.
    const one = run("2025-02-01", { schema: 1 });
    assert.equal(one.gsv.amount?.paise, 0);
    assert.ok(one.gsv.conditions.includes("gsv_not_acquired"));
  });

  test("two years' premiums recorded, policy year 2: 30% x 4,00,000 - one completed year of payouts", () => {
    // As of 2025-06-01: policy year 2 (one anniversary passed on 2025-03-04). Premiums paid 2 x 2,00,000.
    // Completed policy years: 1 -> payouts dated 2024-04-04 .. 2025-03-04 = 12 x 3,380 = 40,560.
    // GSV = 0.3 x 4,00,000 - 40,560 = 1,20,000 - 40,560 = 79,440.
    const r = run("2025-06-01", paidTo("2025-03-04"));
    assert.equal(r.gsv.amount?.paise, 7944000);
    assert.equal(r.gsv.scope, "gsv_only_not_surrender_value");
  });

  test("policy year 8, exact factor: 39/70 x 14,00,000 - 7 years of payouts", () => {
    // As of 2031-06-01: year 8 (7 anniversaries). All 7 premiums recorded = 14,00,000.
    // Factor 39/70: 39/70 x 14,00,000 = 7,80,000. Payouts for 7 completed years: 84 x 3,380 = 2,83,920.
    // GSV = 7,80,000 - 2,83,920 = 4,96,080.
    const r = run("2031-06-01", paidTo("2030-03-04"));
    assert.equal(r.gsv.amount?.paise, 49608000);
  });

  test("policy year 8 with whole-percent rounding chosen: 56% -> 5,00,080 (matches the printed illustration)", () => {
    // 39/70 = 55.714...% -> 56%. 0.56 x 14,00,000 = 7,84,000 - 2,83,920 = 5,00,080.
    const r = run("2031-06-01", paidTo("2030-03-04"), facts(), { ...DECIDED, gsv_factor_rounding_not_stated: "whole_percent_as_in_illustration" });
    assert.equal(r.gsv.amount?.paise, 50008000);
  });

  test("policy year 13, exact factor: (0.5 + 2.4/7) x 14,00,000 - 12 years of payouts", () => {
    // 59/70 x 14,00,000 = 11,80,000. Payouts 144 x 3,380 = 4,86,720. GSV = 6,93,280.
    const r = run("2036-06-01", paidTo("2030-03-04"));
    assert.equal(r.gsv.amount?.paise, 69328000);
  });

  test("policy year 3 and 4 and 7", () => {
    // Year 3 (2026-06-01): 0.35 x 6,00,000 - 24 x 3,380 = 2,10,000 - 81,120 = 1,28,880
    assert.equal(run("2026-06-01", paidTo("2026-03-04")).gsv.amount?.paise, 12888000);
    // Year 4 (2027-06-01): 0.5 x 8,00,000 - 36 x 3,380 = 4,00,000 - 1,21,680 = 2,78,320
    assert.equal(run("2027-06-01", paidTo("2027-03-04")).gsv.amount?.paise, 27832000);
    // Year 7 (2030-06-01): 0.5 x 14,00,000 - 72 x 3,380 = 7,00,000 - 2,43,360 = 4,56,640
    assert.equal(run("2030-06-01", paidTo("2030-03-04")).gsv.amount?.paise, 45664000);
  });

  test("years 14 and 15 use 90%", () => {
    // Year 14 (2037-06-01): 0.9 x 14,00,000 - 156 x 3,380 = 12,60,000 - 5,27,280 = 7,32,720
    assert.equal(run("2037-06-01", paidTo("2030-03-04")).gsv.amount?.paise, 73272000);
    // Year 15 (2038-06-01): 0.9 x 14,00,000 - 168 x 3,380 = 12,60,000 - 5,67,840 = 6,92,160
    assert.equal(run("2038-06-01", paidTo("2030-03-04")).gsv.amount?.paise, 69216000);
  });

  test("payouts counted by surrender date instead: every monthly payout dated on or before it", () => {
    // As of 2025-06-01: payouts 2024-04-04 .. 2025-05-04 = 14 x 3,380 = 47,320. GSV = 1,20,000 - 47,320 = 72,680.
    const r = run("2025-06-01", paidTo("2025-03-04"), facts(), { ...DECIDED, survival_benefit_deduction_timing: "payouts_made_by_surrender_date" });
    assert.equal(r.gsv.amount?.paise, 7268000);
  });

  test("deductions above the factor value floor at zero", () => {
    // Monthly payout raised to 30,000 (synthetic): year 2 deduction 12 x 30,000 = 3,60,000 > 1,20,000 -> 0.
    const r = run("2025-06-01", paidTo("2025-03-04"), facts({ "benefits.survival_recurring": { amount: { paise: 3000000 }, frequency: "monthly", from: "2024-04-04", to: "2039-03-04" } }));
    assert.equal(r.gsv.amount?.paise, 0);
  });

  test("GSV is never presented as the surrender value", () => {
    const r = run("2031-06-01", paidTo("2030-03-04"));
    assert.equal(r.surrender_value.amount, null);
    assert.ok(r.surrender_value.missing.includes("ssv_needs_current_rate"));
    assert.ok(r.gsv.conditions.includes("surrender_value_is_higher_of_gsv_and_ssv"));
  });
});

describe("gating", () => {
  test("an unresolved rounding flag blocks the GSV", () => {
    const r = run("2031-06-01", paidTo("2030-03-04"), facts(), { survival_benefit_deduction_timing: "payouts_for_completed_policy_years" });
    assert.equal(r.gsv.amount, null);
    assert.ok(r.gsv.missing.includes("flag_unresolved:gsv_factor_rounding_not_stated"));
  });
  test("confirming the formula alone does not unlock GSV", () => {
    const only: any = { "surrender.gsv_formula": { value: GSV_FORMULA, revision: 1, state: "reviewed" } };
    const r = run("2031-06-01", paidTo("2030-03-04"), only);
    assert.equal(r.gsv.amount, null);
    assert.ok(r.gsv.missing.some((m) => m.startsWith("fact_not_confirmed:")));
  });
  test("deferral selected (or unknown) refuses the deduction, so no GSV", () => {
    assert.equal(run("2031-06-01", paidTo("2030-03-04"), facts({ "schedule.deferral_selected": true })).gsv.amount, null);
    assert.equal(run("2031-06-01", paidTo("2030-03-04"), facts({}, ["schedule.deferral_selected"])).gsv.amount, null);
  });
  test("a due-date schedule that does not end on the printed final due date is refused", () => {
    const r = run("2031-06-01", paidTo("2030-03-04"), facts({ "schedule.final_premium_due_date": "2031-03-04" }));
    assert.equal(r.gsv.amount, null);
    assert.ok(r.gsv.missing.includes("schedule_inconsistent"));
  });
  test("a missing record is not an unpaid premium, and not a paid one", () => {
    const r = run("2031-06-01", { schema: 1 });
    assert.equal(r.gsv.amount, null);
    assert.ok(r.gsv.missing.includes("payment_records_incomplete"));
  });
});

describe("paid-up payouts (conditional)", () => {
  test("payout x premiums paid / premiums payable, counted in instalments", () => {
    // 3 of 7 annual premiums recorded (to 2026-03-04). Monthly 3,380 x 3/7 = 1,448.57 (floored to paise 1,448.57);
    // final 14,00,000 x 3/7 = 6,00,000.
    const r = run("2026-06-01", paidTo("2026-03-04"));
    assert.equal(r.paid_up_payouts.amounts?.recurring?.paise, 144857);
    assert.equal(r.paid_up_payouts.amounts?.terminal?.paise, 60000000);
    assert.equal(r.paid_up_payouts.scope, "conditional_if_policy_becomes_paid_up");
  });
  test("before GSV is acquired, stopping premiums lapses the policy: no payouts", () => {
    const r = run("2025-02-01", { schema: 1 });
    assert.ok(r.paid_up_payouts.conditions.includes("would_lapse_no_benefits"));
    assert.equal(r.paid_up_payouts.amounts, null);
  });
});

describe("grace and revival", () => {
  test("annual frequency: 30 days from both the schedule and the general clause", () => {
    const r = run("2026-06-01", paidTo("2026-03-04"));
    assert.equal(r.grace.days, 30);
  });
  test("schedule and clause disagreeing is a conflict", () => {
    const r = run("2026-06-01", paidTo("2026-03-04"), facts({ "schedule.grace_days": 15 }));
    assert.equal(r.grace.days, null);
    assert.ok(r.grace.missing.includes("grace_schedule_and_clause_disagree"));
  });
  test("no revival date without insurer evidence that the policy lapsed or went paid-up", () => {
    const r = run("2028-06-01", paidTo("2026-03-04"));
    assert.equal(r.revival.applyBy, null);
    assert.ok(r.revival.missing.includes("status_not_evidenced"));
  });
  test("with an insurer status of lapsed: five years from the first unpaid due date, never past the term", () => {
    const status = rec("s", { kind: "quote", quoteType: "policy_status", amount: null, status: "paid_up", paidTo: null, quoteDate: "2027-05-01" });
    const ev = { schema: 1, quotes: [paidTo("2026-03-04").quotes[0], status] };
    // First unpaid due date: 2027-03-04. Five years later: 2032-03-04, before the 2039 end.
    const r = run("2027-06-01", ev);
    assert.equal(r.revival.applyBy, "2032-03-04");
    assert.ok(r.revival.conditions.includes("subject_to_insurer_terms_and_insurability"));
  });
  test("the window stops at the end of the policy term", () => {
    const status = rec("s", { kind: "quote", quoteType: "policy_status", amount: null, status: "paid_up", paidTo: null, quoteDate: "2030-05-01" });
    const ev = { schema: 1, quotes: [paidTo("2029-03-04").quotes[0], status] };
    const r = run("2030-06-01", ev, facts({ "schedule.policy_end_date": "2033-03-04", "schedule.policy_term_years": 9, "schedule.final_premium_due_date": "2030-03-04" }));
    // First unpaid 2030-03-04 + 5 = 2035-03-04, after the 2033-03-04 end: capped.
    assert.equal(r.revival.applyBy, "2033-03-04");
  });
});

describe("loans", () => {
  test("foreclosure only when loan plus interest is strictly more than 90%, and never for exempt statuses", () => {
    const rule = { appliesTo: "other_than_in_force_and_fully_paid_up", thresholdPctOfSurrenderValue: { bps: 9000 }, comparison: "strictly_greater" } as const;
    // Surrender value 1,00,000: 90% = 90,000.
    assert.equal(foreclosureApplies(rule, { paise: 9000000 }, { paise: 10000000 }, "reduced_paid_up"), "no");
    assert.equal(foreclosureApplies(rule, { paise: 9000001 }, { paise: 10000000 }, "reduced_paid_up"), "yes");
    assert.equal(foreclosureApplies(rule, { paise: 9900000 }, { paise: 10000000 }, "in_force"), "exempt");
    assert.equal(foreclosureApplies(rule, { paise: 9900000 }, { paise: 10000000 }, "fully_paid_up"), "exempt");
    assert.equal(foreclosureApplies(rule, { paise: 9900000 }, { paise: 10000000 }, "unknown"), "status_unknown");
  });
  test("the loan limit is unavailable while the surrender value is", () => {
    const r = run("2031-06-01", paidTo("2030-03-04"));
    assert.equal(r.loan_limit.amount, null);
    assert.ok(r.loan_limit.missing.includes("needs_surrender_value"));
  });
});

describe("rates from rules (only with a current input someone supplies)", () => {
  const ssvRule = { base: "annualized_yield_reference_gsec", roundUpBps: 25, roundBeforeSpread: false, spread: { bps: 150 }, reviewDayMonth: [] } as const;
  const loanRule = { base: "average_annualized_10y_gsec_6_months", roundUpBps: 50, roundBeforeSpread: true, spread: { bps: 200 }, reviewDayMonth: [] } as const;
  const generalRule = { ...ssvRule, spread: { bps: 100 } };
  test("SSV: yield + 150 bps, rounded up to 25", () => {
    // 6.81% + 1.50% = 8.31% -> 8.50%
    assert.equal(ssvDiscountRateBps(ssvRule, 681), 850);
    // 6.75% + 1.50% = 8.25% stays 8.25%
    assert.equal(ssvDiscountRateBps(ssvRule, 675), 825);
  });
  test("the general discount rule uses +100 bps, kept separate", () => {
    assert.equal(ssvDiscountRateBps(generalRule, 681), 800); // 7.81% -> 8.00%
  });
  test("loan: average rounded up to 50 bps first, then + 2%", () => {
    // 6.81% -> 7.00% + 2% = 9.00%
    assert.equal(loanRateBps(loanRule, 681), 900);
    assert.equal(loanRateBps(loanRule, 700), 900);
  });
  test("reference bond: 10-year up to a 20-year term, 30-year above", () => {
    const t = { upToTermYears: 20, tenorUpTo: 10, tenorAbove: 30 };
    assert.equal(referenceTenorYears(t, 20), 10);
    assert.equal(referenceTenorYears(t, 21), 30);
  });
});
