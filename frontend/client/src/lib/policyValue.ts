/**
 * What a life policy is worth, and what each figure is based on.
 *
 * Every figure comes back as a ValueResult: an amount or null, the date it is
 * true for, what kind of figure it is (an insurer quote, a calculation from
 * checked policy terms, a figure printed on the document, an estimate), who
 * supplied the inputs, how far they were checked, and what is missing. The
 * screens decide what to show from that, never from a bare number.
 *
 * A rupee amount is treated as money the customer can get ONLY when it is
 * either a dated insurer quote, or a calculation from reviewed product rules
 * for this exact product, on details the advisor has checked against the
 * policy document, with every premium due so far accounted for and the loan
 * position known. Anything less is shown as what it is, or not shown.
 *
 * There are no defaults here. No generic factor table, grace period, lapse
 * rule, revival window, loan percentage or growth rate is assumed. Missing
 * evidence makes a figure unavailable, never zero.
 *
 * Pure and synchronous. No model call, no network. Dates are YYYY-MM-DD
 * calendar dates; "today" is the India calendar date unless the caller says.
 *
 * Imports only sibling pure modules, so it is copied byte for byte to the
 * WhatsApp bot (whatsapp-bot/scripts/sync-shared.mjs) and tested for drift.
 */

import {
  addMonthsIso, anniversaryIso, compareIso, completedPolicyYears, parseIsoDate,
  parseRupees, parseWholeNumber, valuationDateIso,
} from "./policyNumbers";
import { factorForYear, findVerifiedRuleSet, validateRuleSet, type RuleSet } from "./productRules";
import {
  activePayments, currentLoan, latestQuote, readEvidence,
  type Confirmation, type QuotedStatus, type ValueEvidence,
} from "./policyEvidence";

/* ───────────────────────── Result types ───────────────────────── */

/** What kind of figure this is. */
export type Basis =
  | "insurer_quote"          // a dated figure from the insurer, as entered by the advisor
  | "document_calculation"   // reviewed product rules + checked details + payment evidence
  | "stated_value"           // printed on the policy document or a statement, as read
  | "estimate"               // arithmetic on inputs that are not all checked or reviewed
  | "projection"             // a future scenario
  | "not_applicable"         // e.g. term cover has no surrender value
  | "unsupported"            // a product shape this does not handle
  | "insufficient";          // something needed is missing

/** Who supplied the inputs behind the figure. */
export type Origin = "agent_entered" | "read_from_document" | "calculated" | "none";

/** How far those inputs were checked. Separate from origin on purpose. */
export type Verification =
  | "insurer_document"   // advisor marked it as copied from an insurer document
  | "agent_checked"      // advisor confirmed it against the policy document
  | "self_reported"      // advisor typed it, no document behind it
  | "unchecked"          // read from the document by the reader, not checked
  | "none";

export type ValueKey =
  | "surrender_gross" | "surrender_payable" | "surrender_estimate" | "loan_remaining"
  | "maturity_guaranteed" | "vested_bonus" | "future_bonus" | "fund_value"
  | "premiums_scheduled" | "premiums_recorded";

export type Reason =
  // inputs
  | "premium_missing" | "premium_invalid" | "frequency_missing" | "frequency_unclear"
  | "term_missing" | "term_invalid" | "ppt_invalid" | "start_date_missing" | "start_date_invalid"
  | "dates_conflict" | "base_premium_missing" | "basic_sum_assured_missing" | "vested_bonus_missing"
  | "payout_schedule_missing" | "uin_missing" | "insurer_missing"
  // product
  | "shape_unknown" | "shape_candidate" | "shape_unsupported" | "term_no_surrender" | "term_no_maturity"
  | "ulip_ask_insurer" | "ulip_projection_only" | "no_verified_rules" | "rules_shape_mismatch"
  | "rules_entered_by_agent" | "rules_invalid" | "factor_missing_for_year" | "not_acquired_yet"
  | "ssv_method_unsupported"
  // checks and evidence
  | "inputs_not_checked" | "inputs_changed_since_check"
  | "schedule_unknown" | "payment_status_unknown" | "payment_records_incomplete" | "date_passed"
  | "status_not_in_force" | "status_older_than_due" | "first_premium_at_issue" | "single_premium_at_issue"
  | "payments_self_reported" | "payment_amounts_differ"
  | "loan_position_unknown" | "loan_interest_unknown" | "loan_rules_missing" | "loan_not_eligible_yet"
  | "loan_outstanding_comparison_off" | "deductions_exceed_value"
  // dates and meaning
  | "quote_dated" | "confirm_with_insurer" | "statement_date_missing" | "fund_value_not_surrender_value"
  | "schedule_not_payment" | "maturity_not_read" | "bonuses_not_included" | "future_bonus_not_guaranteed"
  | "terminal_loyalty_not_included" | "reduced_after_lapse_ask_insurer" | "assumes_scheduled_premiums_paid"
  | "future_bonus_unknown" | "comparison_needs_calculation";

export interface SourceRef {
  kind: "insurer_quote" | "payment_records" | "paid_to_record" | "loan_record" | "rule_set" | "policy_document" | "agent_check" | "legacy_parameter";
  label: string;
  date: string | null;
  reference: string | null;
}

export interface ValueResult {
  key: ValueKey;
  amount: number | null;
  currency: "INR";
  /** The date the figure is true for. Null only when there is no figure. */
  asOf: string | null;
  basis: Basis;
  origin: Origin;
  verification: Verification;
  /** gross: before deductions; net: after them; limit_remaining: what is left to borrow. */
  meaning: "gross" | "net" | "limit_remaining" | "stated" | "total";
  sources: SourceRef[];
  missing: Reason[];
  conditions: Reason[];
  /** "At most this much", when one deduction is known and another is not. Never a cash figure. */
  upperBound: number | null;
  /** How far deductions exceed the value, shown separately. Not a debt claim. */
  shortfall: number | null;
}

