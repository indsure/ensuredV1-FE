/**
 * Deterministic value schedule for the life / term data-entry lanes.
 *
 * Given the flat fields OCR read off the policy document, work out what the
 * customer gets back in each policy year: money paid in, surrender value,
 * maturity benefit and death benefit.
 *
 * There is no model call here and no estimation. Every figure is arithmetic on
 * the extracted fields and on the parameters in ./policyParams — the charge
 * table, growth assumption, penalty factors and bonus rate that the payout
 * actually depends on. Those are read from the wording where it states them and
 * typed in by the agent where it does not, so the schedule can be reconciled
 * line by line against the benefit illustration in the customer's own document.
 *
 * No rate may be hardcoded here. If a number moves the payout it lives in
 * policyParams, or the two can silently disagree.
 *
 * Field keys must match EXTRACTION_FIELDS in ./insuranceTypes.
 */

import {
  bandPct, buildParams, type PolicyParams,
} from "./policyParams";

export type PlanShape =
  | "pure_term"
  | "return_of_premium"
  | "endowment"
  | "money_back"
  | "unit_linked";

export const PLAN_SHAPE_LABELS: Record<PlanShape, string> = {
  pure_term: "Term cover only",
  return_of_premium: "Term with return of premium",
  endowment: "Endowment / savings",
  money_back: "Money back / guaranteed income",
  unit_linked: "Unit linked",
};

export const PLAN_SHAPE_OPTIONS = Object.entries(PLAN_SHAPE_LABELS) as [PlanShape, string][];

export interface ValueRow {
  year: number;
  age: number | null;
  paid: number;
  /** Fund value / accrued value at the end of the year, before any penalty. */
  value: number;
  /** Penalty deducted if the policy is surrendered in that year. */
  penalty: number;
  /**
   * Payouts already handed over by the end of this year. The customer keeps
   * these whatever they do next, so `back` alone understates what they hold.
   */
  received: number;
  /** What the customer actually receives, after penalty and after any deferral. */
  back: number;
  cover: number;
  /** null = payable straight away; otherwise the date the money is released. */
  deferredTo: string | null;
  /** True where the figure rests on the customer's actual statement rather
   *  than purely on our projection. */
  actual: boolean;
  /** Annual return on the real cashflows if the policy is exited that year. */
  irr: number | null;
  /** The same, discounted by actual dates. Preferred wherever it resolves. */
  xirr: number | null;
  note: string;
}

export interface ValueSchedule {
  shape: PlanShape;
  rows: ValueRow[];
  params: PolicyParams;
  annualPremium: number;
  totalPremiums: number;
  maturity: number;
  term: number;
  ppt: number;
  entryAge: number | null;
  lockInYears: number | null;
  lockInEnds: string | null;
  guaranteed: boolean;
  steps: string[];
  /** Annual return if the policy is held to the end. */
  irrAtMaturity: number | null;
  xirrAtMaturity: number | null;
  /** Value the document itself states at maturity, when it was extracted. */
  illustratedMaturity: number | null;
  /** How far our schedule sits from the document's own figure. */
  reconciliation: { diff: number; pct: number } | null;
  /** Premium payment state, derived from the next due date on the document. */
  premiumStatus: PremiumStatus;
  premiumStatusNote: string | null;
  /** Policy year the actual fund value came from, when the statement gave one. */
  anchorYear: number | null;
  anchorValue: number | null;
}

/**
 * Whether the premiums are actually up to date. Every figure below assumes
 * they are; if the policy has lapsed or gone paid-up the real values are
 * different, so this is surfaced rather than quietly ignored.
 */
export type PremiumStatus = "in_force" | "grace" | "overdue" | "paid_up" | "unknown";

export interface ValueGap {
  missing: string[];
}

/**
 * Parse a YYYY-MM-DD policy date as local midnight, not UTC.
 *
 * new Date("2023-07-10") is UTC midnight, which in IST is 05:30 on the 10th.
 * This whole feature turns on anniversary boundaries, so that half-day skew
 * would show the wrong policy year for the first 5.5 hours of every day.
 */
export function policyDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const parts = String(iso).slice(0, 10).split("-");
  if (parts.length === 3) {
    const [y, m, dd] = parts.map(Number);
    if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(dd) && y > 1900) {
      return new Date(y, m - 1, dd);
    }
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
};

