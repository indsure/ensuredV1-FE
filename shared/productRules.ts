/**
 * Product rules: the insurer's own surrender, paid-up and loan terms for one
 * product version.
 *
 * A surrender value is only as good as the factor table behind it, and those
 * tables are filed per product (insurer + UIN + version), not per industry.
 * This file defines the shape of one product's rules and checks a rule set is
 * internally sound before anything is calculated from it.
 *
 * VERIFIED_RULE_SETS ships EMPTY. Nothing here is a default. A rule set gets
 * added only after someone has read the insurer's own wording or filed table,
 * recorded where each number came from, and had it reviewed. Until then every
 * policy shows "Needs the insurer's factor table", which is the true answer.
 *
 * Zero imports except ./policyNumbers, so it can be copied to the bot.
 */

import { parseIsoDate } from "./policyNumbers";

export const RULE_SCHEMA_VERSION = 1;

export type RuleShape = "pure_term" | "return_of_premium" | "endowment" | "money_back";

/** One band of a factor table: a percentage that applies to every policy year in the band. */
export interface FactorBand {
  fromYear: number;
  toYear: number;
  pct: number;
}

/**
 * Linear steps between two bands, only where the product's own formula says
 * so (for example "50% + 40% x (year - 7) / (term - 8)"). Never assumed.
 * `toYear: "term_minus_1"` is for formulas whose end point moves with the term.
 */
export interface Interpolation {
  fromYear: number;
  toYear: number | "term_minus_1";
  rounding: "nearest_whole_percent" | "none";
}

export interface Citation {
  /** What the citation supports, e.g. "GSV factors" or "Loan: 80% of surrender value". */
  supports: string;
  document: string;
  page?: string | null;
  clause?: string | null;
  excerpt?: string | null;
}

export interface RuleSet {
  schema: 1;
  id: string;
  insurer: string;
  uin: string;
  productVersion?: string | null;
  /** Only policies issued inside this window use these rules. */
  issuedFrom?: string | null;
  issuedTo?: string | null;
  shape: RuleShape;
  surrender: {
    /** Policy years that must be completed, with premiums paid, before any surrender value exists. */
    acquiredAfterYears: number;
    gsv: {
      base: "premiums_paid_excluding_taxes_riders_extras";
      factors: FactorBand[];
      interpolation: Interpolation | null;
      /** Survival benefits already paid are deducted, as the money-back formulas state. */
      deductSurvivalBenefitsPaid: boolean;
    } | null;
    ssv: {
      /** Only a factor table is supported. Other methods are refused, not approximated. */
      method: "factor_table";
      base: "paid_up_basic_sum_assured_plus_vested_bonus";
      factors: FactorBand[];
      interpolation: Interpolation | null;
    } | null;
    selection: "higher_of_gsv_ssv" | "gsv_only" | "ssv_only";
  } | null;
  loan: {
    eligibleAfterYears: number;
    /** Most that can be lent, as a % of the surrender value. */
    maxPctOfSurrenderValue: number;
    /** Existing loan principal and interest are deducted from that limit. */
    deductExistingLoan: true;
  } | null;
  citations: Citation[];
  review: {
    status: "verified" | "agent_entered" | "draft";
    by?: string | null;
    on?: string | null;
  };
}

/**
 * Reviewed product rules. Empty on purpose: see the header. Adding one is a
 * code change with its citations, reviewed like any other.
 */
export const VERIFIED_RULE_SETS: RuleSet[] = [];