export type Shape = "pure_term" | "return_of_premium" | "endowment" | "money_back" | "unit_linked";

export interface ShapeResult {
  value: Shape | null;
  status: "accepted" | "candidate" | "unsupported" | "unknown";
  source: "agent" | "document" | "plan_name" | "payout_field" | "upload_lane" | null;
  candidate: Shape | null;
}

export type PaymentState =
  | "schedule_unknown"     // cannot tell what was due
  | "needs_checking"       // nothing recorded
  | "date_passed"          // a premium date on file has passed with nothing recorded
  | "recorded_gap"         // records exist but a due premium has none
  | "recorded_up_to_date"  // every premium due so far is accounted for
  | "insurer_status";      // the insurer's dated status is the newest evidence

export interface PaymentStatusResult {
  state: PaymentState;
  insurerStatus: QuotedStatus | null;
  statusDate: string | null;
  /** Every scheduled premium due on or before today is covered by evidence. */
  upToDate: boolean;
  dueInstalments: number;
  coveredInstalments: number;
  totalInstalments: number | null;
  firstUncoveredDue: string | null;
  lastDuePassed: string | null;
  confirmation: Confirmation | null;
  reasons: Reason[];
}

export interface LoanPosition {
  state: "none" | "outstanding" | "unknown";
  principal: number | null;
  interest: number | null;
  asOf: string | null;
  confirmation: Confirmation | null;
  source: "evidence" | "legacy_parameter" | "document_checked" | null;
}

export interface AnniversaryComparison {
  available: boolean;
  reasons: Reason[];
  nextAnniversary: string | null;
  requiredInstalments: number;
  requiredPremiums: number | null;
  payoutsBetween: number | null;
  currentNet: number | null;
  nextNet: number | null;
  /** next net + payouts in between - current net - premiums required. */
  difference: number | null;
}

export interface InputIssue {
  field: string;
  reason: Reason | "invalid";
}

export interface ScheduleRow {
  year: number;
  premiumsIfPaid: number;
  estimate: number | null;
}

export interface PolicyValuation {
  asOf: string;
  shape: ShapeResult;
  policyYear: number | null;
  completedYears: number | null;
  term: number | null;
  maturityDate: string | null;
  inputIssues: InputIssue[];
  inputsChecked: boolean;
  evidenceIssues: string[];
  rules: { verified: RuleSet | null; entered: RuleSet | null; issues: string[] };
  payment: PaymentStatusResult;
  loan: LoanPosition;
  values: Record<ValueKey, ValueResult>;
  /** Next-anniversary comparison; only ever from a document calculation. */
  nextAnniversary: AnniversaryComparison;
  /** Year-by-year estimate from an advisor-entered table. Never a quote. */
  illustration: ScheduleRow[] | null;
  /** Can this policy's surrender figure go in a cash total, and which one. */
  cash: {
    surrender: "calculated" | "quote" | null;
    borrow: "calculated" | "quote" | null;
  };
}

/* ───────────────────────── Inputs ───────────────────────── */

/** The fields the advisor confirms against the document. A change to any of them voids the check. */
export const DECISION_FIELDS = [
  "insurer", "uin", "plan_type", "premium", "premium_frequency", "premium_excluding_taxes",
  "policy_term_years", "premium_paying_term_years", "start_date", "issue_date",
  "basic_sum_assured", "maturity_amount", "vested_bonus", "vested_bonus_as_on",
  "payout_amount", "payout_frequency", "payout_start_date", "payout_end_date",
] as const;

type PerYear = number | "single";

export function readFrequency(raw: unknown): PerYear | null {
  const s = String(raw ?? "").toLowerCase().trim();
  if (!s) return null;
  if (/single|one.?time|lump/.test(s)) return "single";
  if (/month/.test(s)) return 12;
  if (/quarter/.test(s)) return 4;
  if (/half|semi|six/.test(s)) return 2;
  if (/annual|year/.test(s)) return 1;
  return null;
}

interface Inputs {
  instalment: number | null;
  perYear: PerYear | null;
  basePremium: number | null;
  term: number | null;
  ppt: number | null;
  start: string | null;
  issueDate: string | null;
  uin: string | null;
  insurer: string | null;
  basicSumAssured: number | null;
  maturityAmount: number | null;
  vestedBonus: number | null;
  vestedBonusAsOn: string | null;
  payoutAmount: number | null;
  payoutPerYear: number | null;
  payoutStart: string | null;
  payoutEnd: string | null;
  fundValue: number | null;
  fundValueAsOn: string | null;
  maturityDate: string | null;
  issues: InputIssue[];
}

