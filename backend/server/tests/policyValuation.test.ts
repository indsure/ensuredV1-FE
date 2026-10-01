/**
 * Policy valuation: what may be shown as money, and on what basis.
 *
 * NO NETWORK, NO DB, NO MODEL CALL. Every policy and every rule set here is
 * SYNTHETIC. "Example Life" and UIN "999N000V01" are not a real insurer or
 * product, and passing these tests says nothing about what any insurer would
 * pay. They prove the engine applies its own stated formula, refuses to show
 * cash without evidence, and never fills a gap with a default.
 *
 * Expected amounts are worked out by hand in the comment beside each one.
 *
 * Run:  npx tsx --test backend/server/tests/policyValuation.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { valuePolicy, DECISION_FIELDS, type PolicyValuation } from "../../../frontend/client/src/lib/policyValue";
import type { RuleSet } from "../../../frontend/client/src/lib/productRules";

const AS_OF = "2026-10-01";

/** Synthetic rule set. GSV on premiums paid, SSV on paid-up basic sum assured plus vested bonus. */
const RULES: RuleSet = {
  schema: 1,
  id: "synthetic-endowment",
  insurer: "Example Life",
  uin: "999N000V01",
  shape: "endowment",
  surrender: {
    acquiredAfterYears: 2,
    gsv: {
      base: "premiums_paid_excluding_taxes_riders_extras",
      factors: [
        { fromYear: 1, toYear: 1, pct: 0 },
        { fromYear: 2, toYear: 8, pct: 50 },
        { fromYear: 9, toYear: 9, pct: 57 },
        { fromYear: 10, toYear: 10, pct: 60 },
        { fromYear: 11, toYear: 20, pct: 70 },
      ],
      interpolation: null,
      deductSurvivalBenefitsPaid: false,
    },
    ssv: {
      method: "factor_table",
      base: "paid_up_basic_sum_assured_plus_vested_bonus",
      factors: [
        { fromYear: 1, toYear: 1, pct: 0 },
        { fromYear: 2, toYear: 8, pct: 50 },
        { fromYear: 9, toYear: 9, pct: 57 },
        { fromYear: 10, toYear: 10, pct: 61 },
        { fromYear: 11, toYear: 20, pct: 70 },
      ],
      interpolation: null,
    },
    selection: "higher_of_gsv_ssv",
  },
  loan: { eligibleAfterYears: 3, maxPctOfSurrenderValue: 80, deductExistingLoan: true },
  citations: [{ supports: "all", document: "synthetic test fixture" }],
  review: { status: "verified", by: "test", on: "2026-10-01" },
};

const base = (over: Record<string, any> = {}): Record<string, any> => ({
  insurer: "Example Life",
  uin: "999N000V01",
  plan_type: "Endowment",
  plan_name: "Synthetic Savings Plan",
  premium: 50000,
  premium_frequency: "Annual",
  premium_excluding_taxes: 50000,
  policy_term_years: 20,
  premium_paying_term_years: 20,
  start_date: "2018-03-15",
  basic_sum_assured: 1000000,
  // Death cover differs from basic sum assured on purpose: it must never be used as a base.
  sum_assured: 1250000,
  maturity_amount: 1000000,
  vested_bonus: 0,
  vested_bonus_as_on: "2026-03-31",
  ...over,
});

/** The advisor's "I checked these against the document" snapshot, of whatever is on file. */
const checkOf = (d: Record<string, any>) => {
  const fields: Record<string, any> = {};
  for (const k of DECISION_FIELDS) if (d[k] !== undefined) fields[k] = d[k];
  return { checkedOn: "2026-09-30", fields };
};

