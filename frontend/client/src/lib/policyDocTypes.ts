/**
 * The shape of policy terms read from a policy document by a deterministic
 * product parser (no model involved), and of the review that follows.
 *
 * Every field has one of five states:
 *   found          the document states it; value + where it was read
 *   not_applicable the document explicitly says NA / No for it
 *   missing        the parser looked and did not find it
 *   unsupported    found, but in a form this parser does not handle
 *   conflicting    found more than once with different values
 * "missing" is never turned into zero, and nothing is filled with a default.
 *
 * Imports types only. Copied byte for byte to shared/ and the WhatsApp bot.
 */

import type { Bps, Expr, Paise } from "./exactMath";

export type ExtractionMethod = "embedded_text" | "ocr";

export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where a value was read. `excerpt` holds contract wording or a label and its value, never identity data. */
export interface SourceRef {
  documentSha256: string;
  pdfPage: number;
  printedPage: string | null;
  clause: string | null;
  excerpt: string | null;
  region: Region | null;
  method: ExtractionMethod;
  parser: string;
  parserVersion: string;
}

export type FieldState<T> =
  | { state: "found"; value: T; raw: string; source: SourceRef }
  | { state: "not_applicable"; raw: string; source: SourceRef }
  | { state: "missing"; reason: string }
  | { state: "unsupported"; reason: string; raw?: string; source?: SourceRef }
  | { state: "conflicting"; reason: string; candidates: { raw: string; source: SourceRef }[] };

export type Frequency = "annual" | "half_yearly" | "quarterly" | "monthly" | "single";

/** A GSV band. `from`/`to` are policy years, or positions counted back from the term. */
export interface GsvBand {
  from: number | "term_minus_1";
  to: number | "term_minus_2" | "term";
  /** The factor as a formula in policy_year and policy_term (a constant for flat bands). */
  factor: Expr;
  raw: string;
}

export interface RateRule {
  /** What the rate is built on, as the document names it. */
  base: "annualized_yield_reference_gsec" | "average_annualized_10y_gsec_6_months";
  /** Rounded UP to a multiple of this many basis points, before or after the spread as stated. */
  roundUpBps: number;
  roundBeforeSpread: boolean;
  spread: Bps;
  /** Review months and day, e.g. 25 February and 25 August. */
  reviewDayMonth: { day: number; month: number }[];
}

/** Every field the parsers can produce, with its value type. */
export interface PolicyFields {
  "identity.insurer": string;
  "identity.plan": string;
  "identity.uin": string;
  "identity.option": string;
  "identity.benefit_choice": string;
  "identity.linked": "non_linked" | "linked";
  "identity.participating": "non_participating" | "participating";

  "schedule.currency": "INR";
  "schedule.annualized_premium": Paise;
  "schedule.instalment_premium_first_year": Paise;
  "schedule.instalment_premium_renewal": Paise;
  "schedule.extra_premium": Paise;
  "schedule.premium_excludes_taxes": true;
  "schedule.policy_term_years": number;
  "schedule.premium_paying_term_years": number;
  "schedule.frequency": Frequency;
  "schedule.commencement_date": string;
  "schedule.risk_commencement_date": string;
  "schedule.premium_due_day_month": { day: number; month: number };
  "schedule.final_premium_due_date": string;
  "schedule.policy_end_date": string;
  "schedule.grace_days": number;
  "schedule.sum_assured_on_death": Paise;
  "schedule.juvenile_ci_sum_assured": Paise;
  "schedule.deferral_selected": boolean;
  "schedule.premium_offset_selected": boolean;

  "benefits.survival_recurring": { amount: Paise; frequency: "monthly"; from: string; to: string };
  "benefits.survival_terminal": { amount: Paise; date: string };
  "benefits.maturity": { amount: Paise; date: string };
  "benefits.income": { amount: Paise };

  "definitions.policy_anniversary_anchor": "risk_commencement_date" | "policy_issue_date";
  "definitions.total_premiums_paid_excludes": string[];
  "definitions.annualized_premium_excludes": string[];