function readInputs(d: Record<string, any>): Inputs {
  const issues: InputIssue[] = [];
  const money = (key: string, onBad: Reason | "invalid" = "invalid"): number | null => {
    const raw = d[key];
    if (raw === null || raw === undefined || raw === "") return null;
    const p = parseRupees(raw);
    if (!p.ok) { issues.push({ field: key, reason: onBad }); return null; }
    return p.value;
  };
  const date = (key: string, onBad: Reason | "invalid" = "invalid"): string | null => {
    const raw = d[key];
    if (raw === null || raw === undefined || raw === "") return null;
    const p = parseIsoDate(raw);
    if (!p.ok) { issues.push({ field: key, reason: onBad }); return null; }
    return p.value;
  };
  const years = (key: string, onBad: Reason): number | null => {
    const raw = d[key];
    if (raw === null || raw === undefined || raw === "") return null;
    const p = parseWholeNumber(raw, { min: 1, max: 100 });
    if (!p.ok) { issues.push({ field: key, reason: onBad }); return null; }
    return p.value;
  };
  const text = (key: string) => (typeof d[key] === "string" && d[key].trim() ? d[key].trim() : null);

  const instalment = money("premium", "premium_invalid");
  const perYear = readFrequency(d.premium_frequency);
  if (d.premium_frequency && perYear === null) issues.push({ field: "premium_frequency", reason: "frequency_unclear" });
  const term = years("policy_term_years", "term_invalid");
  let ppt = years("premium_paying_term_years", "ppt_invalid");
  if (term !== null && ppt !== null && ppt > term) {
    issues.push({ field: "premium_paying_term_years", reason: "ppt_invalid" });
    ppt = null;
  }
  const start = date("start_date", "start_date_invalid");
  const maturityDate = date("maturity_date");
  if (start && term !== null && maturityDate && maturityDate !== anniversaryIso(start, term)) {
    // A maturity date that is not start + term means one of the three is wrong.
    issues.push({ field: "maturity_date", reason: "dates_conflict" });
  }
  const payoutPerYearRaw = readFrequency(d.payout_frequency);
  return {
    instalment, perYear, term, ppt, start, maturityDate,
    basePremium: money("premium_excluding_taxes"),
    issueDate: date("issue_date"),
    uin: text("uin"),
    insurer: text("insurer"),
    basicSumAssured: money("basic_sum_assured"),
    maturityAmount: money("maturity_amount"),
    vestedBonus: money("vested_bonus"),
    vestedBonusAsOn: date("vested_bonus_as_on"),
    payoutAmount: money("payout_amount"),
    payoutPerYear: payoutPerYearRaw === "single" ? null : payoutPerYearRaw,
    payoutStart: date("payout_start_date"),
    payoutEnd: date("payout_end_date"),
    fundValue: money("fund_value"),
    fundValueAsOn: date("fund_value_as_on"),
    issues,
  };
}

/* ───────────────────────── Shape ───────────────────────── */

const UNSUPPORTED_RE = /pension|annuit|retire|whole\s*life|child|children|education|\bkid/;

function classify(text: string): Shape | null {
  if (/unit|ulip|linked|market|fund/.test(text)) return "unit_linked";
  if (/return of premium|\brop\b/.test(text)) return "return_of_premium";
  if (/money.?back|income/.test(text)) return "money_back";
  if (/endow|saving/.test(text)) return "endowment";
  if (/\bterm\b|pure|protect/.test(text)) return "pure_term";
  return null;
}

/**
 * Which kind of plan this is, and how sure we are.
 *
 * The advisor's own choice wins and is shown as theirs. A plan type the
 * document states is accepted as read. A plan NAME is only a candidate: "Jeevan
 * Plan" says nothing. With no evidence at all the answer is "unknown", never
 * "term cover", because a savings plan read as term shows its owner nothing.
 */
export function resolveShape(insuranceType: string, d: Record<string, any>, ev: ValueEvidence): ShapeResult {
  if (ev.shape) {
    if (ev.shape.value === "other") return { value: null, status: "unsupported", source: "agent", candidate: null };
    return { value: ev.shape.value, status: "accepted", source: "agent", candidate: null };
  }
  const stated = String(d.plan_type ?? "").toLowerCase().trim();
  if (stated) {
    if (UNSUPPORTED_RE.test(stated)) return { value: null, status: "unsupported", source: "document", candidate: null };
    const s = classify(stated);
    if (s) return { value: s, status: "accepted", source: "document", candidate: null };
  }
  const name = String(d.plan_name ?? "").toLowerCase();
  if (UNSUPPORTED_RE.test(name)) return { value: null, status: "unsupported", source: "plan_name", candidate: null };
  const byName = classify(name);
  if (byName) return { value: null, status: "candidate", source: "plan_name", candidate: byName };
  const payout = parseRupees(d.payout_amount);
  if (payout.ok && payout.value > 0) return { value: null, status: "candidate", source: "payout_field", candidate: "money_back" };
  if (insuranceType === "term") return { value: null, status: "candidate", source: "upload_lane", candidate: "pure_term" };
  return { value: null, status: "unknown", source: null, candidate: null };
}

/* ───────────────────────── Schedule and payments ───────────────────────── */

/** Scheduled premium due dates, from the start date at equal monthly steps. */
export function scheduledDueDates(start: string, perYear: PerYear, ppt: number): string[] {
  if (perYear === "single") return [start];
  const step = 12 / perYear;
  const out: string[] = [];
  for (let k = 0; k < ppt * perYear; k++) out.push(addMonthsIso(start, k * step));
  return out;
}

function payoutDates(inp: Inputs, until: string): string[] {
  if (!inp.payoutAmount || !inp.payoutPerYear || !inp.payoutStart) return [];
  const out: string[] = [];
  const step = 12 / inp.payoutPerYear;
  for (let k = 0; k < 1200; k++) {
    const d = addMonthsIso(inp.payoutStart, k * step);
    if (compareIso(d, until) > 0) break;
    if (inp.payoutEnd && compareIso(d, inp.payoutEnd) > 0) break;
    out.push(d);
  }
  return out;
}