const rec = (id: string, extra: Record<string, any>) => ({
  id, enteredOn: "2026-09-30", origin: "agent_entered", confirmation: "insurer_document",
  reference: null, note: null, supersedes: null, voided: false, ...extra,
});
const paidTo = (date: string) => rec("q-paid", { kind: "quote", quoteType: "premiums_paid_to", amount: null, status: null, paidTo: date, quoteDate: "2026-09-30" });
const noLoan = rec("l-none", { kind: "loan", status: "none", principal: 0, interest: 0, asOf: "2026-09-30" });
const loanOf = (principal: number, interest: number | null) =>
  rec("l-1", { kind: "loan", status: "outstanding", principal, interest, asOf: "2026-09-30" });

/** A fully evidenced policy: checked inputs, premiums paid to the last due date, loan position set. */
function evidenced(over: Record<string, any> = {}, ev: Record<string, any> = {}): Record<string, any> {
  const d = base(over);
  return {
    ...d,
    value_evidence: {
      schema: 1, payments: [], loans: [noLoan], quotes: [paidTo("2026-03-15")],
      inputCheck: checkOf(d), rules: null, shape: null, ...ev,
    },
  };
}

const run = (d: Record<string, any>, sets: RuleSet[] = [RULES], asOf = AS_OF): PolicyValuation =>
  valuePolicy("life", d, { asOf, ruleSets: sets });

describe("document calculation, all evidence present", () => {
  test("gross surrender value from the rules", () => {
    const v = run(evidenced());
    // Year 9 (8 anniversaries passed). 9 premiums paid.
    // GSV = 57% x 50,000 x 9 = 2,56,500. SSV = 57% x (10,00,000 x 9/20 + 0) = 2,56,500. Higher = 2,56,500.
    assert.equal(v.policyYear, 9);
    assert.equal(v.values.surrender_gross.amount, 256500);
    assert.equal(v.values.surrender_gross.basis, "document_calculation");
    assert.equal(v.values.surrender_payable.amount, 256500);
    assert.equal(v.cash.surrender, "calculated");
    // Loan limit 80% of 2,56,500 = 2,05,200, nothing drawn.
    assert.equal(v.values.loan_remaining.amount, 205200);
  });

  test("the death cover is never used as the paid-up base", () => {
    const v = run(evidenced({ sum_assured: 9999999 }));
    assert.equal(v.values.surrender_gross.amount, 256500);
  });

  test("without the basic sum assured the SSV, and so the higher-of, is unavailable", () => {
    const v = run(evidenced({ basic_sum_assured: null }));
    assert.equal(v.values.surrender_payable.amount, null);
    assert.ok(v.values.surrender_payable.missing.includes("basic_sum_assured_missing"));
  });
});

describe("loans and net proceeds (audit P2)", () => {
  test("principal 2,00,000 and confirmed interest 0: net 56,500, can still borrow 5,200", () => {
    const v = run(evidenced({}, { loans: [loanOf(200000, 0)] }));
    assert.equal(v.values.surrender_gross.amount, 256500);
    // 2,56,500 - 2,00,000 - 0 = 56,500
    assert.equal(v.values.surrender_payable.amount, 56500);
    // 80% x 2,56,500 = 2,05,200; minus 2,00,000 = 5,200
    assert.equal(v.values.loan_remaining.amount, 5200);
  });

  test("interest unknown: no exact net, only a labelled upper bound outside cash", () => {
    const v = run(evidenced({}, { loans: [loanOf(200000, null)] }));
    assert.equal(v.values.surrender_payable.amount, null);
    assert.equal(v.values.surrender_payable.upperBound, 56500);
    assert.ok(v.values.surrender_payable.missing.includes("loan_interest_unknown"));
    assert.equal(v.cash.surrender, null);
    assert.equal(v.values.loan_remaining.amount, null);
  });

  test("no loan record at all is unknown, not zero", () => {
    const v = run(evidenced({}, { loans: [] }));
    assert.equal(v.values.surrender_gross.amount, 256500);
    assert.equal(v.values.surrender_payable.amount, null);
    assert.ok(v.values.surrender_payable.missing.includes("loan_position_unknown"));
    assert.equal(v.cash.surrender, null);
  });

  test("deductions above the value: zero payable and a separate shortfall, no debt claimed", () => {
    // 2,56,500 - 2,50,000 - 20,000 = -13,500
    const v = run(evidenced({}, { loans: [loanOf(250000, 20000)] }));
    assert.equal(v.values.surrender_payable.amount, 0);
    assert.equal(v.values.surrender_payable.shortfall, 13500);
    assert.ok(v.values.surrender_payable.conditions.includes("deductions_exceed_value"));
    // 2,05,200 - 2,70,000 < 0, so nothing left to borrow
    assert.equal(v.values.loan_remaining.amount, 0);
  });

  test("the old card's loan box is an unconfirmed principal with unknown interest", () => {
    const d = evidenced({ policy_parameters: { outstandingLoan: { value: 200000, source: "entered" } } }, { loans: [] });
    const v = run(d);
    assert.equal(v.loan.state, "outstanding");
    assert.equal(v.loan.interest, null);
    assert.equal(v.values.surrender_payable.amount, null);
  });
});