export function frequencyMultiplier(raw: unknown): number {
  const s = String(raw ?? "").toLowerCase();
  if (/month/.test(s)) return 12;
  if (/quarter/.test(s)) return 4;
  if (/half|semi|six/.test(s)) return 2;
  if (/single/.test(s)) return 1;
  return 1;
}

export function resolveShape(
  insuranceType: string,
  data: Record<string, any> | null
): { shape: PlanShape; inferred: boolean } {
  const stored = String(data?.plan_type ?? "").toLowerCase().trim();
  if (stored) {
    if (/unit|ulip|linked|market|fund/.test(stored)) return { shape: "unit_linked", inferred: false };
    if (/return of premium|\brop\b/.test(stored)) return { shape: "return_of_premium", inferred: false };
    if (/money.?back|income/.test(stored)) return { shape: "money_back", inferred: false };
    if (/endow|saving|guaranteed/.test(stored)) return { shape: "endowment", inferred: false };
    if (/term|pure|protect/.test(stored)) return { shape: "pure_term", inferred: false };
  }
  // A payout amount on the schedule settles it: only a money-back or income
  // plan pays the customer while the policy is still running.
  if (Number(data?.payout_amount) > 0) return { shape: "money_back", inferred: !stored };

  const name = String(data?.plan_name ?? "").toLowerCase();
  if (/money.?back|income|achiever|nivesh|sanchay/.test(name)) return { shape: "money_back", inferred: true };
  if (/unit linked|ulip|wealth|invest|market/.test(name)) return { shape: "unit_linked", inferred: true };
  if (/return of premium|\brop\b/.test(name)) return { shape: "return_of_premium", inferred: true };
  if (insuranceType === "term") return { shape: "pure_term", inferred: true };
  if (data?.maturity_date) return { shape: "endowment", inferred: true };
  return { shape: "pure_term", inferred: true };
}

/**
 * Guaranteed surrender value share. The flat bands come from the parameters;
 * the stretch between year 8 and the last two years is interpolated, which is
 * how the standard table is written.
 */
export function gsvShare(year: number, term: number, params: PolicyParams): number {
  const bands = params.gsvFactors.value;
  if (year <= 7) return bandPct(bands, year) / 100;
  const top = bandPct(bands, 99) / 100;
  const mid = bandPct(bands, 7) / 100;
  const last = Math.max(term - 2, 8);
  if (year >= last) return top;
  return mid + (top - mid) * ((year - 7) / (last - 7));
}

/**
 * Special surrender value share, as a fraction of the paid-up sum assured plus
 * accrued bonus. Banded and interpolated exactly like the guaranteed table.
 *
 * There is no universal SSV table — each insurer files its own — so the default
 * bands are a placeholder and always report as an assumption. This used to be a
 * curve hardcoded in the engine, which meant the document could not correct it.
 */
export function ssvShare(year: number, term: number, params: PolicyParams): number {
  const bands = params.ssvFactors.value;
  if (year <= 7) return bandPct(bands, year) / 100;
  const top = bandPct(bands, 99) / 100;
  const mid = bandPct(bands, 7) / 100;
  const last = Math.max(term - 2, 8);
  if (year >= last) return top;
  return mid + (top - mid) * ((year - 7) / (last - 7));
}

/**
 * Format a local Date back to YYYY-MM-DD.
 *
 * Not toISOString(): these Dates are local midnight, and converting them to UTC
 * in any positive-offset zone lands on the previous day. That turned a lock-in
 * ending 10 Jul into 09 Jul.
 */
export function isoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}
function addYears(iso: string | null, years: number): string | null {
  const dt = policyDate(iso);
  if (!dt) return null;
  dt.setFullYear(dt.getFullYear() + years);
  return isoDate(dt);
}

/**
 * Internal rate of return on the policy's actual cashflows.
 *
 * A life policy pays premiums in over years and one lump sum out, so a simple
 * CAGR on the total premiums overstates the return badly — money paid in year
 * 15 has not been working for 15 years. IRR is the measure that handles a
 * stream of payments, and it is what a customer should compare against an FD.
 *
 * Solved by bisection: no derivative to blow up, and it either brackets a root
 * or returns null rather than a made-up number.
 */
export function irr(flows: number[]): number | null {
  const npv = (r: number) => flows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + r, t), 0);
  return solve(npv);
}