function paymentStatus(inp: Inputs, ev: ValueEvidence, d: Record<string, any>, asOf: string): PaymentStatusResult {
  const reasons: Reason[] = [];
  const status = latestQuote(ev, "policy_status");
  const base: PaymentStatusResult = {
    state: "schedule_unknown", insurerStatus: null, statusDate: null, upToDate: false,
    dueInstalments: 0, coveredInstalments: 0, totalInstalments: null,
    firstUncoveredDue: null, lastDuePassed: null, confirmation: null, reasons,
  };

  if (!inp.start || inp.perYear === null || (inp.perYear !== "single" && (inp.ppt ?? inp.term) === null)) {
    if (!inp.start) reasons.push("start_date_missing");
    if (inp.perYear === null) reasons.push("frequency_missing");
    reasons.push("schedule_unknown");
    // A stated next-due date can still say a date has passed. It never says a premium was paid.
    const stated = parseIsoDate(d.next_premium_date);
    if (stated.ok && compareIso(stated.value, asOf) < 0) {
      base.state = "date_passed";
      base.lastDuePassed = stated.value;
      reasons.push("date_passed");
    }
    if (status && compareIso(status.quoteDate, asOf) <= 0) {
      base.state = "insurer_status";
      base.insurerStatus = status.status;
      base.statusDate = status.quoteDate;
      base.confirmation = status.confirmation;
    }
    return base;
  }

  const ppt = inp.ppt ?? inp.term!;
  const dues = scheduledDueDates(inp.start, inp.perYear, ppt);
  const dueToDate = dues.filter((x) => compareIso(x, asOf) <= 0);
  base.totalInstalments = dues.length;
  base.dueInstalments = dueToDate.length;
  base.lastDuePassed = dueToDate.length > 1 ? dueToDate[dueToDate.length - 1] : null;

  // Coverage. The first premium is paid at issue: the policy would not exist otherwise.
  const covered = new Set<string>();
  if (dues.length) {
    covered.add(dues[0]);
    reasons.push(inp.perYear === "single" ? "single_premium_at_issue" : "first_premium_at_issue");
  }
  let weakest: Confirmation | null = null;
  const note = (c: Confirmation) => { weakest = weakest === "self_reported" || c === "self_reported" ? "self_reported" : "insurer_document"; };
  const payments = activePayments(ev);
  for (const p of payments) {
    if (dues.includes(p.dueDate)) { covered.add(p.dueDate); note(p.confirmation); }
  }
  const paidTo = latestQuote(ev, "premiums_paid_to");
  if (paidTo?.paidTo) {
    for (const x of dues) if (compareIso(x, paidTo.paidTo) <= 0) covered.add(x);
    note(paidTo.confirmation);
  }
  if (inp.instalment !== null && payments.some((p) => Math.abs(p.amount - inp.instalment!) > 1)) {
    reasons.push("payment_amounts_differ");
  }
  const uncovered = dueToDate.filter((x) => !covered.has(x));
  base.coveredInstalments = dueToDate.length - uncovered.length;
  base.firstUncoveredDue = uncovered[0] ?? null;
  base.confirmation = weakest;
  if (weakest === "self_reported") reasons.push("payments_self_reported");

  const hasRecords = payments.length > 0 || !!paidTo;
  if (uncovered.length === 0) {
    base.state = "recorded_up_to_date";
    base.upToDate = true;
  } else if (!hasRecords) {
    base.state = base.lastDuePassed ? "date_passed" : "needs_checking";
    reasons.push(base.lastDuePassed ? "date_passed" : "payment_status_unknown");
  } else {
    base.state = "recorded_gap";
    reasons.push("payment_records_incomplete");
  }

  // The newest dated evidence wins. An insurer status counts only if no
  // scheduled premium has fallen due since it, without a record.
  if (status && compareIso(status.quoteDate, asOf) <= 0) {
    const dueSince = uncovered.filter((x) => compareIso(x, status.quoteDate) > 0);
    if (dueSince.length === 0) {
      base.state = "insurer_status";
      base.insurerStatus = status.status;
      base.statusDate = status.quoteDate;
      base.confirmation = status.confirmation;
      base.upToDate = status.status === "in_force";
    } else {
      reasons.push("status_older_than_due");
    }
  }
  return base;
}

/* ───────────────────────── Loans ───────────────────────── */

function loanPosition(d: Record<string, any>, ev: ValueEvidence, checked: (k: string) => boolean): LoanPosition {
  const rec = currentLoan(ev);
  if (rec) {
    return {
      state: rec.status, principal: rec.principal, interest: rec.interest, asOf: rec.asOf,
      confirmation: rec.confirmation, source: "evidence",
    };
  }
  // A loan balance read off a statement counts once the advisor has checked it.
  const p = parseRupees(d.loan_outstanding);
  const asOf = parseIsoDate(d.loan_statement_date);
  if (p.ok && asOf.ok && checked("loan_outstanding") && checked("loan_statement_date")) {
    const i = parseRupees(d.loan_interest_accrued);
    return {
      state: p.value > 0 ? "outstanding" : "none", principal: p.value,
      interest: i.ok && checked("loan_interest_accrued") ? i.value : p.value > 0 ? null : 0,
      asOf: asOf.value, confirmation: "insurer_document", source: "document_checked",
    };
  }
  // The old card's "loan already taken" box: a principal with no date and no interest.
  const legacy = d.policy_parameters?.outstandingLoan;
  const lv = legacy && typeof legacy === "object" ? legacy.value : legacy;
  const lp = parseRupees(lv);
  if (lp.ok && lp.value > 0) {
    return { state: "outstanding", principal: lp.value, interest: null, asOf: null, confirmation: "self_reported", source: "legacy_parameter" };
  }
  return { state: "unknown", principal: null, interest: null, asOf: null, confirmation: null, source: null };
}

/* ───────────────────────── Calculation from rules ───────────────────────── */

interface CalcOut {
  gross: number | null;
  missing: Reason[];
  notAcquired: boolean;
}

/**
 * Surrender value on a date, from a rule set, with `coveredInstalments`
 * premiums paid. Only what the rules state is used. A year the table does not
 * cover gives null, not an interpolated guess.
 */