describe("next anniversary (audit P1)", () => {
  test("2,56,500 now, 3,05,000 next, 50,000 premium to pay: the difference is -1,500", () => {
    const v = run(evidenced());
    const c = v.nextAnniversary;
    assert.equal(c.available, true);
    assert.equal(c.nextAnniversary, "2027-03-15");
    // Due on the anniversary itself: one instalment of 50,000.
    assert.equal(c.requiredInstalments, 1);
    assert.equal(c.requiredPremiums, 50000);
    // Year 10, 10 paid: GSV 60% x 5,00,000 = 3,00,000; SSV 61% x 5,00,000 = 3,05,000.
    assert.equal(c.nextNet, 305000);
    // 3,05,000 + 0 - 2,56,500 - 50,000 = -1,500
    assert.equal(c.difference, -1500);
  });

  test("quarterly premiums: every instalment before the anniversary is counted once", () => {
    const d = evidenced(
      { premium: 12500, premium_excluding_taxes: 12500, premium_frequency: "Quarterly" },
      { quotes: [paidTo("2026-09-15")] }
    );
    const v = run(d);
    // Quarterly from 2018-03-15: 35 instalments due by 2026-09-15.
    // GSV 57% x 12,500 x 35 = 2,49,375. SSV 57% x (10,00,000 x 35/80) = 2,49,375.
    assert.equal(v.values.surrender_payable.amount, 249375);
    const c = v.nextAnniversary;
    // Due 2026-12-15 and 2027-03-15: 2 x 12,500 = 25,000.
    assert.equal(c.requiredInstalments, 2);
    assert.equal(c.requiredPremiums, 25000);
    // 37 paid: GSV 60% x 4,62,500 = 2,77,500; SSV 61% x (10,00,000 x 37/80) = 2,82,125.
    assert.equal(c.nextNet, 282125);
    // 2,82,125 - 2,49,375 - 25,000 = 7,750
    assert.equal(c.difference, 7750);
  });

  test("limited pay finished: no premium is required, so only the factor moves", () => {
    const rules: RuleSet = { ...RULES, id: "lp", surrender: { ...RULES.surrender!, ssv: null, selection: "gsv_only" } };
    const d = evidenced({ policy_term_years: 15, premium_paying_term_years: 7, maturity_amount: 500000 }, { quotes: [paidTo("2024-03-15")] });
    const v = run(d, [rules]);
    // 7 premiums. Now: 57% x 3,50,000 = 1,99,500. Next: 60% x 3,50,000 = 2,10,000.
    assert.equal(v.values.surrender_payable.amount, 199500);
    assert.equal(v.nextAnniversary.requiredPremiums, 0);
    assert.equal(v.nextAnniversary.difference, 10500);
  });

  test("a survival payout before the anniversary is counted, and deducted where the rules say so", () => {
    const mb: RuleSet = {
      ...RULES, id: "mb", shape: "money_back",
      surrender: { ...RULES.surrender!, gsv: { ...RULES.surrender!.gsv!, deductSurvivalBenefitsPaid: true }, ssv: null, selection: "gsv_only" },
    };
    const d = evidenced({
      plan_type: "Money back", payout_amount: 10000, payout_frequency: "Yearly",
      payout_start_date: "2020-03-15", payout_end_date: "2032-03-15",
    });
    const v = run(d, [mb]);
    // Paid out by today: 2020..2026 = 7 x 10,000 = 70,000. Now: 57% x 4,50,000 - 70,000 = 1,86,500.
    assert.equal(v.values.surrender_payable.amount, 186500);
    const c = v.nextAnniversary;
    // Next: 60% x 5,00,000 - 80,000 = 2,20,000. Payout between: 10,000. Premium: 50,000.
    assert.equal(c.nextNet, 220000);
    assert.equal(c.payoutsBetween, 10000);
    // 2,20,000 + 10,000 - 1,86,500 - 50,000 = -6,500
    assert.equal(c.difference, -6500);
  });

  test("unknown premium schedule: no comparison and no calculation", () => {
    const v = run(evidenced({ premium_frequency: null }));
    assert.equal(v.nextAnniversary.available, false);
    assert.equal(v.values.surrender_payable.amount, null);
  });

  test("an outstanding loan switches the comparison off rather than guessing interest", () => {
    const v = run(evidenced({}, { loans: [loanOf(100000, 0)] }));
    assert.equal(v.nextAnniversary.available, false);
    assert.ok(v.nextAnniversary.reasons.includes("loan_outstanding_comparison_off"));
  });
});

