/**
 * What can be worked out from a policy's own document rules, once an advisor
 * has reviewed them.
 *
 * Reviewed rules are necessary, never sufficient. Each result names the
 * reviewed fields and resolved review flags it depends on, and is computed
 * only when every one is confirmed. It also needs recorded evidence: premiums
 * actually paid, an insurer status, a loan balance. A missing record is never
 * read as "paid" or as "unpaid".
 *
 * What this can calculate:
 *   - GSV, labelled as GSV only: the surrender value is the HIGHER of GSV and
 *     SSV, and SSV needs today's rate, which no document carries.
 *   - Paid-up payouts, labelled as conditional on the policy going paid-up.
 *   - The grace period for the premium frequency.
 *   - The revival application window, only once the insurer's own status
 *     shows the policy lapsed or went paid-up.
 * What it never calculates: the surrender value, the loan limit or interest,
 * a revival amount, or any rate, unless the current rate input is supplied.
 *
 * Exact fractions throughout; money floored to the paisa, never rounded up.
 * Imports sibling pure modules only.
 */

import {
  add, cmp, div, evaluate, mul, rat, rationalToPaiseFloor, sub, type Expr, type Paise, type Rational,
} from "./exactMath";
import { addMonthsIso, anniversaryIso, compareIso, completedPolicyYears } from "./policyNumbers";
import { activePayments, latestQuote, readEvidence } from "./policyEvidence";
import type { FieldKey, GsvBand, RateRule, ReviewFlag } from "./policyDocTypes";

export interface ConfirmedFact {
  value: unknown;
  revision: number;
  state: "reviewed" | "corrected";
}
export type ConfirmedFacts = Partial<Record<FieldKey, ConfirmedFact>>;

export interface DocRulesInput {
  /** Only facts confirmed at their CURRENT revision. Pending or rejected ones are left out. */
  facts: ConfirmedFacts;
  flags: ReviewFlag[];
  /** The advisor's recorded choice for each flag that offers choices. */
  flagDecisions: Partial<Record<ReviewFlag["id"], string>>;
  evidence: unknown;
  asOf: string;
}

export type DocScope =
  | "gsv_only_not_surrender_value"
  | "conditional_if_policy_becomes_paid_up"
  | "surrender_value"
  | "loan_limit";

export interface DocResult {
  key: string;
  scope: DocScope | null;
  amount: Paise | null;
  /** For paid-up payouts: the reduced recurring and final payouts. */
  amounts?: { recurring: Paise | null; terminal: Paise | null } | null;
  basis: "document_reviewed_by_advisor" | "unavailable";
  dependsOn: FieldKey[];
  flagsUsed: { id: string; choice: string }[];
  missing: string[];
  conditions: string[];
  asOf: string;
}

const PER_YEAR: Record<string, number> = { annual: 1, half_yearly: 2, quarterly: 4, monthly: 12 };

function resolveYear(x: number | string, term: number): number {
  return x === "term" ? term : x === "term_minus_1" ? term - 1 : x === "term_minus_2" ? term - 2 : (x as number);
}

/** The factor for a policy year, or null when no band covers it (never extrapolated). */
export function gsvFactorForYear(bands: GsvBand[], year: number, term: number): Rational | null {
  if (!Number.isInteger(year) || year < 1 || year > term) return null;
  // Every band covering this year. More than one means the table does not fit
  // this term (e.g. an 8-year term puts year 7 in "4 to 7" and in "term less 1
  // to term"): refused rather than picking one.
  const hits = bands.filter((b) => {
    const from = resolveYear(b.from, term);
    const to = resolveYear(b.to, term);
    return from <= to && year >= from && year <= to;
  });
  if (hits.length !== 1) return null;
  const r = evaluate(hits[0].factor as Expr, { policy_year: rat(year), policy_term: rat(term) });
  if (!r.ok) return null;
  if (cmp(r.value, rat(0)) < 0 || cmp(r.value, rat(1)) > 0) return null;
  return r.value;
}