  "grace.rule": { monthlyDays: number; otherDays: number };

  "surrender.selection": "higher_of_gsv_ssv";
  "surrender.gsv_acquisition_min_premium_years": number;
  "surrender.gsv_formula": Expr;
  "surrender.gsv_factor_bands": GsvBand[];
  /** The GSV factor for each policy year of THIS policy's term, read from a printed table. */
  "surrender.gsv_factor_table": { year: number; pct: Bps }[];
  /** Which payouts GSV takes off: those paid before the surrender date. */
  "surrender.payout_deduction": "paid_before_surrender_date";
  /** Sum assured on death is the higher of the sum assured and this % of total premiums paid. */
  "death.min_pct_of_premiums_paid": Bps;
  "surrender.ssv_basis": "discounted_outstanding_survival_and_maturity_benefits";
  "surrender.ssv_reference_tenor": { upToTermYears: number; tenorUpTo: number; tenorAbove: number };
  "surrender.ssv_discount_rule": RateRule;
  "surrender.ssv_printed_rate": Bps;
  "discount_rate.general_rule": RateRule;

  "status.lapse_without_gsv": "lapsed_cover_ceases_no_benefits";
  "status.lapse_with_gsv": "paid_up";
  "status.paid_up_formula": Expr;

  "revival.window": { years: number; from: "due_date_of_first_unpaid_premium"; beforeTermExpiry: true };
  "revival.conditions": string[];
  "revival.printed_rate": Bps;
  "revival.rate_rule": RateRule;

  "loan.cap_pct_of_surrender_value": Bps;
  "loan.deduction_before_benefits": true;
  "loan.foreclosure": { appliesTo: "other_than_in_force_and_fully_paid_up"; thresholdPctOfSurrenderValue: Bps; comparison: "strictly_greater" };
  "loan.foreclosure_exemption": { statuses: ("in_force" | "fully_paid_up")[]; groundWording: "exceeding_the_surrender_value" };
  "loan.rate_rule": RateRule;
  "loan.rate_fixed_for_term_clause": true;
  "loan.rate_revised_until_next_revision_clause": true;
  "loan.printed_rate": Bps;
  "loan.msme_concessions": { who: "female" | "other_than_female"; reductionBps: number }[];

  "options.deferral_available": true;
  "options.premium_offset_available": true;
}

export type FieldKey = keyof PolicyFields;
export type ParsedFields = { [K in FieldKey]?: FieldState<PolicyFields[K]> };

/**
 * A point the advisor must decide on before anything that depends on it is
 * calculated. Raised by the parser from the document's own wording.
 */
export interface ReviewFlag {
  id:
    | "gsv_factor_rounding_not_stated"
    | "survival_benefit_deduction_timing"
    | "loan_rate_clauses_conflict"
    | "ssv_needs_current_rate"
    | "msme_concession_needs_eligibility"
    | "foreclosure_exemption_wording"
    | "read_by_ocr";
  fieldKeys: FieldKey[];
  /** Plain explanation, contract-level, no customer data. */
  note: string;
  /** Choices the advisor can record. Empty = cannot be resolved here (needs the insurer). */
  choices: string[];
  blocksCalculation: boolean;
}

export type IdentifyStatus = "supported" | "unsupported" | "needs_review" | "failed";

export interface ParseOutcome {
  status: IdentifyStatus;
  adapterId: string | null;
  adapterVersion: string | null;
  /** Why unsupported or needs review, in plain words. */
  reasons: string[];
  fields: ParsedFields;
  flags: ReviewFlag[];
}

/* ───────── Review state of one field (stored per policy, append-only) ───────── */

export type FactState = "document_pending" | "reviewed" | "corrected" | "rejected" | "conflicting";

export interface FactRevision {
  fieldKey: FieldKey;
  revision: number;
  state: FactState;
  /** The field as the document gave it (always kept). */
  document: FieldState<unknown>;
  /** The advisor's value, only for "corrected". */
  corrected: unknown | null;
  parserVersion: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reason: string | null;
}