describe("payment status is evidence, not the age of a date (audit P4, P5)", () => {
  test("nothing recorded and a due date passed: 'date passed', never lapsed", () => {
    const v = run(base());
    assert.equal(v.payment.state, "date_passed");
    assert.equal(v.payment.lastDuePassed, "2026-03-15");
    assert.equal(v.payment.upToDate, false);
    assert.equal(v.values.surrender_payable.amount, null);
  });

  test("a legacy future next_premium_date does not prove anything was paid", () => {
    const v = run(base({ next_premium_date: "2027-03-15" }));
    assert.equal(v.payment.state, "date_passed");
    assert.equal(v.payment.upToDate, false);
  });

  test("records with a gap", () => {
    const pays = ["2019", "2020", "2021", "2022", "2023", "2024", "2025"].map((y) =>
      rec("p" + y, { kind: "payment", amount: 50000, currency: "INR", dueDate: `${y}-03-15`, paidOn: `${y}-03-10` }));
    const d = base();
    const v = run({ ...d, value_evidence: { schema: 1, payments: pays, loans: [noLoan], quotes: [], inputCheck: checkOf(d), rules: null, shape: null } });
    assert.equal(v.payment.state, "recorded_gap");
    assert.equal(v.payment.firstUncoveredDue, "2026-03-15");
    assert.equal(v.values.surrender_payable.amount, null);
  });

  test("a self-reported payment record is labelled as such", () => {
    const pays = ["2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026"].map((y) =>
      rec("p" + y, { kind: "payment", amount: 50000, currency: "INR", dueDate: `${y}-03-15`, paidOn: `${y}-03-10`, confirmation: "self_reported" }));
    const d = base();
    const v = run({ ...d, value_evidence: { schema: 1, payments: pays, loans: [noLoan], quotes: [], inputCheck: checkOf(d), rules: null, shape: null } });
    assert.equal(v.payment.state, "recorded_up_to_date");
    assert.equal(v.payment.confirmation, "self_reported");
    assert.ok(v.values.surrender_payable.conditions.includes("payments_self_reported"));
    assert.equal(v.values.surrender_payable.amount, 256500);
  });

  test("an insurer status older than a later due date is not the newest evidence", () => {
    const status = rec("s1", { kind: "quote", quoteType: "policy_status", amount: null, status: "in_force", paidTo: null, quoteDate: "2025-01-01" });
    const v = run({ ...base(), value_evidence: { schema: 1, payments: [], loans: [], quotes: [status] } });
    assert.notEqual(v.payment.state, "insurer_status");
    assert.ok(v.payment.reasons.includes("status_older_than_due"));
  });

  test("a premium paying term that has ended does not prove old arrears were paid", () => {
    const d = base({ policy_term_years: 15, premium_paying_term_years: 7 });
    const v = run({ ...d, value_evidence: { schema: 1, payments: [], loans: [noLoan], quotes: [paidTo("2021-03-15")], inputCheck: checkOf(d) } });
    assert.equal(v.payment.state, "recorded_gap");
    assert.equal(v.payment.firstUncoveredDue, "2022-03-15");
  });

  test("16 days past a due date is still just 'date passed': no grace period is assumed", () => {
    const v = run(base({ start_date: "2018-09-15" }), [RULES], "2026-10-01");
    assert.equal(v.payment.state, "date_passed");
    assert.equal(v.payment.lastDuePassed, "2026-09-15");
  });
});