/** Rate rules, used only when someone supplies the current published yield. */
export function ssvDiscountRateBps(rule: RateRule, yieldBps: number): number {
  return rule.roundBeforeSpread
    ? Math.ceil(yieldBps / rule.roundUpBps) * rule.roundUpBps + rule.spread.bps
    : Math.ceil((yieldBps + rule.spread.bps) / rule.roundUpBps) * rule.roundUpBps;
}
export const loanRateBps = ssvDiscountRateBps;

export function referenceTenorYears(t: { upToTermYears: number; tenorUpTo: number; tenorAbove: number }, term: number): number {
  return term <= t.upToTermYears ? t.tenorUpTo : t.tenorAbove;
}

/**
 * Loan-value foreclosure test. "Exceeds" is strictly greater: exactly 90% does
 * not foreclose. In-force and fully paid-up policies are exempt on this ground;
 * a reduced paid-up policy is not fully paid-up; an unknown status is not guessed.
 */
export function foreclosureApplies(
  rule: { thresholdPctOfSurrenderValue: { bps: number } },
  loanPlusInterest: Paise, surrenderValue: Paise,
  status: "in_force" | "fully_paid_up" | "reduced_paid_up" | "unknown"
): "yes" | "no" | "exempt" | "status_unknown" {
  if (status === "unknown") return "status_unknown";
  if (status === "in_force" || status === "fully_paid_up") return "exempt";
  const lhs = BigInt(loanPlusInterest.paise) * BigInt(10000);
  const rhs = BigInt(surrenderValue.paise) * BigInt(rule.thresholdPctOfSurrenderValue.bps);
  return lhs > rhs ? "yes" : "no";
}