function surrenderFromRules(rules: RuleSet, inp: Inputs, at: string, coveredInstalments: number): CalcOut {
  const missing: Reason[] = [];
  const s = rules.surrender;
  if (!s) return { gross: null, missing: ["no_verified_rules"], notAcquired: false };
  if (!inp.start || inp.term === null || inp.perYear === null) {
    return { gross: null, missing: ["schedule_unknown"], notAcquired: false };
  }
  const total = inp.perYear === "single" ? 1 : (inp.ppt ?? inp.term) * inp.perYear;
  const perYear = inp.perYear === "single" ? null : inp.perYear;
  const completed = completedPolicyYears(inp.start, at);
  const year = Math.min(completed + 1, inp.term);
  const yearsPaid = perYear === null ? Number.POSITIVE_INFINITY : coveredInstalments / perYear;
  if (completed < s.acquiredAfterYears || yearsPaid < s.acquiredAfterYears) {
    return { gross: 0, missing: [], notAcquired: true };
  }

  let gsv: number | null = null;
  if (s.gsv) {
    const f = factorForYear(s.gsv.factors, s.gsv.interpolation, year, inp.term);
    if (inp.basePremium === null) missing.push("base_premium_missing");
    if (f === null) missing.push("factor_missing_for_year");
    let paidOut = 0;
    if (s.gsv.deductSurvivalBenefitsPaid) {
      if (rules.shape === "money_back" && (!inp.payoutAmount || !inp.payoutPerYear || !inp.payoutStart)) {
        missing.push("payout_schedule_missing");
      }
      paidOut = payoutDates(inp, at).length * (inp.payoutAmount ?? 0);
    }
    if (f !== null && inp.basePremium !== null) {
      gsv = Math.max(f * inp.basePremium * coveredInstalments - paidOut, 0);
    }
  }

  let ssv: number | null = null;
  if (s.ssv) {
    const f = factorForYear(s.ssv.factors, s.ssv.interpolation, year, inp.term);
    if (inp.basicSumAssured === null) missing.push("basic_sum_assured_missing");
    if (inp.vestedBonus === null) missing.push("vested_bonus_missing");
    if (f === null) missing.push("factor_missing_for_year");
    if (f !== null && inp.basicSumAssured !== null && inp.vestedBonus !== null) {
      const paidUp = inp.basicSumAssured * Math.min(coveredInstalments / total, 1);
      ssv = f * (paidUp + inp.vestedBonus);
    }
  }

  let gross: number | null = null;
  if (s.selection === "gsv_only") gross = gsv;
  else if (s.selection === "ssv_only") gross = ssv;
  else gross = gsv !== null && ssv !== null ? Math.max(gsv, ssv) : null;
  return { gross: gross === null ? null : Math.round(gross * 100) / 100, missing: Array.from(new Set(missing)), notAcquired: false };
}

/* ───────────────────────── Main ───────────────────────── */

const empty = (key: ValueKey, meaning: ValueResult["meaning"]): ValueResult => ({
  key, amount: null, currency: "INR", asOf: null, basis: "insufficient", origin: "none",
  verification: "none", meaning, sources: [], missing: [], conditions: [], upperBound: null, shortfall: null,
});

export interface ValueOptions {
  /** Valuation date, YYYY-MM-DD. Defaults to today's date in India. */
  asOf?: string;
  /** Reviewed rule sets to match against. Defaults to the shipped registry (empty). */
  ruleSets?: RuleSet[];
}