describe("no evidence, no cash", () => {
  test("a complete-looking policy with nothing checked shows no surrender or loan figure", () => {
    const v = run(base(), []);
    assert.equal(v.values.surrender_payable.amount, null);
    assert.equal(v.values.surrender_gross.amount, null);
    assert.equal(v.values.loan_remaining.amount, null);
    assert.ok(v.values.surrender_payable.missing.includes("no_verified_rules"));
    assert.equal(v.cash.surrender, null);
  });

  test("details changed after the check void it", () => {
    const d = evidenced();
    d.premium = 51000;
    const v = run(d);
    assert.equal(v.inputsChecked, false);
    assert.ok(v.values.surrender_payable.missing.includes("inputs_changed_since_check"));
  });

  test("a rule set for another UIN is not used", () => {
    const v = run(evidenced({ uin: "999N000V02" }));
    assert.equal(v.rules.verified, null);
    assert.equal(v.values.surrender_payable.amount, null);
  });

  test("an advisor-entered table gives an estimate only, even if it claims to be verified", () => {
    const d = base();
    const v = run({ ...d, value_evidence: { schema: 1, rules: { ...RULES, review: { status: "verified" } } } }, []);
    assert.equal(v.rules.entered?.review.status, "agent_entered");
    assert.equal(v.values.surrender_estimate.basis, "estimate");
    // Assumes every scheduled premium (9) paid: 2,56,500, as an estimate.
    assert.equal(v.values.surrender_estimate.amount, 256500);
    assert.ok(v.values.surrender_estimate.conditions.includes("assumes_scheduled_premiums_paid"));
    assert.equal(v.values.surrender_payable.amount, null);
    assert.equal(v.cash.surrender, null);
  });

  test("a malformed factor table is a reason on this policy, not a crash", () => {
    const v = run({ ...base(), value_evidence: { schema: 1, rules: { ...RULES, surrender: { ...RULES.surrender, gsv: { ...RULES.surrender!.gsv, factors: 30 } } } } });
    assert.ok(v.evidenceIssues.includes("rules_invalid"));
    assert.equal(v.values.surrender_estimate.amount, null);
  });

  test("overlapping bands are refused", () => {
    const bad = { ...RULES, surrender: { ...RULES.surrender!, gsv: { ...RULES.surrender!.gsv!, factors: [{ fromYear: 1, toYear: 5, pct: 30 }, { fromYear: 5, toYear: 9, pct: 50 }] } } };
    const v = run({ ...base(), value_evidence: { schema: 1, rules: bad } });
    assert.ok(v.evidenceIssues.includes("rules_invalid"));
  });

  test("a year the table does not cover is unavailable, not interpolated", () => {
    const gap: RuleSet = { ...RULES, id: "gap", surrender: { ...RULES.surrender!, ssv: null, selection: "gsv_only",
      gsv: { ...RULES.surrender!.gsv!, factors: [{ fromYear: 1, toYear: 8, pct: 50 }, { fromYear: 12, toYear: 20, pct: 90 }] } } };
    const v = run(evidenced(), [gap]);
    assert.equal(v.values.surrender_payable.amount, null);
    assert.ok(v.values.surrender_payable.missing.includes("factor_missing_for_year"));
  });

  test("before the acquisition years the rules give a sourced zero", () => {
    const d = evidenced({ start_date: "2025-06-01" }, { quotes: [paidTo("2026-06-01")] });
    const v = run(d);
    assert.equal(v.values.surrender_gross.amount, 0);
    assert.ok(v.values.surrender_gross.conditions.includes("not_acquired_yet"));
  });
});