export type RuleIssue =
  | "rules_not_an_object"
  | "rules_schema_unknown"
  | "rules_identity_missing"
  | "rules_shape_unknown"
  | "rules_acquisition_invalid"
  | "rules_factor_band_invalid"
  | "rules_factor_bands_overlap"
  | "rules_factor_bands_unsorted"
  | "rules_interpolation_invalid"
  | "rules_method_unsupported"
  | "rules_selection_invalid"
  | "rules_loan_invalid"
  | "rules_dates_invalid";

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function checkBands(bands: unknown, issues: Set<RuleIssue>): FactorBand[] | null {
  if (!Array.isArray(bands) || bands.length === 0) {
    issues.add("rules_factor_band_invalid");
    return null;
  }
  const out: FactorBand[] = [];
  for (const b of bands) {
    if (
      !b || typeof b !== "object" ||
      !Number.isInteger((b as any).fromYear) || !Number.isInteger((b as any).toYear) ||
      !isNum((b as any).pct) || (b as any).pct < 0 || (b as any).pct > 100 ||
      (b as any).fromYear < 1 || (b as any).toYear < (b as any).fromYear || (b as any).toYear > 100
    ) {
      issues.add("rules_factor_band_invalid");
      return null;
    }
    out.push({ fromYear: (b as any).fromYear, toYear: (b as any).toYear, pct: (b as any).pct });
  }
  for (let i = 1; i < out.length; i++) {
    if (out[i].fromYear <= out[i - 1].toYear) {
      issues.add(out[i].fromYear < out[i - 1].fromYear ? "rules_factor_bands_unsorted" : "rules_factor_bands_overlap");
      return null;
    }
  }
  return out;
}

function checkInterpolation(raw: unknown, bands: FactorBand[] | null, issues: Set<RuleIssue>): Interpolation | null {
  if (raw === null || raw === undefined) return null;
  const i = raw as any;
  const okTo = i?.toYear === "term_minus_1" || Number.isInteger(i?.toYear);
  if (
    !i || typeof i !== "object" || !Number.isInteger(i.fromYear) || !okTo ||
    (i.rounding !== "nearest_whole_percent" && i.rounding !== "none")
  ) {
    issues.add("rules_interpolation_invalid");
    return null;
  }
  // Both ends must sit on a band, or there is nothing to step between.
  if (bands) {
    const has = (y: number) => bands.some((b) => y >= b.fromYear && y <= b.toYear);
    if (!has(i.fromYear) || (Number.isInteger(i.toYear) && !has(i.toYear))) {
      issues.add("rules_interpolation_invalid");
      return null;
    }
  }
  return { fromYear: i.fromYear, toYear: i.toYear, rounding: i.rounding };
}

/** Check a rule set. Returns the cleaned rules, or null and the reasons it was refused. */
export function validateRuleSet(raw: unknown): { rules: RuleSet | null; issues: RuleIssue[] } {
  const issues = new Set<RuleIssue>();
  if (!raw || typeof raw !== "object") return { rules: null, issues: ["rules_not_an_object"] };
  const r = raw as any;
  if (r.schema !== RULE_SCHEMA_VERSION) issues.add("rules_schema_unknown");
  if (typeof r.insurer !== "string" || !r.insurer.trim() || typeof r.uin !== "string" || !r.uin.trim()) {
    issues.add("rules_identity_missing");
  }
  if (!["pure_term", "return_of_premium", "endowment", "money_back"].includes(r.shape)) issues.add("rules_shape_unknown");
  for (const k of ["issuedFrom", "issuedTo"]) {
    if (r[k] !== null && r[k] !== undefined && !parseIsoDate(r[k]).ok) issues.add("rules_dates_invalid");
  }

  let surrender: RuleSet["surrender"] = null;
  if (r.surrender) {
    const s = r.surrender;
    if (!Number.isInteger(s.acquiredAfterYears) || s.acquiredAfterYears < 0 || s.acquiredAfterYears > 100) {
      issues.add("rules_acquisition_invalid");
    }
    let gsv: NonNullable<RuleSet["surrender"]>["gsv"] = null;
    if (s.gsv) {
      if (s.gsv.base !== "premiums_paid_excluding_taxes_riders_extras") issues.add("rules_method_unsupported");
      const bands = checkBands(s.gsv.factors, issues);
      const interp = checkInterpolation(s.gsv.interpolation, bands, issues);
      if (bands) {
        gsv = { base: "premiums_paid_excluding_taxes_riders_extras", factors: bands, interpolation: interp, deductSurvivalBenefitsPaid: s.gsv.deductSurvivalBenefitsPaid === true };
      }
    }
    let ssv: NonNullable<RuleSet["surrender"]>["ssv"] = null;
    if (s.ssv) {
      if (s.ssv.method !== "factor_table" || s.ssv.base !== "paid_up_basic_sum_assured_plus_vested_bonus") {
        issues.add("rules_method_unsupported");
      }
      const bands = checkBands(s.ssv.factors, issues);
      const interp = checkInterpolation(s.ssv.interpolation, bands, issues);
      if (bands) ssv = { method: "factor_table", base: "paid_up_basic_sum_assured_plus_vested_bonus", factors: bands, interpolation: interp };
    }
    const sel = s.selection;
    if (
      !["higher_of_gsv_ssv", "gsv_only", "ssv_only"].includes(sel) ||
      (sel === "higher_of_gsv_ssv" && (!s.gsv || !s.ssv)) ||
      (sel === "gsv_only" && !s.gsv) || (sel === "ssv_only" && !s.ssv)
    ) {
      issues.add("rules_selection_invalid");
    }
    surrender = { acquiredAfterYears: s.acquiredAfterYears, gsv, ssv, selection: sel };
  }

  let loan: RuleSet["loan"] = null;
  if (r.loan) {
    const l = r.loan;
    if (
      !Number.isInteger(l.eligibleAfterYears) || l.eligibleAfterYears < 0 ||
      !isNum(l.maxPctOfSurrenderValue) || l.maxPctOfSurrenderValue <= 0 || l.maxPctOfSurrenderValue > 100
    ) {
      issues.add("rules_loan_invalid");
    } else {
      loan = { eligibleAfterYears: l.eligibleAfterYears, maxPctOfSurrenderValue: l.maxPctOfSurrenderValue, deductExistingLoan: true };
    }
  }

  const status = r.review?.status;
  const review: RuleSet["review"] = {
    status: status === "verified" || status === "agent_entered" ? status : "draft",
    by: typeof r.review?.by === "string" ? r.review.by : null,
    on: typeof r.review?.on === "string" ? r.review.on : null,
  };

  if (issues.size) return { rules: null, issues: Array.from(issues) };
  return {
    rules: {
      schema: 1,
      id: String(r.id ?? `${r.insurer}:${r.uin}`),
      insurer: r.insurer.trim(),
      uin: r.uin.trim(),
      productVersion: typeof r.productVersion === "string" ? r.productVersion : null,
      issuedFrom: r.issuedFrom ?? null,
      issuedTo: r.issuedTo ?? null,
      shape: r.shape,
      surrender,
      loan,
      citations: Array.isArray(r.citations) ? r.citations.filter((c: any) => c && typeof c.supports === "string" && typeof c.document === "string") : [],
      review,
    },
    issues: [],
  };
}