/** Value one life or term policy from its stored data. Never throws on bad data. */
export function valuePolicy(insuranceType: string, data: Record<string, any> | null, options: ValueOptions = {}): PolicyValuation {
  const d = data ?? {};
  const asOf = options.asOf ?? valuationDateIso();
  const { evidence: ev, issues: evIssues } = readEvidence(d.value_evidence);
  const inp = readInputs(d);
  const shape = resolveShape(insuranceType, d, ev);

  // Inputs checked against the document: the snapshot must still match.
  const snap = ev.inputCheck?.fields ?? null;
  const same = (k: string) => {
    if (!snap || !(k in snap)) return false;
    const a = snap[k], b = d[k];
    return (a === null || a === undefined || a === "" ? null : String(a)) === (b === null || b === undefined || b === "" ? null : String(b));
  };
  const checked = (k: string) => same(k);
  const presentDecision = DECISION_FIELDS.filter((k) => d[k] !== null && d[k] !== undefined && d[k] !== "");
  const inputsChecked = !!snap && presentDecision.length > 0 && presentDecision.every((k) => same(k));
  const changedSinceCheck = !!snap && !inputsChecked;

  const completed = inp.start ? completedPolicyYears(inp.start, asOf) : null;
  const policyYear = completed !== null && inp.term !== null ? Math.min(completed + 1, inp.term) : completed !== null ? completed + 1 : null;
  const maturityDate = inp.maturityDate ?? (inp.start && inp.term !== null ? anniversaryIso(inp.start, inp.term) : null);

  const payment = paymentStatus(inp, ev, d, asOf);
  const loan = loanPosition(d, ev, checked);

  // Rules: reviewed for this exact product, or typed in by the advisor (never reviewed).
  const ruleIssues: string[] = [];
  const verified = findVerifiedRuleSet(inp.insurer, inp.uin, inp.issueDate ?? inp.start, options.ruleSets);
  const entered = ev.rules;
  if (evIssues.includes("rules_invalid")) ruleIssues.push("rules_invalid");

  const values = {} as Record<ValueKey, ValueResult>;
  const keys: [ValueKey, ValueResult["meaning"]][] = [
    ["surrender_gross", "gross"], ["surrender_payable", "net"], ["surrender_estimate", "gross"],
    ["loan_remaining", "limit_remaining"], ["maturity_guaranteed", "stated"], ["vested_bonus", "stated"],
    ["future_bonus", "stated"], ["fund_value", "stated"], ["premiums_scheduled", "total"], ["premiums_recorded", "total"],
  ];
  for (const [k, m] of keys) values[k] = empty(k, m);

  /* Premiums: what the schedule says was due, and what evidence says was paid. */
  if (inp.instalment !== null && payment.totalInstalments !== null) {
    values.premiums_scheduled = {
      ...values.premiums_scheduled,
      amount: payment.dueInstalments * inp.instalment, asOf,
      basis: inputsChecked ? "document_calculation" : "estimate",
      origin: "calculated", verification: inputsChecked ? "agent_checked" : "unchecked",
      conditions: ["schedule_not_payment"],
    };
    values.premiums_recorded = {
      ...values.premiums_recorded,
      amount: payment.coveredInstalments * inp.instalment, asOf,
      basis: "estimate", origin: "agent_entered",
      verification: payment.confirmation ?? "none",
      sources: [{ kind: "payment_records", label: "Premium records", date: null, reference: null }],
      conditions: payment.reasons.filter((r) => r === "first_premium_at_issue" || r === "single_premium_at_issue" || r === "payments_self_reported" || r === "payment_amounts_differ"),
    };
  } else {
    values.premiums_scheduled.missing = [inp.instalment === null ? "premium_missing" : "schedule_unknown"];
    values.premiums_recorded.missing = values.premiums_scheduled.missing;
  }

  /* Insurer quotes: dated figures, labelled as entered by the advisor. */
  const quote = (type: "surrender_payable" | "loan_available", key: ValueKey) => {
    const q = latestQuote(ev, type);
    if (!q || q.amount === null) return null;
    return {
      ...values[key], amount: q.amount, asOf: q.quoteDate, basis: "insurer_quote" as Basis,
      origin: "agent_entered" as Origin, verification: q.confirmation as Verification,
      sources: [{ kind: "insurer_quote" as const, label: type === "surrender_payable" ? "Insurer surrender quote" : "Insurer loan quote", date: q.quoteDate, reference: q.reference }],
      conditions: ["quote_dated", "confirm_with_insurer"] as Reason[],
    };
  };
  const surrenderQuote = quote("surrender_payable", "surrender_payable");
  const loanQuote = quote("loan_available", "loan_remaining");

  /* Shape gates. */
  const shapeMissing: Reason[] =
    shape.status === "unknown" ? ["shape_unknown"] :
    shape.status === "candidate" ? ["shape_candidate"] :
    shape.status === "unsupported" ? ["shape_unsupported"] : [];

  let comparison: AnniversaryComparison = {
    available: false, reasons: [], nextAnniversary: null, requiredInstalments: 0, requiredPremiums: null,
    payoutsBetween: null, currentNet: null, nextNet: null, difference: null,
  };
  let illustration: ScheduleRow[] | null = null;

  const inForce = payment.upToDate && (payment.insurerStatus === null || payment.insurerStatus === "in_force");

  if (shape.value === "pure_term") {
    for (const k of ["surrender_gross", "surrender_payable", "loan_remaining"] as ValueKey[]) {
      values[k] = { ...values[k], basis: "not_applicable", conditions: ["term_no_surrender", "confirm_with_insurer"] };
    }
    values.maturity_guaranteed = { ...values.maturity_guaranteed, basis: "not_applicable", conditions: ["term_no_maturity"] };
  } else if (shape.value === "unit_linked") {
    for (const k of ["surrender_gross", "surrender_payable"] as ValueKey[]) {
      values[k] = { ...values[k], basis: "unsupported", missing: ["ulip_ask_insurer"] };
    }
    values.loan_remaining = { ...values.loan_remaining, basis: "unsupported", missing: ["ulip_ask_insurer"] };
    values.maturity_guaranteed = { ...values.maturity_guaranteed, basis: "projection", conditions: ["ulip_projection_only"] };
    if (inp.fundValue !== null) {
      values.fund_value = inp.fundValueAsOn
        ? {
            ...values.fund_value, amount: inp.fundValue, asOf: inp.fundValueAsOn, basis: "stated_value",
            origin: "read_from_document", verification: checked("fund_value") ? "agent_checked" : "unchecked",
            sources: [{ kind: "policy_document", label: "Fund statement", date: inp.fundValueAsOn, reference: null }],
            conditions: ["fund_value_not_surrender_value", "ulip_ask_insurer"],
          }
        : { ...values.fund_value, missing: ["statement_date_missing"] };
    }
  } else if (shape.value) {
    /* Traditional plans: endowment, money back, return of premium. */
    const rulesForCalc = verified && verified.shape === shape.value ? verified : null;
    const why: Reason[] = [...shapeMissing];
    if (!verified) why.push("no_verified_rules");
    else if (verified.shape !== shape.value) why.push("rules_shape_mismatch");
    if (!inputsChecked) why.push(changedSinceCheck ? "inputs_changed_since_check" : "inputs_not_checked");
    if (!payment.upToDate) why.push(payment.state === "schedule_unknown" ? "schedule_unknown" : payment.insurerStatus && payment.insurerStatus !== "in_force" ? "status_not_in_force" : "payment_records_incomplete");
    for (const iss of inp.issues) if (iss.reason !== "invalid") why.push(iss.reason as Reason);

    if (rulesForCalc && inputsChecked && inForce && inp.issues.length === 0) {
      const calc = surrenderFromRules(rulesForCalc, inp, asOf, payment.coveredInstalments);
      const src: SourceRef[] = [
        { kind: "rule_set", label: `${rulesForCalc.insurer} ${rulesForCalc.uin}`, date: rulesForCalc.review.on ?? null, reference: rulesForCalc.id },
        { kind: "agent_check", label: "Details checked against the policy document", date: ev.inputCheck?.checkedOn ?? null, reference: null },
        { kind: "payment_records", label: "Premium records", date: null, reference: null },
      ];
      const ver: Verification = payment.confirmation === "insurer_document" ? "insurer_document" : "agent_checked";
      const conds: Reason[] = ["confirm_with_insurer"];
      if (payment.confirmation === "self_reported") conds.push("payments_self_reported");
      if (calc.notAcquired) conds.push("not_acquired_yet");
      if (calc.gross === null) {
        values.surrender_gross = { ...values.surrender_gross, missing: calc.missing };
        values.surrender_payable = { ...values.surrender_payable, missing: calc.missing };
      } else {
        values.surrender_gross = {
          ...values.surrender_gross, amount: calc.gross, asOf, basis: "document_calculation",
          origin: "calculated", verification: ver, sources: src, conditions: conds,
        };
        // Net: only when the loan position is known in full.
        const net = { ...values.surrender_payable, asOf, basis: "document_calculation" as Basis, origin: "calculated" as Origin, verification: ver, sources: [...src], conditions: [...conds] };
        if (loan.state === "unknown") {
          values.surrender_payable = { ...net, asOf: null, basis: "insufficient", missing: ["loan_position_unknown"] };
        } else if (loan.state === "none") {
          values.surrender_payable = { ...net, amount: calc.gross };
          net.sources.push({ kind: "loan_record", label: "No loan", date: loan.asOf, reference: null });
        } else if (loan.interest === null) {
          values.surrender_payable = {
            ...net, amount: null, asOf: null, basis: "insufficient", missing: ["loan_interest_unknown"],
            upperBound: Math.max(calc.gross - (loan.principal ?? 0), 0),
          };
        } else {
          const n = calc.gross - (loan.principal ?? 0) - loan.interest;
          values.surrender_payable = {
            ...net, amount: Math.max(n, 0), shortfall: n < 0 ? -n : null,
            sources: [...net.sources, { kind: "loan_record", label: "Loan balance", date: loan.asOf, reference: null }],
            conditions: n < 0 ? [...net.conditions, "deductions_exceed_value"] : net.conditions,
          };
        }

        // Borrowing: only under the product's own loan terms, on a policy shown to be in force.
        if (!rulesForCalc.loan) {
          values.loan_remaining = { ...values.loan_remaining, missing: ["loan_rules_missing"] };
        } else if ((completed ?? 0) < rulesForCalc.loan.eligibleAfterYears) {
          values.loan_remaining = { ...values.loan_remaining, amount: 0, asOf, basis: "document_calculation", origin: "calculated", verification: ver, sources: src, conditions: ["loan_not_eligible_yet"] };
        } else if (loan.state === "unknown") {
          values.loan_remaining = { ...values.loan_remaining, missing: ["loan_position_unknown"] };
        } else if (loan.state === "outstanding" && loan.interest === null) {
          values.loan_remaining = { ...values.loan_remaining, missing: ["loan_interest_unknown"] };
        } else {
          const limit = (calc.gross * rulesForCalc.loan.maxPctOfSurrenderValue) / 100;
          values.loan_remaining = {
            ...values.loan_remaining, amount: Math.max(limit - (loan.principal ?? 0) - (loan.interest ?? 0), 0), asOf,
            basis: "document_calculation", origin: "calculated", verification: ver, sources: src, conditions: ["confirm_with_insurer"],
          };
        }

        /* Next anniversary, on the same assumptions as today. */
        comparison = compareNextAnniversary(rulesForCalc, inp, asOf, payment, loan, values.surrender_payable.amount);
      }
    } else {
      values.surrender_gross = { ...values.surrender_gross, missing: Array.from(new Set(why)) };
      values.surrender_payable = { ...values.surrender_payable, missing: Array.from(new Set(why)) };
      values.loan_remaining = { ...values.loan_remaining, missing: Array.from(new Set(why)) };
      comparison.reasons = ["comparison_needs_calculation"];
    }

    /* An estimate from a table the advisor typed in. Shown apart from everything else. */
    if (entered && (shape.value === entered.shape)) {
      const covered = payment.upToDate ? payment.coveredInstalments : payment.dueInstalments;
      const est = surrenderFromRules(entered, inp, asOf, covered);
      const conds: Reason[] = ["rules_entered_by_agent", "confirm_with_insurer"];
      if (!payment.upToDate) conds.push("assumes_scheduled_premiums_paid");
      if (!inputsChecked) conds.push("inputs_not_checked");
      values.surrender_estimate = est.gross === null
        ? { ...values.surrender_estimate, basis: "estimate", missing: est.missing }
        : { ...values.surrender_estimate, amount: est.gross, asOf, basis: "estimate", origin: "agent_entered", verification: "self_reported", conditions: conds,
            sources: [{ kind: "rule_set", label: "Factor table you entered", date: null, reference: null }] };
      illustration = buildIllustration(entered, inp);
    } else if (entered) {
      values.surrender_estimate = { ...values.surrender_estimate, basis: "estimate", missing: ["rules_shape_mismatch"] };
    }

    /* Maturity: the stated figure only. Never the death cover in its place. */
    const participating =
      (inp.vestedBonus ?? 0) > 0 || (parseRupees(d.bonus_per_1000).ok && (parseRupees(d.bonus_per_1000) as any).value > 0) ||
      /with.?profit|participat|bonus/.test(String(d.plan_type ?? "") + " " + String(d.plan_name ?? "")).valueOf();
    if (payment.insurerStatus === "paid_up" || payment.insurerStatus === "lapsed") {
      values.maturity_guaranteed = { ...values.maturity_guaranteed, missing: ["reduced_after_lapse_ask_insurer"] };
    } else if (inp.maturityAmount === null) {
      values.maturity_guaranteed = { ...values.maturity_guaranteed, missing: ["maturity_not_read"] };
    } else {
      values.maturity_guaranteed = {
        ...values.maturity_guaranteed, amount: inp.maturityAmount, asOf: maturityDate, basis: "stated_value",
        origin: "read_from_document", verification: checked("maturity_amount") ? "agent_checked" : "unchecked",
        sources: [{ kind: "policy_document", label: "Policy schedule", date: null, reference: null }],
        conditions: participating
          ? ["bonuses_not_included", "terminal_loyalty_not_included", "confirm_with_insurer"]
          : ["terminal_loyalty_not_included", "confirm_with_insurer"],
      };
    }
    if (inp.vestedBonus !== null) {
      values.vested_bonus = inp.vestedBonusAsOn
        ? { ...values.vested_bonus, amount: inp.vestedBonus, asOf: inp.vestedBonusAsOn, basis: "stated_value", origin: "read_from_document",
            verification: checked("vested_bonus") ? "agent_checked" : "unchecked", conditions: ["confirm_with_insurer"],
            sources: [{ kind: "policy_document", label: "Bonus statement", date: inp.vestedBonusAsOn, reference: null }] }
        : { ...values.vested_bonus, missing: ["statement_date_missing"] };
    }
    if (participating) {
      values.future_bonus = { ...values.future_bonus, basis: "not_applicable", conditions: ["future_bonus_not_guaranteed"] };
    }
  } else {
    for (const k of ["surrender_gross", "surrender_payable", "loan_remaining", "maturity_guaranteed"] as ValueKey[]) {
      values[k] = { ...values[k], basis: shape.status === "unsupported" ? "unsupported" : "insufficient", missing: shapeMissing };
    }
  }

  // A dated insurer quote stands on its own, whatever else is missing.
  if (surrenderQuote && values.surrender_payable.basis !== "document_calculation") values.surrender_payable = surrenderQuote;
  if (loanQuote && values.loan_remaining.basis !== "document_calculation") values.loan_remaining = loanQuote;

  const cashOf = (v: ValueResult): "calculated" | "quote" | null =>
    v.amount === null || v.asOf === null ? null : v.basis === "document_calculation" ? "calculated" : v.basis === "insurer_quote" ? "quote" : null;

  return {
    asOf, shape, policyYear, completedYears: completed, term: inp.term, maturityDate,
    inputIssues: inp.issues, inputsChecked, evidenceIssues: evIssues,
    rules: { verified, entered, issues: ruleIssues },
    payment, loan, values, nextAnniversary: comparison, illustration,
    cash: { surrender: cashOf(values.surrender_payable), borrow: cashOf(values.loan_remaining) },
  };
}