describe("maturity and bonuses (audit P7)", () => {
  test("money back with no maturity amount stays unavailable; death cover is not substituted", () => {
    const v = run(base({ plan_type: "Money back", maturity_amount: null, sum_assured: 2000000 }), []);
    assert.equal(v.values.maturity_guaranteed.amount, null);
    assert.ok(v.values.maturity_guaranteed.missing.includes("maturity_not_read"));
  });

  test("a stated maturity amount is a stated value, not a guarantee of cash", () => {
    const v = run(base(), []);
    assert.equal(v.values.maturity_guaranteed.amount, 1000000);
    assert.equal(v.values.maturity_guaranteed.basis, "stated_value");
    assert.equal(v.values.maturity_guaranteed.verification, "unchecked");
    assert.equal(v.values.maturity_guaranteed.asOf, "2038-03-15");
  });

  test("participating plan: future bonus is flagged as not guaranteed, never added", () => {
    const v = run(base({ vested_bonus: 120000, vested_bonus_as_on: "2026-03-31" }), []);
    assert.equal(v.values.vested_bonus.amount, 120000);
    assert.equal(v.values.vested_bonus.asOf, "2026-03-31");
    assert.equal(v.values.future_bonus.amount, null);
    assert.ok(v.values.future_bonus.conditions.includes("future_bonus_not_guaranteed"));
    assert.ok(v.values.maturity_guaranteed.conditions.includes("bonuses_not_included"));
    assert.equal(v.values.maturity_guaranteed.amount, 1000000);
  });

  test("a vested bonus with no date is not shown", () => {
    const v = run(base({ vested_bonus: 120000, vested_bonus_as_on: null }), []);
    assert.equal(v.values.vested_bonus.amount, null);
    assert.ok(v.values.vested_bonus.missing.includes("statement_date_missing"));
  });

  test("an insurer status of paid-up hides the full maturity figure", () => {
    const status = rec("s1", { kind: "quote", quoteType: "policy_status", amount: null, status: "paid_up", paidTo: null, quoteDate: "2026-09-01" });
    const v = run({ ...base(), value_evidence: { schema: 1, quotes: [status] } }, []);
    assert.equal(v.payment.state, "insurer_status");
    assert.equal(v.values.maturity_guaranteed.amount, null);
    assert.ok(v.values.maturity_guaranteed.missing.includes("reduced_after_lapse_ask_insurer"));
  });
});

describe("unit linked (audit P6)", () => {
  test("no statement: nothing at all, and no growth projection", () => {
    const v = run(base({ plan_type: "ULIP" }), []);
    assert.equal(v.shape.value, "unit_linked");
    assert.equal(v.values.surrender_payable.amount, null);
    assert.equal(v.values.fund_value.amount, null);
    assert.equal(v.cash.surrender, null);
  });

  test("a dated fund value is shown with its date and is not cash now", () => {
    const v = run(base({ plan_type: "ULIP", fund_value: 493900, fund_value_as_on: "2026-06-30" }), []);
    assert.equal(v.values.fund_value.amount, 493900);
    assert.equal(v.values.fund_value.asOf, "2026-06-30");
    assert.ok(v.values.fund_value.conditions.includes("fund_value_not_surrender_value"));
    assert.equal(v.values.surrender_payable.amount, null);
    assert.equal(v.cash.surrender, null);
  });

  test("a fund value with no date is not shown", () => {
    const v = run(base({ plan_type: "ULIP", fund_value: 493900, fund_value_as_on: null }), []);
    assert.equal(v.values.fund_value.amount, null);
  });
});