/**
 * The factor for one policy year, as a fraction, or null where the table says
 * nothing about that year. Years are read straight off the bands. Steps
 * between bands only where the rules carry an interpolation.
 */
export function factorForYear(
  bands: FactorBand[], interpolation: Interpolation | null, year: number, term: number
): number | null {
  if (interpolation) {
    const to = interpolation.toYear === "term_minus_1" ? term - 1 : interpolation.toYear;
    if (to > interpolation.fromYear && year > interpolation.fromYear && year < to) {
      const a = factorForYear(bands, null, interpolation.fromYear, term);
      const b = factorForYear(bands, null, to, term);
      if (a === null || b === null) return null;
      const raw = a + (b - a) * ((year - interpolation.fromYear) / (to - interpolation.fromYear));
      return interpolation.rounding === "nearest_whole_percent" ? Math.round(raw * 100 + 1e-9) / 100 : raw;
    }
  }
  const hit = bands.find((b) => year >= b.fromYear && year <= b.toYear);
  return hit ? hit.pct / 100 : null;
}

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * The reviewed rules for this policy, if any. Matched on UIN (exact, ignoring
 * case and punctuation) and insurer, and on the issue date when the rules are
 * limited to a window. A name match alone is never enough.
 */
export function findVerifiedRuleSet(
  insurer: string | null, uin: string | null, issueDate: string | null, sets: RuleSet[] = VERIFIED_RULE_SETS
): RuleSet | null {
  if (!uin || !insurer) return null;
  for (const s of sets) {
    if (s.review.status !== "verified") continue;
    if (norm(s.uin) !== norm(uin)) continue;
    if (!norm(insurer).includes(norm(s.insurer)) && !norm(s.insurer).includes(norm(insurer))) continue;
    if (s.issuedFrom || s.issuedTo) {
      if (!issueDate) continue;
      if (s.issuedFrom && issueDate < s.issuedFrom) continue;
      if (s.issuedTo && issueDate > s.issuedTo) continue;
    }
    return s;
  }
  return null;
}