export function documentValues(input: DocRulesInput) {
  const { facts, flags, flagDecisions, asOf } = input;
  const { evidence } = readEvidence(input.evidence);
  const val = <T,>(k: FieldKey) => facts[k]?.value as T | undefined;

  const gate = (deps: FieldKey[], flagIds: ReviewFlag["id"][]) => {
    const missing: string[] = [];
    for (const k of deps) if (!facts[k]) missing.push(`fact_not_confirmed:${k}`);
    const used: { id: string; choice: string }[] = [];
    for (const id of flagIds) {
      const f = flags.find((x) => x.id === id);
      if (!f) continue;
      if (!f.choices.length) { if (f.blocksCalculation) missing.push(`flag_needs_insurer:${id}`); continue; }
      const c = flagDecisions[id];
      if (!c || !f.choices.includes(c)) missing.push(`flag_unresolved:${id}`);
      else used.push({ id, choice: c });
    }
    return { missing, used };
  };

  const base = (key: string, scope: DocScope | null, deps: FieldKey[]): DocResult => ({
    key, scope, amount: null, basis: "unavailable", dependsOn: deps, flagsUsed: [], missing: [], conditions: [], asOf,
  });

  /* ── Premium schedule, from the document's own anchor and printed final due date ── */
  const SCHED_DEPS: FieldKey[] = [
    "schedule.policy_term_years", "schedule.premium_paying_term_years", "schedule.frequency",
    "schedule.risk_commencement_date", "schedule.premium_due_day_month", "schedule.final_premium_due_date",
    "definitions.policy_anniversary_anchor",
  ];
  function schedule(): { dues: string[]; perYear: number; term: number; start: string } | { error: string } {
    const term = val<number>("schedule.policy_term_years");
    const ppt = val<number>("schedule.premium_paying_term_years");
    const freq = val<string>("schedule.frequency");
    const start = val<string>("schedule.risk_commencement_date");
    const dm = val<{ day: number; month: number }>("schedule.premium_due_day_month");
    const last = val<string>("schedule.final_premium_due_date");
    const anchor = val<string>("definitions.policy_anniversary_anchor");
    if (!term || !ppt || !freq || !start || !dm || !last || anchor !== "risk_commencement_date") return { error: "schedule_incomplete" };
    const perYear = PER_YEAR[freq];
    if (!perYear) return { error: "frequency_unsupported" };
    const [, m, d] = start.split("-").map(Number);
    if (m !== dm.month || d !== dm.day) return { error: "schedule_inconsistent" };
    const dues: string[] = [];
    for (let k = 0; k < ppt * perYear; k++) dues.push(addMonthsIso(start, (k * 12) / perYear));
    if (dues[dues.length - 1] !== last) return { error: "schedule_inconsistent" };
    return { dues, perYear, term, start };
  }

  /* ── Premiums accounted for by evidence (the first is paid at issue) ── */
  function premiumsPaid(dues: string[]) {
    const covered = new Set<string>([dues[0]]);
    for (const p of activePayments(evidence)) if (dues.includes(p.dueDate)) covered.add(p.dueDate);
    const pt = latestQuote(evidence, "premiums_paid_to");
    if (pt?.paidTo) for (const x of dues) if (compareIso(x, pt.paidTo) <= 0) covered.add(x);
    const dueNow = dues.filter((x) => compareIso(x, asOf) <= 0);
    const uncovered = dueNow.filter((x) => !covered.has(x));
    // Paid count is the unbroken run from the first premium: a later record after a gap does not make the gap paid.
    let run = 0;
    for (const x of dues) { if (covered.has(x)) run++; else break; }
    return { paidCount: Math.min(run, dues.length), dueNow: dueNow.length, upToDate: uncovered.length === 0, firstUnpaid: uncovered[0] ?? null };
  }

  /* ── GSV ── */
  const GSV_DEPS: FieldKey[] = [
    ...SCHED_DEPS, "surrender.gsv_formula", "surrender.gsv_factor_bands", "surrender.gsv_acquisition_min_premium_years",
    "schedule.instalment_premium_first_year", "schedule.instalment_premium_renewal", "schedule.extra_premium",
    "definitions.total_premiums_paid_excludes", "benefits.survival_recurring", "benefits.survival_terminal", "schedule.deferral_selected",
  ];
  const gsv = base("gsv", "gsv_only_not_surrender_value", GSV_DEPS);
  {
    const g = gate(GSV_DEPS, ["gsv_factor_rounding_not_stated", "survival_benefit_deduction_timing"]);
    gsv.missing.push(...g.missing);
    gsv.flagsUsed = g.used;
    if (!g.missing.length) {
      const s = schedule();
      if ("error" in s) gsv.missing.push(s.error);
      else if (val<boolean>("schedule.deferral_selected") !== false) gsv.missing.push("deferral_selected_or_unknown");
      else {
        const pay = premiumsPaid(s.dues);
        if (!pay.upToDate) gsv.missing.push("payment_records_incomplete");
        else {
          const minYears = val<number>("surrender.gsv_acquisition_min_premium_years")!;
          const completed = completedPolicyYears(s.start, asOf);
          const year = completed + 1;
          gsv.conditions.push("surrender_value_is_higher_of_gsv_and_ssv", "confirm_with_insurer");
          if (pay.paidCount < minYears * s.perYear) {
            gsv.amount = { paise: 0 };
            gsv.basis = "document_reviewed_by_advisor";
            gsv.conditions.push("gsv_not_acquired");
          } else if (year > s.term) {
            gsv.missing.push("policy_term_ended");
          } else {
            let factor = gsvFactorForYear(val<GsvBand[]>("surrender.gsv_factor_bands")!, year, s.term);
            if (!factor) gsv.missing.push("factor_missing_for_year");
            else {
              if (flagDecisions.gsv_factor_rounding_not_stated === "whole_percent_as_in_illustration") {
                const pct = mul(factor, rat(100));
                const q = pct.n / pct.d;
                const rem = sub(pct, rat(q));
                factor = div(rat(cmp(rem, rat(1, 2)) >= 0 ? q + BigInt(1) : q), rat(100));
                gsv.conditions.push("factor_rounded_to_whole_percent");
              }
              // Total premiums paid: the schedule's base premium per instalment (taxes, riders
              // and extra premium excluded, as the definition says), times instalments paid.
              const first = val<Paise>("schedule.instalment_premium_first_year")!;
              const renew = val<Paise>("schedule.instalment_premium_renewal")!;
              let tpp = rat(0);
              for (let i = 0; i < pay.paidCount; i++) tpp = add(tpp, rat((i < s.perYear ? first : renew).paise, 100));
              // Survival benefits applicable till date, per the advisor's recorded reading.
              const rec = val<{ amount: Paise; from: string; to: string }>("benefits.survival_recurring")!;
              const ter = val<{ amount: Paise; date: string }>("benefits.survival_terminal")!;
              // Cut-off: the surrender date, or the last policy anniversary (inclusive), as recorded.
              const cutoff = flagDecisions.survival_benefit_deduction_timing === "payouts_for_completed_policy_years"
                ? anniversaryIso(s.start, completed)
                : asOf;
              const counts = (d: string) => compareIso(d, cutoff) <= 0;
              let n = 0;
              for (let k = 0; k < 1200; k++) {
                const d = addMonthsIso(rec.from, k);
                if (compareIso(d, rec.to) > 0) break;
                if (counts(d)) n++;
              }
              let sb = mul(rat(rec.amount.paise, 100), rat(n));
              if (counts(ter.date)) sb = add(sb, rat(ter.amount.paise, 100));
              const r = evaluate(val<Expr>("surrender.gsv_formula")!, { gsv_factor: factor, total_premiums_paid: tpp, survival_benefits_till_date: sb });
              if (!r.ok) gsv.missing.push("formula_error");
              else {
                gsv.amount = rationalToPaiseFloor(r.value);
                gsv.basis = "document_reviewed_by_advisor";
              }
            }
          }
        }
      }
    }
  }

  /* ── Paid-up payouts (conditional) ── */
  const PU_DEPS: FieldKey[] = [...SCHED_DEPS, "status.paid_up_formula", "status.lapse_with_gsv", "status.lapse_without_gsv", "surrender.gsv_acquisition_min_premium_years", "benefits.survival_recurring", "benefits.survival_terminal"];
  const paidUp = base("paid_up_payouts", "conditional_if_policy_becomes_paid_up", PU_DEPS);
  paidUp.amounts = null;
  {
    const g = gate(PU_DEPS, []);
    paidUp.missing.push(...g.missing);
    if (!g.missing.length) {
      const s = schedule();
      if ("error" in s) paidUp.missing.push(s.error);
      else {
        const pay = premiumsPaid(s.dues);
        if (!pay.upToDate) paidUp.missing.push("payment_records_incomplete");
        else if (pay.paidCount < val<number>("surrender.gsv_acquisition_min_premium_years")! * s.perYear) {
          paidUp.conditions.push("would_lapse_no_benefits");
        } else {
          const f = val<Expr>("status.paid_up_formula")!;
          const reduce = (p: Paise) => {
            const r = evaluate(f, { payout: rat(p.paise, 100), premiums_paid_count: rat(pay.paidCount), premiums_payable_count: rat(s.dues.length) });
            return r.ok ? rationalToPaiseFloor(r.value) : null;
          };
          paidUp.amounts = {
            recurring: reduce(val<{ amount: Paise }>("benefits.survival_recurring")!.amount),
            terminal: reduce(val<{ amount: Paise }>("benefits.survival_terminal")!.amount),
          };
          paidUp.basis = "document_reviewed_by_advisor";
          paidUp.conditions.push("applies_only_if_premiums_stop_after_grace", "confirm_with_insurer");
        }
      }
    }
  }

  /* ── Surrender value and loan limit: not from the document ── */
  const sv = base("surrender_value", "surrender_value", ["surrender.ssv_discount_rule", "surrender.ssv_printed_rate"]);
  sv.missing.push("ssv_needs_current_rate");
  const loan = base("loan_limit", "loan_limit", ["loan.cap_pct_of_surrender_value"]);
  loan.missing.push("needs_surrender_value");

  /* ── Grace ── */
  const grace = { ...base("grace", null, ["schedule.grace_days", "grace.rule", "schedule.frequency"] as FieldKey[]), days: null as number | null };
  {
    const g = gate(grace.dependsOn, []);
    grace.missing.push(...g.missing);
    if (!g.missing.length) {
      const sd = val<number>("schedule.grace_days")!;
      const rule = val<{ monthlyDays: number; otherDays: number }>("grace.rule")!;
      const expect = val<string>("schedule.frequency") === "monthly" ? rule.monthlyDays : rule.otherDays;
      if (sd !== expect) grace.missing.push("grace_schedule_and_clause_disagree");
      else { grace.days = sd; grace.basis = "document_reviewed_by_advisor"; }
    }
  }

  /* ── Revival window: only after the insurer's own status shows lapse or paid-up ── */
  const revival = { ...base("revival", null, [...SCHED_DEPS, "revival.window", "schedule.policy_end_date"] as FieldKey[]), applyBy: null as string | null };
  {
    const g = gate(revival.dependsOn, []);
    revival.missing.push(...g.missing);
    if (!g.missing.length) {
      const st = latestQuote(evidence, "policy_status");
      const s = schedule();
      if (!st || (st.status !== "lapsed" && st.status !== "paid_up")) revival.missing.push("status_not_evidenced");
      else if ("error" in s) revival.missing.push(s.error);
      else {
        // The first unpaid premium: the first due date after the unbroken run of paid ones.
        const pay = premiumsPaid(s.dues);
        const first = s.dues[pay.paidCount] ?? null;
        if (!first || compareIso(first, st.quoteDate) > 0) revival.missing.push("first_unpaid_due_unknown");
        else {
          const w = val<{ years: number }>("revival.window")!;
          const byWindow = addMonthsIso(first, w.years * 12);
          const end = val<string>("schedule.policy_end_date")!;
          revival.applyBy = compareIso(byWindow, end) < 0 ? byWindow : end;
          revival.basis = "document_reviewed_by_advisor";
          revival.conditions.push("subject_to_insurer_terms_and_insurability", "outstanding_premiums_with_interest", "confirm_with_insurer");
        }
      }
    }
  }

  return { gsv, paid_up_payouts: paidUp, surrender_value: sv, loan_limit: loan, grace, revival };
}