/**
 * Bisection on a bracketed root, to 1e-7 on the rate — a hundredth of a basis
 * point, far tighter than anything we display. Exits on tolerance rather than
 * grinding a fixed 240 iterations, which is what made a 1,000-policy book take
 * seconds of blocking main-thread work.
 */
function solve(npv: (r: number) => number): number | null {
  let lo = -0.9999, hi = 5;
  let flo = npv(lo), fhi = npv(hi);
  if (!Number.isFinite(flo) || !Number.isFinite(fhi) || flo * fhi > 0) return null;
  for (let i = 0; i < 100 && hi - lo > 1e-7; i++) {
    const mid = (lo + hi) / 2;
    const fm = npv(mid);
    if (fm === 0) return mid;
    if (flo * fm < 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
  }
  return (lo + hi) / 2;
}

/** Cashflows for exiting at the end of policy year `exitYear`: premiums out at
 *  the start of each paying year, the payout in at exit. */
function exitFlows(annualPremium: number, ppt: number, exitYear: number, payout: number): number[] {
  const flows: number[] = new Array(exitYear + 1).fill(0);
  for (let t = 0; t < Math.min(ppt, exitYear); t++) flows[t] -= annualPremium;
  flows[exitYear] += payout;
  return flows;
}

/**
 * XIRR — the annual return on cashflows that fall on real dates.
 *
 * Better than the period IRR above wherever the dates are not neat annual
 * steps, which is most of the time: a monthly-mode premium is twelve payments
 * a year, not one, and a unit linked surrender inside the lock-in is paid on
 * the lock-in date rather than on a policy anniversary. Discounting by actual
 * days is the only way those come out right, and it is what Excel's XIRR does.
 */
export function xirr(flows: { date: Date; amount: number }[]): number | null {
  if (flows.length < 2) return null;
  const t0 = flows[0].date.getTime();
  const years = (d: Date) => (d.getTime() - t0) / (365 * 24 * 3600 * 1000);
  const npv = (r: number) =>
    flows.reduce((sum, f) => sum + f.amount / Math.pow(1 + r, years(f.date)), 0);
  return solve(npv);
}

function addMonths(d: Date, months: number): Date {
  const out = new Date(d);
  out.setMonth(out.getMonth() + months);
  return out;
}

/**
 * Dated cashflows for exiting at the end of policy year `exitYear`: one outflow
 * per premium instalment on its real due date, one inflow on the day the money
 * actually reaches the customer (which for a locked-in policy is not the
 * anniversary but the date the lock-in lifts).
 */
/** Survival payouts falling inside a window, as dated cashflows. */
function payoutFlows(
  amount: number, perYear: number, from: Date | null, to: Date | null, until: Date
): { date: Date; amount: number }[] {
  if (!amount || !from) return [];
  const out: { date: Date; amount: number }[] = [];
  const stepMonths = Math.max(Math.round(12 / perYear), 1);
  const last = to && to < until ? to : until;
  for (let i = 0, d = new Date(from); d <= last && i < 1200; i++) {
    out.push({ date: new Date(d), amount });
    d = addMonths(from, stepMonths * (i + 1));
  }
  return out;
}

function datedFlows(
  start: string | null, instalment: number, perYear: number, ppt: number,
  exitYear: number, payout: number, payoutDate: string | null
): { date: Date; amount: number }[] | null {
  if (!start) return null;
  const begin = policyDate(start);
  if (!begin) return null;
  const flows: { date: Date; amount: number }[] = [];
  const monthsApart = 12 / perYear;
  for (let y = 1; y <= Math.min(ppt, exitYear); y++) {
    for (let j = 0; j < perYear; j++) {
      flows.push({ date: addMonths(begin, (y - 1) * 12 + j * monthsApart), amount: -instalment });
    }
  }
  const landed = (payoutDate ? policyDate(payoutDate) : addMonths(begin, exitYear * 12));
  if (!landed) return null;
  flows.push({ date: landed, amount: payout });
  return flows;
}

function penaltyFor(year: number, ap: number, fv: number, params: PolicyParams): number {
  const row = params.penalties.value.find((p) => p.year === year);
  if (!row) return 0;
  const raw = Math.min((row.pct / 100) * ap, (row.pct / 100) * fv);
  return row.cap > 0 ? Math.min(raw, row.cap) : raw;
}

export interface ComputeOptions {
  /**
   * Solve the return for every policy year. The detail card scrubs through
   * years so it needs them all; the book view shows only today and maturity,
   * and solving all 20 for a thousand policies is seconds of blocked main
   * thread. Defaults to false — callers opt in to the expensive path.
   */
  allYearReturns?: boolean;
  /** Policy years the caller does need a return for, when not doing all. */
  returnYears?: number[];
  /** Treat this as "now" — injected so the behaviour is testable. */
  asOf?: Date;
}

export function computePolicyValue(
  insuranceType: string,
  data: Record<string, any> | null,
  options: ComputeOptions = {}
): ValueSchedule | ValueGap {
  const d = data ?? {};
  const sumAssured = num(d.sum_assured) ?? 0;
  const rawPremium = num(d.premium);
  const term = num(d.policy_term_years);

  const missing: string[] = [];
  if (!rawPremium) missing.push("Premium");
  if (!term) missing.push("Policy term (years)");
  if (!sumAssured) missing.push("Sum assured");
  if (missing.length) return { missing };

  const params = buildParams(d.policy_parameters);
  // Some parameters are also plain extracted fields on the form. Bridge those in,
  // otherwise moving a value into the parameter block silently drops it.
  const bridge = (key: "bonusPer1000" | "entryAge", flat: number | null) => {
    if (flat !== null && params[key].source === "default") {
      params[key] = { value: flat, source: "document" };
    }
  };
  bridge("bonusPer1000", num(d.bonus_per_1000));
  bridge("entryAge", num(d.age_at_entry));
  const perYear = frequencyMultiplier(d.premium_frequency);
  const annualPremium = rawPremium! * perYear;
  const ppt = Math.min(num(d.premium_paying_term_years) ?? term!, term!);
  const totalPremiums = annualPremium * ppt;

  const coverTillAge = num(d.cover_till_age);
  const entryAge =
    num(d.age_at_entry) ?? (coverTillAge ? coverTillAge - term! : params.entryAge.value ?? null);

  const { shape } = resolveShape(insuranceType, d);
  // "Sum assured" on these documents is the DEATH cover. The maturity amount is
  // a different number and is stated separately — on the policy that exposed
  // this, 20L against 14L. Never infer one from the other.
  const statedMaturity = num(d.maturity_amount);
  const payoutAmount = num(d.payout_amount) ?? 0;
  const payoutsPerYear = frequencyMultiplier(d.payout_frequency);
  const payoutStart = policyDate(d.payout_start_date);
  const payoutEnd = policyDate(d.payout_end_date);
  const payoutPerYear = payoutAmount * payoutsPerYear;
  const start: string | null = d.start_date ?? null;
  const floor = params.deathBenefitFloorPct.value / 100;

  const steps: string[] = [];
  let guaranteed = true;
  let lockInYears: number | null = null;
  let lockInEnds: string | null = null;

  steps.push(
    `Money paid by year n = premium × instalments per year × the smaller of n and the premium paying term` +
      (perYear > 1 ? ` — ${rawPremium} × ${perYear} × up to ${ppt}.` : ` — ${rawPremium} × up to ${ppt}.`)
  );

  const asOf = options.asOf ?? new Date();

  // Are the premiums actually up to date? Everything below assumes they are.
  const nextDue = policyDate(d.next_premium_date);
  const graceDays = perYear >= 12 ? 15 : 30;
  let premiumStatus: PremiumStatus = "unknown";
  let premiumStatusNote: string | null = null;
  if (!nextDue) {
    premiumStatusNote = "No next premium date was read, so we cannot tell whether the premiums are up to date.";
  } else {
    const overdueDays = Math.floor((asOf.getTime() - nextDue.getTime()) / 86400000);
    const pptEnd = addYears(start, ppt);
    const pptDone = pptEnd ? asOf >= new Date(pptEnd) : false;
    if (pptDone) {
      premiumStatus = "in_force";
    } else if (overdueDays <= 0) {
      premiumStatus = "in_force";
    } else if (overdueDays <= graceDays) {
      premiumStatus = "grace";
      premiumStatusNote = `Premium was due on ${d.next_premium_date} — inside the ${graceDays}-day grace period.`;
    } else {
      premiumStatus = overdueDays > 365 ? "paid_up" : "overdue";
      premiumStatusNote =
        `Premium due on ${d.next_premium_date} is ${overdueDays} days overdue. ` +
        "These figures assume every premium was paid, so they are too high until the policy is revived.";
    }
  }

  // Solving the return is the expensive part; only do the years asked for.
  const wantReturn = (y: number) =>
    options.allYearReturns === true ||
    (options.returnYears ? options.returnYears.includes(y) : false) ||
    y === term;

  // One instalment is what actually leaves the customer's account each time.
  const instalment = rawPremium!;
  const datedIrr = (exitYear: number, payout: number, payoutDate: string | null) => {
    const flows = datedFlows(start, instalment, perYear, ppt, exitYear, payout, payoutDate);
    if (!flows) return null;
    // Money already received during the term is part of the return. Leaving the
    // survival payouts out understates it and makes the plan look worse than it is.
    const begin = policyDate(start);
    if (begin && payoutAmount > 0) {
      const exitOn = policyDate(payoutDate) ?? addMonths(begin, exitYear * 12);
      flows.push(...payoutFlows(payoutAmount, payoutsPerYear, payoutStart, payoutEnd, exitOn));
    }
    flows.sort((a, b) => a.date.getTime() - b.date.getTime());
    return xirr(flows);
  };

  // The statement gives the fund value as at a real date. Where we have it, the
  // projection is rebased onto it: the charge model decides the SHAPE of the
  // curve, but the customer's own statement decides where it actually is. Without
  // this the screen shows a modelled fund and calls it theirs.
  const actualFund = num(d.fund_value);
  const fundAsOn = policyDate(d.fund_value_as_on) ?? asOf;
  const startDate = policyDate(start);
  let anchorYear: number | null = null;
  let anchorValue: number | null = null;
  if (actualFund !== null && actualFund > 0 && startDate) {
    const elapsed = (fundAsOn.getTime() - startDate.getTime()) / (365.2425 * 86400000);
    anchorYear = Math.min(Math.max(Math.ceil(elapsed), 1), term!);
    anchorValue = actualFund;
  }

  // Years that must complete before any surrender value exists. Two under the
  // old convention, one under the 2024 regulations — a parameter, not a literal.
  const acquired = (y: number) => y > params.surrenderAcquiresAfterYears.value - 1;

  const rows: ValueRow[] = [];

  if (shape === "unit_linked") {
    lockInYears = params.lockInYears.value;
    lockInEnds = addYears(start, lockInYears);
    guaranteed = false;

    // Month-by-month, exactly as the charge table in the wording describes it:
    // allocation charge off the premium going in, then administration and
    // mortality out of the fund, then growth net of the fund management charge.
    const gross = params.grossReturnPct.value / 100;
    const fmc = params.fundChargePct.value / 100;
    const monthly = Math.pow(1 + gross - fmc, 1 / 12) - 1;
    const admin = (y: number) =>
      Math.min(
        params.adminMonthly.value * Math.pow(1 + params.adminEscalationPct.value / 100, y - 1),
        params.adminCapMonthly.value
      );
    const mort = params.mortalityPer1000.value;

    let fv = 0;
    let tpp = 0;
    for (let y = 1; y <= term!; y++) {
      if (y <= ppt) {
        tpp += annualPremium;
        fv += annualPremium * (1 - bandPct(params.allocationCharges.value, y) / 100);
      }
      const age = (entryAge ?? params.entryAge.value) + y - 1;
      const rate = mort[age] ?? mort[Math.max(...Object.keys(mort).map(Number))] ?? 0;
      let sum12 = 0;
      for (let mo = 0; mo < 12; mo++) {
        const atRisk = Math.max(Math.max(sumAssured, floor * tpp) - fv, 0);
        fv -= (atRisk * rate) / 1000 / 12;
        fv -= admin(y);
        fv *= 1 + monthly;
        sum12 += fv;
      }
      if (y >= params.loyaltyFromYear.value) {
        fv += (params.loyaltyPct.value / 100) * (sum12 / 12);
      }
      // Rebase onto the statement. From here the projection carries the real
      // number forward through the same charges instead of a modelled one.
      if (anchorYear !== null && y === anchorYear) fv = anchorValue!;

      const penalty = penaltyFor(y, annualPremium, fv, params);
      const inLock = y <= lockInYears;
      const net = fv - penalty;
      const back = inLock
        ? net * Math.pow(1 + params.discontinuedFundRatePct.value / 100, lockInYears - y)
        : net;
      rows.push({
        year: y,
        age: entryAge === null ? null : entryAge + y,
        paid: annualPremium * Math.min(y, ppt),
        value: fv,
        penalty,
        received: 0,
        back,
        cover: Math.max(sumAssured, fv, floor * (annualPremium * Math.min(y, ppt))),
        deferredTo: inLock ? lockInEnds : null,
        actual: anchorYear !== null && y >= anchorYear,
        irr: wantReturn(y) ? irr(exitFlows(annualPremium, ppt, y, back)) : null,
        xirr: wantReturn(y) ? datedIrr(y, back, inLock ? lockInEnds : null) : null,
        note: inLock
          ? `Held in the discontinued fund until ${lockInEnds ?? "the end of the lock-in"}, earning ${params.discontinuedFundRatePct.value}% a year.`
          : "Fund value on the day you surrender.",
      });
    }

    if (anchorYear !== null) {
      steps.push(
        `Fund value of ${Math.round(anchorValue!).toLocaleString("en-IN")} from the statement is taken as ` +
          `fact at policy year ${anchorYear}; later years are projected forward from it, earlier years are ` +
          "our reconstruction of how it got there."
      );
    } else {
      steps.push(
        "No fund value was read from a statement, so the whole curve is modelled from the charge table. " +
          "Add the current fund value and everything from that year on becomes the customer's real position."
      );
    }
    steps.push(
      `Fund is rolled forward month by month: premium less the allocation charge goes in, then the ` +
        `₹${params.adminMonthly.value}/month administration charge and the mortality charge on the sum at ` +
        `risk come out, then growth of ${params.grossReturnPct.value}% less the ${params.fundChargePct.value}% fund management charge.`
    );
    steps.push(
      `Surrender inside the ${lockInYears}-year lock-in loses the discontinuance charge and is released only ` +
        `${lockInEnds ? `on ${lockInEnds}` : "at the end of the lock-in"}, earning ${params.discontinuedFundRatePct.value}% a year until then.`
    );
    if (params.loyaltyPct.value > 0) {
      steps.push(
        `A loyalty addition of ${params.loyaltyPct.value}% of the year's average fund is credited from year ${params.loyaltyFromYear.value}.`
      );
    }
  } else {
    for (let y = 1; y <= term!; y++) {
      const paid = annualPremium * Math.min(y, ppt);
      let receivedSoFar = 0;
      let value = 0;
      let back = 0;
      let cover = sumAssured;
      let note = "";

      if (shape === "pure_term") {
        note = "Term cover pays nothing on surrender or on survival.";
      }

      if (shape === "return_of_premium") {
        value = paid;
        back = y === term ? paid : acquired(y) ? gsvShare(y, term!, params) * paid : 0;
        note =
          !acquired(y)
            ? `No surrender value until ${params.surrenderAcquiresAfterYears.value} policy years are complete.`
            : y === term
            ? "Every premium paid is returned at maturity."
            : `${Math.round(gsvShare(y, term!, params) * 100)}% of the premiums paid so far.`;
      }

      if (shape === "money_back") {
        // Survival payouts already received by the end of this policy year.
        const begin = policyDate(start);
        const received = begin
          ? payoutFlows(payoutAmount, payoutsPerYear, payoutStart, payoutEnd, addMonths(begin, y * 12))
              .reduce((sum, p) => sum + p.amount, 0)
          : payoutPerYear * y;
        // The maturity amount is whatever the schedule states. We do not derive
        // it from the sum assured, because they are different numbers.
        const matAmount = statedMaturity ?? sumAssured;
        // Surrender pays the guaranteed value on premiums, less what has already
        // been handed over as survival benefit — the standard treatment.
        const gsv = acquired(y) ? gsvShare(y, term!, params) * paid : 0;
        value = received + (y === term ? matAmount : gsv);
        back = y === term ? matAmount : Math.max(gsv - 0, 0);
        receivedSoFar = received;
        cover = Math.max(sumAssured, floor * paid);
        note =
          y === term
            ? `Maturity amount of ${Math.round(matAmount).toLocaleString("en-IN")} as stated on the schedule.`
            : !acquired(y)
            ? `No surrender value until ${params.surrenderAcquiresAfterYears.value} policy years are complete.`
            : `Plus ${Math.round(received).toLocaleString("en-IN")} of payouts already received by then.`;
      }

      if (shape === "endowment") {
        const bonus = params.bonusPer1000.value * (sumAssured / 1000) * y;
        const paidUp = sumAssured * (Math.min(y, ppt) / ppt);
        const ssv = (paidUp + bonus) * ssvShare(y, term!, params);
        value = paidUp + bonus;
        back = y === term
          ? (statedMaturity ?? sumAssured + bonus)
          : Math.max(gsvShare(y, term!, params) * paid, acquired(y) ? ssv : 0);
        cover = Math.max(sumAssured, floor * paid) + bonus;
        if (params.bonusPer1000.value > 0) guaranteed = false;
        note =
          !acquired(y)
            ? `No surrender value until ${params.surrenderAcquiresAfterYears.value} policy years are complete.`
            : y === term
            ? "Sum assured plus the bonus accrued."
            : "Higher of the guaranteed value and the paid-up value with bonus.";
      }

      rows.push({
        year: y,
        age: entryAge === null ? null : entryAge + y,
        paid, value, penalty: 0, back, cover, received: receivedSoFar, deferredTo: null, note,
        actual: false,
        irr: wantReturn(y) ? irr(exitFlows(annualPremium, ppt, y, back)) : null,
        xirr: wantReturn(y) ? datedIrr(y, back, null) : null,
      });
    }

    if (shape === "pure_term") {
      steps.push("Surrender value = 0 — term cover acquires no surrender value, so there is nothing to schedule.");
      steps.push("Maturity benefit = 0 — nothing is payable if the life assured survives the term.");
      steps.push(`Cover on death = the sum assured, flat for all ${term} years.`);
    }
    if (shape === "return_of_premium") {
      steps.push("Surrender value = the guaranteed factor for that year × premiums paid, from the factor table.");
      steps.push("Maturity benefit = every premium paid, returned at the end of the term.");
    }
    if (shape === "money_back") {
      steps.push(
        `The plan pays ${Math.round(payoutAmount).toLocaleString("en-IN")} ${String(d.payout_frequency ?? "").toLowerCase() || "each period"}` +
          `${payoutStart ? ` from ${d.payout_start_date}` : ""}${payoutEnd ? ` to ${d.payout_end_date}` : ""}. ` +
          "Those payouts are counted as money received, both in the total and in the return."
      );
      steps.push(
        `Maturity amount is ${Math.round(statedMaturity ?? sumAssured).toLocaleString("en-IN")}, taken from the schedule. ` +
          "It is a different figure from the death cover and is never derived from it."
      );
      steps.push("Surrender before the end pays the guaranteed surrender value on the premiums paid.");
    }
    if (shape === "endowment") {
      steps.push(`Accrued bonus = ₹${params.bonusPer1000.value} per ₹1,000 of sum assured, per completed year.`);
      steps.push("Paid-up value = sum assured × premiums paid ÷ premiums payable, plus the bonus accrued.");
      steps.push("Surrender value = the higher of the guaranteed value and the paid-up value reduced for the years still to run.");
    }
  }

  if (shape !== "pure_term") {
    steps.push(
      `Cover on death = the highest of the sum assured, the value built up, and ${params.deathBenefitFloorPct.value}% of the premiums paid.`
    );
  }

  const maturity = rows[rows.length - 1]?.back ?? 0;
  const illustratedMaturity = num(d.illustrated_maturity_value);
  const reconciliation =
    illustratedMaturity !== null
      ? { diff: maturity - illustratedMaturity, pct: ((maturity - illustratedMaturity) / illustratedMaturity) * 100 }
      : null;

  return {
    shape, rows, params, annualPremium, totalPremiums, maturity,
    irrAtMaturity: rows[rows.length - 1]?.irr ?? null,
    xirrAtMaturity: rows[rows.length - 1]?.xirr ?? null,
    term: term!, ppt, entryAge, lockInYears, lockInEnds, guaranteed, steps,
    illustratedMaturity, reconciliation,
    premiumStatus, premiumStatusNote, anchorYear, anchorValue,
  };
}

export function isValueGap(v: ValueSchedule | ValueGap): v is ValueGap {
  return (v as ValueGap).missing !== undefined;
}
