/**
 * The variable inputs a life policy's value schedule depends on.
 *
 * The basic details (premium, term, sum assured) come off the policy schedule.
 * These are the *other* things the payout actually depends on: the charge table,
 * the growth assumption, the surrender penalty factors, the bonus rate. Real
 * policy wordings state most of them, so extraction fills what it can and the
 * agent types in the rest — each one carries where it came from, so the card can
 * show what was read versus what was assumed.
 *
 * Everything here is an input to lib/policyValue. Nothing in that file may
 * hardcode a rate: if a number affects the payout it belongs in this file, or
 * the schedule cannot be reconciled against the illustration in the document.
 */

export type ParamSource = "document" | "entered" | "default";

export interface Param<T> {
  value: T;
  source: ParamSource;
}

/** A charge expressed as a percentage over a band of policy years. */
export interface YearBandPct {
  fromYear: number;
  toYear: number;
  pct: number;
}

/** Discontinuance / surrender penalty for one policy year. */
export interface PenaltyRow {
  year: number;
  /** Lower of this % of annualised premium and of fund value... */
  pct: number;
  /** ...subject to this cap in rupees. 0 = no cap. */
  cap: number;
}

export interface PolicyParams {
  /** Assumed gross investment return, per year, before charges. */
  grossReturnPct: Param<number>;
  /** Fund management charge, per year, deducted from the fund. */
  fundChargePct: Param<number>;
  /** Premium allocation charge by policy-year band. */
  allocationCharges: Param<YearBandPct[]>;
  /** Policy administration charge, per month, with annual escalation and cap. */
  adminMonthly: Param<number>;
  adminEscalationPct: Param<number>;
  adminCapMonthly: Param<number>;
  /** Mortality charge per 1,000 of sum at risk, by attained age. */
  mortalityPer1000: Param<Record<number, number>>;
  /** Lock-in before any money can be paid out. */
  lockInYears: Param<number>;
  /** Interest the discontinued fund earns during the lock-in. */
  discontinuedFundRatePct: Param<number>;
  /** Penalty applied on surrender inside the lock-in. */
  penalties: Param<PenaltyRow[]>;
  /** Loyalty addition, as a % of the trailing average fund value. */
  loyaltyPct: Param<number>;
  loyaltyFromYear: Param<number>;
  /** Death benefit floor, as a % of premiums paid. */
  deathBenefitFloorPct: Param<number>;
  /** Reversionary bonus per 1,000 of sum assured, per year (endowment). */
  bonusPer1000: Param<number>;
  /** Guaranteed surrender value factors, % of premiums paid, by year band. */
  gsvFactors: Param<YearBandPct[]>;
  /** Age of the life assured when the policy started. */
  entryAge: Param<number>;
}

const d = <T,>(value: T): Param<T> => ({ value, source: "default" });

/**
 * Standard regulatory / market-typical values, used only where the document did
 * not state one. Every one of these is visible and editable on the policy card,
 * marked "assumed", so nothing here is silently believed.
 */
export const DEFAULT_PARAMS: PolicyParams = {
  grossReturnPct: d(8),
  fundChargePct: d(1.35),
  allocationCharges: d([
    { fromYear: 1, toYear: 1, pct: 6 },
    { fromYear: 2, toYear: 3, pct: 4 },
    { fromYear: 4, toYear: 5, pct: 3 },
    { fromYear: 6, toYear: 99, pct: 0 },
  ]),
  adminMonthly: d(300),
  adminEscalationPct: d(5),
  adminCapMonthly: d(500),
  mortalityPer1000: d({
    25: 0.72, 26: 0.75, 27: 0.79, 28: 0.84, 29: 0.92, 30: 0.96, 31: 0.99, 32: 1.0,
    33: 1.01, 34: 1.03, 35: 1.05, 36: 1.14, 37: 1.24, 38: 1.36, 39: 1.5, 40: 1.66,
    41: 1.85, 42: 2.07, 43: 2.32, 44: 2.61, 45: 2.94, 46: 3.32, 47: 3.75, 48: 4.24,
    49: 4.79, 50: 5.41, 51: 6.11, 52: 6.9, 53: 7.79, 54: 8.79, 55: 9.91, 56: 11.17,
    57: 12.59, 58: 14.19, 59: 15.99, 60: 18.02,
  }),
  lockInYears: d(5),
  discontinuedFundRatePct: d(4),
  penalties: d([
    { year: 1, pct: 6, cap: 6000 },
    { year: 2, pct: 4, cap: 5000 },
    { year: 3, pct: 3, cap: 4000 },
    { year: 4, pct: 2, cap: 2000 },
  ]),
  loyaltyPct: d(0.3),
  loyaltyFromYear: d(11),
  deathBenefitFloorPct: d(105),
  bonusPer1000: d(0),
  gsvFactors: d([
    { fromYear: 1, toYear: 1, pct: 0 },
    { fromYear: 2, toYear: 3, pct: 30 },
    { fromYear: 4, toYear: 7, pct: 50 },
    // years 8 to term-2 are interpolated 50 → 90 by the engine
    { fromYear: 8, toYear: 99, pct: 90 },
  ]),
  entryAge: d(35),
};

