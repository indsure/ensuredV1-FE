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
  bandPct, buildParams, type PolicyParams, type YearBandPct,
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
  /**
   * Most that could be borrowed against this year's surrender value instead of
   * giving the policy up. Zero where nothing is payable yet, and on unit linked
   * plans, which are not lent against.
   */
  maxLoan: number;
  note: string;
}

/**
 * Borrowing against the policy rather than surrendering it.
 *
 * This is the option an advisor almost never has to hand. A customer who needs
 * money is told what surrender pays; nobody works out that the same policy will
 * lend them most of that and stay alive. Both numbers come off the same
 * surrender value, so there is no reason to have one without the other.
 */
export interface LoanPosition {
  /** Share of the surrender value that may be borrowed, as a percentage. */
  sharePct: number;
  /** Most that could be drawn today. */
  available: number;
  /** Interest rate, once a reference yield has been set. */
  ratePct: number | null;
  /** Why there is no rate, when there is none. */
  rateNote: string | null;
  /** Loan already drawn, including interest accrued on it. */
  outstanding: number;
  /** True once the loan has eaten enough of the value to force foreclosure. */
  forecloses: boolean;
}

/** What it costs to bring a lapsed policy back, and by when. */
export interface RevivalQuote {
  /** Instalments missed since the first unpaid premium. */
  missedInstalments: number;
  /** The premium arrears themselves, which need no rate to work out. */
  arrears: number;
  /** Interest on those arrears, once a reference yield has been set. */
  interest: number | null;
  /** Arrears plus interest, or the arrears alone while the rate is unset. */
  payable: number;
  /** Last date the policy can still be revived. */
  deadline: string | null;
  /** True once that date has passed and the policy can no longer come back. */
  expired: boolean;
  ratePct: number | null;
  rateNote: string | null;
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
  /** Policy year as at the date this was worked out. */
  currentYear: number | null;
  /** Policy years actually paid for, where that is fewer than the schedule assumes. */
  paidThrough: number | null;
  /** Share of the premium paying term actually paid. 1 while premiums are current. */
  paidUpFactor: number;
  /** How the special surrender value was arrived at. */
  ssvMethod: "present_value" | "factor_table";
  /** Borrowing against the policy instead of surrendering it. */
  loan: LoanPosition;
  /** What reviving costs, when the policy has lapsed. Null while it is in force. */
  revival: RevivalQuote | null;
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

/**
 * A rate quoted as a reference yield plus a fixed spread, rounded up to the
 * next 25 basis points.
 *
 * This is how the wordings define the policy loan rate, the interest charged on
 * revival and the discount rate behind the special surrender value. None of
 * them is a number the insurer picks: each is a formula on a published yield,
 * which is exactly why they can be computed here rather than read off a table.
 *
 * Returns null when no reference yield has been set, so every caller shows the
 * slot as pending instead of quoting a rate built on a guess.
 */
export function derivedRate(gSecYieldPct: number | null, spreadBps: number): number | null {
  if (gSecYieldPct === null || !Number.isFinite(gSecYieldPct)) return null;
  return Math.ceil((gSecYieldPct + spreadBps / 100) / 0.25) * 0.25;
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
 * The share of the base a surrender in policy year `year` pays.
 *
 * Up to year 7 the factor is read straight off the bands in the table. After
 * that the standard table interpolates, climbing from the year-7 level to the
 * top rate. The wording writes it as "50% + 40% x (year - 7) / (term - 8)",
 * which reaches the top rate in policy year term-1, not term-2.
 *
 * Ending the ramp at term-2 paid the top rate a year early and overstated every
 * value from year 8 on. Against the benefit illustration for HDFC Life Click 2
 * Achieve policy 27290434 (15-year term) it returned 90% in year 13 where the
 * insurer's own table pays 84%: on 14,00,000 of premiums that is 84,000 of
 * surrender value the customer would never have received.
 *
 * The interpolated factor is rounded to the nearest whole percent, which is how
 * these tables are filed and published and what reproduces that illustration
 * line for line. Without the rounding, year 9 lands about 6,000 out.
 */
function surrenderShare(year: number, term: number, bands: YearBandPct[]): number {
  if (year <= 7) return bandPct(bands, year) / 100;
  const top = bandPct(bands, 99) / 100;
  const mid = bandPct(bands, 7) / 100;
  // A short term leaves no room to interpolate; the floor keeps the span positive.
  const rampEnd = Math.max(term - 1, 8);
  if (year >= rampEnd) return top;
  return Math.round((mid + (top - mid) * ((year - 7) / (rampEnd - 7))) * 100) / 100;
}

/** Guaranteed surrender value share, as a fraction of the premiums paid. */
export function gsvShare(year: number, term: number, params: PolicyParams): number {
  return surrenderShare(year, term, params.gsvFactors.value);
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
  return surrenderShare(year, term, params.ssvFactors.value);
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
/**
 * Policy years completed between two dates, counted by anniversary.
 *
 * Not elapsed days over 365.2425: three calendar years from 16 March 2024 is
 * 1,095 days, which that division calls 2.998 and a floor then calls 2. Every
 * boundary in this file is an anniversary, so count anniversaries.
 *
 * Mirrors policyYearOn in ./policyBook, which returns this plus one. The two
 * have to agree or the book and the detail card show different policy years for
 * the same policy on the same day.
 */
function completedYears(start: Date, at: Date): number {
  let years = at.getFullYear() - start.getFullYear();
  const anniversary = new Date(start);
  anniversary.setFullYear(start.getFullYear() + years);
  if (anniversary > at) years -= 1;
  return Math.max(years, 0);
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
/**
 * Survival payouts falling inside a window, as dated cashflows.
 *
 * `reduce` scales the payouts falling after a date. A policy that stops being
 * paid for goes reduced paid-up, and the payouts still to come shrink to the
 * share of the premium paying term that was actually paid. The ones already
 * banked were paid in full and stay that way.
 */
function payoutFlows(
  amount: number, perYear: number, from: Date | null, to: Date | null, until: Date,
  reduce?: { after: Date; factor: number }
): { date: Date; amount: number }[] {
  if (!amount || !from) return [];
  const out: { date: Date; amount: number }[] = [];
  const stepMonths = Math.max(Math.round(12 / perYear), 1);
  const last = to && to < until ? to : until;
  for (let i = 0, d = new Date(from); d <= last && i < 1200; i++) {
    out.push({ date: new Date(d), amount: reduce && d > reduce.after ? amount * reduce.factor : amount });
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
        "The benefits below are reduced to what has actually been paid for, and go back up on revival.";
    }
  }

  const startDt = policyDate(start);

  /**
   * Policy years actually paid for.
   *
   * Premiums stop where the customer stopped, not where the schedule says they
   * should have: a policy in arrears has been paid up to the anniversary before
   * its first unpaid due date. Null while the policy is current, which means
   * "assume the schedule". Everything downstream reads this instead of assuming
   * the book stayed up to date, which is how a lapsed policy used to be shown
   * at its full in-force value with a line of text underneath apologising.
   */
  let paidThrough: number | null = null;
  // Only once the policy has actually gone paid-up. A premium a few weeks late
  // is still on risk and still revivable at full benefit, so reducing it there
  // would understate the cover at the exact moment the customer might claim.
  if (nextDue && startDt && premiumStatus === "paid_up") {
    paidThrough = Math.min(completedYears(startDt, nextDue), ppt);
  }

  /**
   * Reduced paid-up proportion: the share of the premium paying term bought and
   * paid for. Once premiums stop the benefits do not stay where they were, they
   * reduce to this share. Showing a lapsed policy's full sum assured is the most
   * misleading thing this screen could do, because it is the number the customer
   * would be told they had lost.
   */
  const paidUpFactor = paidThrough === null ? 1 : Math.min(paidThrough / ppt, 1);
  /** Payouts still to come shrink to the paid-up share; banked ones do not. */
  const lapseReduce =
    paidUpFactor < 1 && nextDue ? { after: nextDue, factor: paidUpFactor } : undefined;

  /** Policy year as at the date this is being worked out. */
  const currentYear = startDt
    ? Math.min(Math.max(completedYears(startDt, asOf) + 1, 1), term!)
    : null;

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
      flows.push(...payoutFlows(payoutAmount, payoutsPerYear, payoutStart, payoutEnd, exitOn, lapseReduce));
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

  /**
   * Years that must complete before any surrender value exists: two under the
   * old convention, one under the IRDAI (Insurance Products) Regulations 2024,
   * which bind products offered from 1 October 2024.
   *
   * Resolved from the policy's own start date rather than one setting applied to
   * the whole book, because a real book spans the change and both sides of it
   * have to be right. A value read off the document or typed in by the agent
   * always wins over this.
   */
  const acquiresAfter =
    params.surrenderAcquiresAfterYears.source === "default" && startDt
      ? (startDt >= new Date(2024, 9, 1) ? 1 : 2)
      : params.surrenderAcquiresAfterYears.value;
  const acquired = (y: number) => y >= acquiresAfter;

  const loanShare = params.loanValuePct.value / 100;
  const ssvRate = derivedRate(params.gSecYieldPct.value, params.ssvSpreadBps.value);
  const ssvMethod: "present_value" | "factor_table" =
    ssvRate === null ? "factor_table" : "present_value";

  /**
   * Special surrender value: the present value of what the policy would still
   * pay if it were made paid-up today, discounted at the reference yield plus
   * the filed spread.
   *
   * This is what the regulations actually define, and what the insurer does. The
   * banded factor table is only a shape fitted to it, and says so. Returns null
   * until a reference yield is set, so the caller falls back to the table rather
   * than discounting at a rate nobody chose.
   */
  const ssvPresentValue = (
    fromYear: number, maturityAtEnd: number, payoutScale: number
  ): number | null => {
    if (ssvRate === null) return null;
    const per = 1 + ssvRate / 100;
    let pv = maturityAtEnd > 0 ? maturityAtEnd / Math.pow(per, Math.max(term! - fromYear, 0)) : 0;
    if (startDt && payoutAmount > 0 && payoutScale > 0) {
      const from = addMonths(startDt, fromYear * 12);
      const until = addMonths(startDt, term! * 12);
      for (const f of payoutFlows(payoutAmount, payoutsPerYear, payoutStart, payoutEnd, until, lapseReduce)) {
        if (f.date <= from) continue;
        const t = (f.date.getTime() - from.getTime()) / (365.2425 * 86400000);
        pv += (f.amount * payoutScale) / Math.pow(per, t);
      }
    }
    return pv;
  };

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
        // Unit linked plans are not lent against, so there is no loan line here.
        maxLoan: 0,
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
      // Premiums stop where the customer stopped, not where the schedule says.
      const paidYears = Math.min(y, ppt, paidThrough ?? ppt);
      const paid = annualPremium * paidYears;
      // Share of the premium paying term paid for by now. Every benefit on a
      // policy that stopped early reduces to this, and so does the base the
      // special surrender value is a present value of.
      const puShare = Math.min(paidYears / ppt, 1);
      let receivedSoFar = 0;
      let value = 0;
      let back = 0;
      let cover = sumAssured;
      let note = "";

      if (shape === "pure_term") {
        if (paidUpFactor < 1) {
          // Term cover acquires no paid-up value, so stopping the premiums does
          // not reduce the cover, it ends it. Saying so is the whole point.
          cover = 0;
          note = "Cover has stopped. Term insurance builds no paid-up value, so nothing is payable until it is revived.";
        } else {
          note = "Term cover pays nothing on surrender or on survival.";
        }
      }

      if (shape === "return_of_premium") {
        value = paid;
        const gsv = acquired(y) ? gsvShare(y, term!, params) * paid : 0;
        // The benefit still to come is the refund of the premiums actually paid,
        // so its present value is the special surrender value on this shape.
        const ssv = acquired(y) ? ssvPresentValue(y, paid, 0) ?? 0 : 0;
        back = y === term ? paid : Math.max(gsv, ssv);
        cover = Math.max(sumAssured * paidUpFactor, floor * paid);
        note =
          !acquired(y)
            ? `No surrender value until ${acquiresAfter} policy ${acquiresAfter === 1 ? "year is" : "years are"} complete.`
            : y === term
            ? "Every premium paid is returned at maturity."
            : ssv > gsv
            ? "Present value of the premium refund still to come, which beats the guaranteed table here."
            : `${Math.round(gsvShare(y, term!, params) * 100)}% of the premiums paid so far.`;
      }

      if (shape === "money_back") {
        // Survival payouts already received by the end of this policy year.
        const begin = policyDate(start);
        const received = begin
          ? payoutFlows(payoutAmount, payoutsPerYear, payoutStart, payoutEnd, addMonths(begin, y * 12), lapseReduce)
              .reduce((sum, p) => sum + p.amount, 0)
          : payoutPerYear * y;
        // The maturity amount is whatever the schedule states. We do not derive
        // it from the sum assured, because they are different numbers.
        const matAmount = (statedMaturity ?? sumAssured) * paidUpFactor;
        // Surrender pays the guaranteed value on premiums, less what has already
        // been handed over as survival benefit — the standard treatment, and what
        // the insurer's own formula does. Paying the gross figure counted every
        // payout twice: once when it reached the customer, again on surrender.
        const gsv = acquired(y) ? gsvShare(y, term!, params) * paid : 0;
        // The special surrender value discounts what is still to come: the
        // payouts left plus the maturity amount, both at the paid-up share.
        const ssv = acquired(y) ? ssvPresentValue(y, matAmount, puShare) ?? 0 : 0;
        value = received + (y === term ? matAmount : gsv);
        back = y === term ? matAmount : Math.max(gsv - received, ssv);
        receivedSoFar = received;
        cover = Math.max(sumAssured * paidUpFactor, floor * paid);
        note =
          y === term
            ? `Maturity amount of ${Math.round(matAmount).toLocaleString("en-IN")} as stated on the schedule.`
            : !acquired(y)
            ? `No surrender value until ${acquiresAfter} policy ${acquiresAfter === 1 ? "year is" : "years are"} complete.`
            : ssv > gsv - received
            ? "Present value of the payouts and maturity still to come, which beats the guaranteed table here."
            : `Plus ${Math.round(received).toLocaleString("en-IN")} of payouts already received by then.`;
      }

      if (shape === "endowment") {
        // Bonus accrues on the cover actually in force, so it stops where the
        // premiums did rather than running on to the full term.
        const bonus = params.bonusPer1000.value * (sumAssured / 1000) * Math.min(y, paidThrough ?? y);
        const paidUp = sumAssured * puShare;
        // Present value of the paid-up benefit where a rate is set, the banded
        // factor table where it is not.
        const ssv = ssvPresentValue(y, paidUp + bonus, 0) ?? (paidUp + bonus) * ssvShare(y, term!, params);
        // Gated like every other shape. This was the one branch that paid a
        // guaranteed surrender value before one had been acquired at all, which
        // a filed table with a year-one factor would have exposed.
        const gsv = acquired(y) ? gsvShare(y, term!, params) * paid : 0;
        value = paidUp + bonus;
        back = y === term
          ? ((statedMaturity ?? sumAssured + bonus) * paidUpFactor)
          : Math.max(gsv, acquired(y) ? ssv : 0);
        cover = Math.max(sumAssured * paidUpFactor, floor * paid) + bonus;
        if (params.bonusPer1000.value > 0) guaranteed = false;
        note =
          !acquired(y)
            ? `No surrender value until ${acquiresAfter} policy ${acquiresAfter === 1 ? "year is" : "years are"} complete.`
            : y === term
            ? "Sum assured plus the bonus accrued."
            : ssv > gsv
            ? "Paid-up value with bonus, which beats the guaranteed table here."
            : "Higher of the guaranteed value and the paid-up value with bonus.";
      }

      rows.push({
        year: y,
        age: entryAge === null ? null : entryAge + y,
        paid, value, penalty: 0, back, cover, received: receivedSoFar, deferredTo: null, note,
        maxLoan: shape === "pure_term" ? 0 : Math.max(back, 0) * loanShare,
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
      steps.push(
        "Surrender before the end pays the guaranteed surrender value on the premiums paid, less the " +
          "payouts already handed over. Those stay with the customer either way."
      );
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

  if (paidUpFactor < 1) {
    steps.push(
      `Premiums stopped after ${paidThrough} of the ${ppt} years payable, so the policy is reduced paid-up: ` +
        `every benefit above is ${Math.round(paidUpFactor * 100)}% of what it would have been. Reviving it puts them back.`
    );
  }
  if (shape !== "pure_term" && shape !== "unit_linked") {
    steps.push(
      `Surrender is not the only way to get at the money: up to ${params.loanValuePct.value}% of the ` +
        "surrender value can be borrowed against the policy, which keeps the cover alive."
    );
  }

  /* Borrowing against the policy rather than giving it up. Both numbers come off
     the same surrender value, so there is no reason to show one without the other. */
  const currentRow = currentYear ? rows[Math.min(currentYear, term!) - 1] ?? null : null;
  const loanRate = derivedRate(params.gSecYieldPct.value, params.loanSpreadBps.value);
  const outstanding = params.outstandingLoan.value;
  const loan: LoanPosition = {
    sharePct: params.loanValuePct.value,
    available: Math.max((currentRow?.maxLoan ?? 0) - outstanding, 0),
    ratePct: shape === "pure_term" || shape === "unit_linked" ? null : loanRate,
    rateNote:
      shape === "pure_term"
        ? "Term cover has no surrender value, so there is nothing to lend against."
        : shape === "unit_linked"
        ? "Unit linked plans are not lent against."
        : loanRate === null
        ? "Set the reference G-Sec yield on this policy to work out the loan rate."
        : null,
    outstanding,
    forecloses:
      outstanding > 0 && currentRow
        ? outstanding > (params.foreclosureAtPct.value / 100) * currentRow.back
        : false,
  };

  /* What it costs to bring a lapsed policy back. The arrears need no rate at all,
     so they are quoted even while the interest is pending, and the deadline is
     the number that actually decides whether the advisor picks up the phone. */
  let revival: RevivalQuote | null = null;
  if ((premiumStatus === "overdue" || premiumStatus === "paid_up") && nextDue) {
    const monthsApart = 12 / perYear;
    const pptEndIso = addYears(start, ppt);
    const pptEnd = pptEndIso ? policyDate(pptEndIso) : null;
    const missed: Date[] = [];
    for (let i = 0; i < 600; i++) {
      const due = addMonths(nextDue, monthsApart * i);
      if (due > asOf) break;
      // Nothing is owed for a premium that was never payable in the first place.
      if (pptEnd && due >= pptEnd) break;
      missed.push(due);
    }
    const arrears = missed.length * instalment;
    const revivalRate = derivedRate(params.gSecYieldPct.value, params.revivalSpreadBps.value);
    const interest =
      revivalRate === null
        ? null
        : missed.reduce((sum, due) => {
            const yrs = (asOf.getTime() - due.getTime()) / (365.2425 * 86400000);
            return sum + instalment * (Math.pow(1 + revivalRate / 100, yrs) - 1);
          }, 0);
    const windowEnd = addYears(isoDate(nextDue), params.revivalWindowYears.value);
    const policyEnd = addYears(start, term!);
    const deadline =
      windowEnd && policyEnd ? (windowEnd < policyEnd ? windowEnd : policyEnd) : windowEnd ?? policyEnd;
    const deadlineDate = deadline ? policyDate(deadline) : null;
    revival = {
      missedInstalments: missed.length,
      arrears,
      interest,
      payable: arrears + (interest ?? 0),
      deadline,
      expired: deadlineDate ? asOf > deadlineDate : false,
      ratePct: revivalRate,
      rateNote:
        revivalRate === null
          ? "Set the reference G-Sec yield on this policy to work out the interest on the arrears."
          : null,
    };
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
    currentYear, paidThrough, paidUpFactor, ssvMethod, loan, revival,
  };
}

export function isValueGap(v: ValueSchedule | ValueGap): v is ValueGap {
  return (v as ValueGap).missing !== undefined;
}