/** Plain-English text for the reason codes above (UI fallback and bot). */
export const DOC_REASON_TEXT: Record<string, string> = {
  schedule_incomplete: "The premium schedule is not fully reviewed.",
  schedule_inconsistent: "The premium due dates do not line up with the printed final due date.",
  frequency_unsupported: "This premium frequency is not handled.",
  deferral_selected_or_unknown: "Survival benefit deferral is selected or not confirmed, so the deduction cannot be worked out.",
  payment_records_incomplete: "Not every premium due so far has a payment record.",
  policy_term_ended: "The policy term has ended.",
  factor_missing_for_year: "The GSV table has no factor for this policy year.",
  formula_error: "The formula could not be evaluated with these inputs.",
  gsv_not_acquired: "No GSV yet: at least two years' premiums must be paid.",
  surrender_value_is_higher_of_gsv_and_ssv: "This is the GSV only. The surrender value is the higher of GSV and SSV.",
  factor_rounded_to_whole_percent: "Factor rounded to a whole percent, as you recorded.",
  confirm_with_insurer: "Confirm with the insurer before acting.",
  would_lapse_no_benefits: "If premiums stopped now the policy would lapse with no benefits (GSV not yet acquired).",
  applies_only_if_premiums_stop_after_grace: "Applies only if a premium stays unpaid after the grace period.",
  ssv_needs_current_rate: "SSV needs today's discount rate and the insurer's method, so the surrender value is not available from the document.",
  needs_surrender_value: "The loan limit is 80% of the surrender value, which is not available.",
  grace_schedule_and_clause_disagree: "The schedule's grace period does not match the general clause for this frequency.",
  status_not_evidenced: "No insurer status shows the policy lapsed or paid-up, so no revival window is worked out.",
  first_unpaid_due_unknown: "The first unpaid premium date is not evidenced.",
  subject_to_insurer_terms_and_insurability: "Revival is subject to the insurer's terms and evidence of continued insurability.",
  outstanding_premiums_with_interest: "Outstanding premiums are payable with interest.",
};