/** Which parameters actually move the answer, per plan shape — so the card only
 *  asks for what matters and does not bury the agent in irrelevant fields. */
export const RELEVANT_PARAMS: Record<string, (keyof PolicyParams)[]> = {
  pure_term: [],
  return_of_premium: ["gsvFactors"],
  endowment: ["bonusPer1000", "gsvFactors", "deathBenefitFloorPct"],
  unit_linked: [
    "grossReturnPct", "fundChargePct", "allocationCharges", "adminMonthly",
    "adminEscalationPct", "adminCapMonthly", "mortalityPer1000", "entryAge",
    "lockInYears", "discontinuedFundRatePct", "penalties", "loyaltyPct",
    "loyaltyFromYear", "deathBenefitFloorPct",
  ],
};

export const PARAM_LABELS: Partial<Record<keyof PolicyParams, string>> = {
  grossReturnPct: "Assumed growth before charges (% a year)",
  fundChargePct: "Fund management charge (% a year)",
  allocationCharges: "Premium allocation charge",
  adminMonthly: "Policy administration charge (₹ a month)",
  adminEscalationPct: "Administration charge rises by (% a year)",
  adminCapMonthly: "Administration charge capped at (₹ a month)",
  mortalityPer1000: "Mortality charge per ₹1,000 at risk",
  entryAge: "Age when the policy started",
  lockInYears: "Lock-in (years)",
  discontinuedFundRatePct: "Discontinued fund earns (% a year)",
  penalties: "Discontinuance charge",
  loyaltyPct: "Loyalty addition (% of fund)",
  loyaltyFromYear: "Loyalty addition starts in year",
  deathBenefitFloorPct: "Death benefit floor (% of premiums paid)",
  bonusPer1000: "Declared bonus per ₹1,000 sum assured",
  gsvFactors: "Guaranteed surrender value factors",
};

/**
 * Merge whatever the document gave us over the defaults. Anything present in
 * `stored` is marked as coming from the document (or from the agent, if they
 * typed it), so the card can show provenance per row.
 */
export function buildParams(stored: Record<string, any> | null | undefined): PolicyParams {
  const out: any = {};
  for (const [key, def] of Object.entries(DEFAULT_PARAMS)) {
    const raw = stored?.[key];
    if (raw && typeof raw === "object" && "value" in raw && raw.value !== null && raw.value !== undefined) {
      out[key] = { value: raw.value, source: raw.source === "entered" ? "entered" : "document" };
    } else if (raw !== null && raw !== undefined && typeof raw !== "object") {
      out[key] = { value: raw, source: "document" };
    } else {
      out[key] = { ...(def as Param<unknown>) };
    }
  }
  return out as PolicyParams;
}

export function bandPct(bands: YearBandPct[], year: number): number {
  const hit = bands.find((b) => year >= b.fromYear && year <= b.toYear);
  return hit ? hit.pct : 0;
}

/** How many of the parameters that matter here are still assumptions. */
export function assumedCount(params: PolicyParams, shape: string): number {
  return (RELEVANT_PARAMS[shape] ?? []).filter((k) => params[k].source === "default").length;
}