/**
 * Next anniversary versus today, both net, both from the same rules.
 *
 * Required premiums are the scheduled instalments due after today, up to and
 * including the anniversary itself (an annual premium falls due ON it). The
 * next-year value counts them as paid, once, and the difference subtracts
 * them, once. Survival payouts in between are added because the customer
 * receives them by staying. Only offered with no loan: interest accruing at a
 * rate nobody has confirmed would make the comparison a guess.
 */
function compareNextAnniversary(
  rules: RuleSet, inp: Inputs, asOf: string, payment: PaymentStatusResult, loan: LoanPosition, currentNet: number | null
): AnniversaryComparison {
  const out: AnniversaryComparison = {
    available: false, reasons: [], nextAnniversary: null, requiredInstalments: 0, requiredPremiums: null,
    payoutsBetween: null, currentNet, nextNet: null, difference: null,
  };
  if (!inp.start || inp.term === null || inp.perYear === null || inp.instalment === null) {
    out.reasons.push("schedule_unknown");
    return out;
  }
  const completed = completedPolicyYears(inp.start, asOf);
  if (completed + 1 >= inp.term) return out; // already in the final year
  const next = anniversaryIso(inp.start, completed + 1);
  out.nextAnniversary = next;
  if (currentNet === null) { out.reasons.push("comparison_needs_calculation"); return out; }
  if (loan.state !== "none") { out.reasons.push(loan.state === "unknown" ? "loan_position_unknown" : "loan_outstanding_comparison_off"); return out; }
  if (rules.surrender?.ssv && (inp.vestedBonus ?? 0) > 0 && rules.surrender.selection !== "gsv_only") {
    // Next year's bonus is declared later and is not guaranteed.
    out.reasons.push("future_bonus_unknown");
    return out;
  }
  const dues = scheduledDueDates(inp.start, inp.perYear, inp.ppt ?? inp.term);
  const required = dues.filter((x) => compareIso(x, asOf) > 0 && compareIso(x, next) <= 0);
  out.requiredInstalments = required.length;
  out.requiredPremiums = required.length * inp.instalment;
  const calc = surrenderFromRules(rules, inp, next, payment.coveredInstalments + required.length);
  if (calc.gross === null) { out.reasons.push(...calc.missing); return out; }
  const payoutsNow = payoutDates(inp, asOf).length;
  const payoutsNext = payoutDates(inp, next).length;
  out.payoutsBetween = (payoutsNext - payoutsNow) * (inp.payoutAmount ?? 0);
  out.nextNet = calc.gross;
  out.difference = Math.round((calc.gross + out.payoutsBetween - currentNet - out.requiredPremiums) * 100) / 100;
  out.available = true;
  return out;
}