describe("plan type (audit P9)", () => {
  test("a sparse savings plan is unknown, not term cover", () => {
    const v = run(base({ plan_type: null, maturity_date: null, plan_name: "Jeevan Plan" }), []);
    assert.equal(v.shape.status, "unknown");
    assert.notEqual(v.values.surrender_payable.basis, "not_applicable");
    assert.ok(v.values.surrender_payable.missing.includes("shape_unknown"));
  });

  test("a plan name alone is a candidate for the advisor to confirm", () => {
    const v = run(base({ plan_type: null, plan_name: "Smart Money Back" }), []);
    assert.equal(v.shape.status, "candidate");
    assert.equal(v.shape.candidate, "money_back");
    assert.equal(v.shape.value, null);
  });

  test("explicit term cover is a supported no-surrender case", () => {
    const v = run(base({ plan_type: "Term" }), []);
    assert.equal(v.shape.value, "pure_term");
    assert.equal(v.values.surrender_payable.basis, "not_applicable");
    assert.equal(v.values.surrender_payable.amount, null);
  });

  test("pension, whole life and child plans are unsupported", () => {
    for (const plan_type of ["Pension plan", "Whole Life", "Child plan"]) {
      const v = run(base({ plan_type }), []);
      assert.equal(v.shape.status, "unsupported", plan_type);
      assert.equal(v.values.surrender_payable.basis, "unsupported");
    }
  });

  test("the advisor's choice wins and is shown as theirs", () => {
    const v = run({ ...base({ plan_type: null }), value_evidence: { schema: 1, shape: { value: "endowment", enteredOn: "2026-09-30" } } }, []);
    assert.equal(v.shape.status, "accepted");
    assert.equal(v.shape.source, "agent");
  });
});

describe("inputs (audit P8)", () => {
  test("'Rs. 50,000' is read as 50,000", () => {
    const v = run(evidenced({ premium: "Rs. 50,000", premium_excluding_taxes: "Rs. 50,000" }));
    assert.equal(v.values.surrender_gross.amount, 256500);
  });

  test("a premium outside the grammar is an input problem and blocks the calculation", () => {
    const v = run(evidenced({ premium: "approx 50k" }));
    assert.ok(v.inputIssues.some((i) => i.field === "premium"));
    assert.equal(v.values.surrender_payable.amount, null);
  });

  test("a maturity date that is not start + term is flagged as a conflict", () => {
    const v = run(base({ maturity_date: "2039-03-15" }), []);
    assert.ok(v.inputIssues.some((i) => i.reason === "dates_conflict"));
  });

  test("an ambiguous date is not guessed", () => {
    const v = run(base({ start_date: "03/04/2018" }), []);
    assert.ok(v.inputIssues.some((i) => i.field === "start_date"));
    assert.equal(v.policyYear, null);
  });

  test("an insurer quote is dated and labelled as entered by the advisor", () => {
    const q = rec("q1", { kind: "quote", quoteType: "surrender_payable", amount: 240000, status: null, paidTo: null, quoteDate: "2026-09-20", confirmation: "self_reported" });
    const v = run({ ...base(), value_evidence: { schema: 1, quotes: [q] } }, []);
    assert.equal(v.values.surrender_payable.amount, 240000);
    assert.equal(v.values.surrender_payable.basis, "insurer_quote");
    assert.equal(v.values.surrender_payable.asOf, "2026-09-20");
    assert.equal(v.values.surrender_payable.origin, "agent_entered");
    assert.equal(v.values.surrender_payable.verification, "self_reported");
    assert.equal(v.cash.surrender, "quote");
  });

  test("null data never throws", () => {
    assert.doesNotThrow(() => valuePolicy("life", null, { asOf: AS_OF }));
    assert.doesNotThrow(() => valuePolicy("life", { value_evidence: "garbage", premium: {}, start_date: 5 }, { asOf: AS_OF }));
  });
});