/** Year by year from an advisor-entered table, assuming every scheduled premium is paid. An estimate, labelled as one. */
function buildIllustration(rules: RuleSet, inp: Inputs): ScheduleRow[] | null {
  if (!inp.start || inp.term === null || inp.perYear === null || inp.instalment === null) return null;
  const rows: ScheduleRow[] = [];
  const dues = scheduledDueDates(inp.start, inp.perYear, inp.ppt ?? inp.term);
  for (let y = 1; y <= inp.term; y++) {
    // Surrender during policy year y: on the day after the (y-1)th anniversary.
    const at = anniversaryIso(inp.start, y - 1);
    const paidCount = dues.filter((x) => compareIso(x, at) <= 0).length;
    const calc = surrenderFromRules(rules, inp, at, paidCount);
    rows.push({ year: y, premiumsIfPaid: paidCount * inp.instalment, estimate: calc.gross });
  }
  return rows;
}

/** Legacy policy_parameters factor tables, read through an explicit adapter. Conflicts are reported, not resolved. */
export function legacyFactorTables(params: unknown): { gsv: unknown; ssv: unknown; conflicts: string[] } {
  const conflicts: string[] = [];
  const p = (params && typeof params === "object" ? params : {}) as Record<string, any>;
  const pick = (camel: string, snake: string) => {
    const a = p[camel] && typeof p[camel] === "object" && "value" in p[camel] ? p[camel].value : p[camel];
    const b = p[snake] && typeof p[snake] === "object" && "value" in p[snake] ? p[snake].value : p[snake];
    if (a !== undefined && b !== undefined && JSON.stringify(a) !== JSON.stringify(b)) conflicts.push(camel);
    return a !== undefined ? a : b;
  };
  return { gsv: pick("gsvFactors", "gsv_factors"), ssv: pick("ssvFactors", "ssv_factors"), conflicts };
}

export { validateRuleSet };
