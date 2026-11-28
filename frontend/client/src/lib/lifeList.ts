/**
 * Rows for the advisor portal's Life section (/agent/life).
 *
 * Display only. Every figure here is either read from the policy document or
 * a date worked out from what it says. Nothing is scored, rated or recommended.
 *
 *  - Next premium: lib/lifePremium (the same rule Home uses), worked out on
 *    the day the list is opened. Labelled "as stated" only when the reader
 *    recorded that the document states it, "by schedule" when it was rolled from
 *    the start date and frequency, "unconfirmed" on an older read that kept a
 *    date without saying where it came from, and "as printed" when the frequency could not be read (the date
 *    is shown once and may be in the past).
 *  - Maturity (life) or cover end (term): the read's own date, else the other
 *    one, else `expiry_date`, which holds the same date on a life or term row.
 *  - Type suggestion: Life and Term are tags the advisor picks at upload and can
 *    change. This only SUGGESTS a change (founder decision D2), when the read
 *    itself says the plan is the other kind. It never changes the type.
 */

import { nextLifePremium, type LifePremiumDue } from "./lifePremium";
import { readFrequency } from "./policyValue";

export type LifeType = "life" | "term";

export interface LifeSourceRow {
  id: string;
  name?: string | null;
  policyholder_name?: string | null;
  insurer?: string | null;
  policy_name?: string | null;
  insurance_type?: string | null;
  status?: string | null;
  expiry_date?: string | null;
  extracted_data?: Record<string, any> | null;
}

export type DueBasis = "stated" | "schedule" | "unconfirmed" | "printed";
/** Why there is no next premium. "not_read" is not the same as nothing due. */
export type NoDue = "single" | "term_over" | "not_read";

export interface LifeListRow {
  id: string;
  type: LifeType;
  clientName: string;
  insurer: string | null;
  planName: string | null;
  policyNumber: string | null;
  sumAssured: number | null;
  premium: number | null;
  frequency: string | null;
  /** Next premium. When null, `noDue` says why. */
  due: (LifePremiumDue & { basis: DueBasis }) | null;
  /** Set only when `due` is null. */
  noDue: NoDue | null;
  /** Maturity date (life) or cover end date (term), YYYY-MM-DD. */
  endDate: string | null;
  /** The read says this is the other kind of plan. Never applied automatically. */
  suggest: LifeType | null;
  status: string;
}

const clean = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
};

const amount = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Accepts YYYY-MM-DD (with or without a time part). Anything else is not a date we show. */
const isoDate = (v: unknown): string | null => {
  const s = clean(v);
  const m = s?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};

const sameDay = (a: Date, iso: string | null) => {
  if (!iso) return false;
  const [y, m, d] = iso.split("-").map(Number);
  return a.getFullYear() === y && a.getMonth() === m - 1 && a.getDate() === d;
};

const NOT_PURE_TERM = /return of premium|\brop\b|endowment|money ?back|saving|guarantee|income|unit.?linked|ulip|whole life|pension|annuity|child/i;
const LIFE_PLAN = /endowment|money ?back|saving|guaranteed (income|return|benefit)|unit.?linked|ulip|whole life|pension|annuity/i;

/**
 * The other type, when the read says so. Conservative on purpose: a blank or
 * ambiguous read suggests nothing.
 *  - life -> term: plan_type is plain "term" (not return of premium or a savings
 *    plan), or a maturity amount of 0 read with the words it came from.
 *  - term -> life: plan_type names a savings, income or unit-linked plan, or the
 *    read found a maturity, payout, bonus or fund value. A return-of-premium term
 *    plan stays term: its premiums come back, but it is sold and kept as cover.
 */
export function suggestLifeType(type: LifeType, data: Record<string, any> | null | undefined): LifeType | null {
  const d = data ?? {};
  const planType = clean(d.plan_type) ?? "";
  if (type === "life") {
    const plainTerm = /\bterm\b/i.test(planType) && !NOT_PURE_TERM.test(planType);
    const zeroMaturity = (d.maturity_amount === 0 || d.maturity_amount === "0") && !!clean(d.field_sources?.maturity_amount?.excerpt);
    return plainTerm || zeroMaturity ? "term" : null;
  }
  const lifePlan = LIFE_PLAN.test(planType) && !/return of premium|\brop\b/i.test(planType);
  const benefit = [d.maturity_amount, d.payout_amount, d.bonus_per_1000, d.fund_value].some((v) => amount(v) !== null);
  return lifePlan || benefit ? "life" : null;
}

export function toLifeRow(src: LifeSourceRow, today: Date): LifeListRow | null {
  const type = src.insurance_type === "term" ? "term" : src.insurance_type === "life" ? "life" : null;
  if (!type) return null;
  const d = src.extracted_data ?? {};
  const due = nextLifePremium(
    { next: d.next_premium_date, start: d.start_date, freq: d.premium_frequency, ppt: d.premium_paying_term_years },
    today,
  );
  const stated = isoDate(d.next_premium_date);
  const basis: DueBasis = due?.kind === "printed"
    ? "printed"
    : !due || !sameDay(due.date, stated) || d.next_premium_date_basis === "schedule" ? "schedule"
    : d.next_premium_date_basis === "stated" ? "stated" : "unconfirmed";
  const noDue: NoDue | null = due ? null
    : readFrequency(d.premium_frequency) === "single" ? "single"
    : !isoDate(d.next_premium_date) && !isoDate(d.start_date) ? "not_read"
    : "term_over";
  const own = type === "life" ? d.maturity_date : d.cover_end_date;
  const other = type === "life" ? d.cover_end_date : d.maturity_date;
  return {
    id: src.id,
    type,
    clientName: clean(src.policyholder_name) ?? clean(src.name) ?? clean(d.policyholder_name) ?? "",
    insurer: clean(src.insurer) ?? clean(d.insurer),
    planName: clean(src.policy_name) ?? clean(d.plan_name),
    policyNumber: clean(d.policy_number),
    sumAssured: amount(d.sum_assured),
    premium: amount(d.premium),
    frequency: clean(d.premium_frequency),
    due: due ? { ...due, basis } : null,
    noDue,
    endDate: isoDate(own) ?? isoDate(other) ?? isoDate(src.expiry_date),
    suggest: suggestLifeType(type, d),
    status: clean(src.status) ?? "done",
  };
}

/** Whole days from today to an ISO date (negative once it has passed). */
export function daysUntil(iso: string | null, today: Date): number | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((new Date(y, m - 1, d).getTime() - t0.getTime()) / 86_400_000);
}

export const PREMIUM_DUE_DAYS = 30;
export const MATURING_DAYS = 90;

export function premiumDueSoon(r: LifeListRow, today: Date): boolean {
  if (!r.due || r.due.kind === "printed") return false;
  const days = daysUntil(isoOf(r.due.date), today);
  return days !== null && days <= PREMIUM_DUE_DAYS && (days >= 0 || r.due.kind === "passed");
}

export function maturingSoon(r: LifeListRow, today: Date): boolean {
  const days = daysUntil(r.endDate, today);
  return days !== null && days >= 0 && days <= MATURING_DAYS;
}

function isoOf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export interface LifeStats {
  life: number;
  term: number;
  premiumDue: number;
  maturing: number;
}

/** Counts only. No rupee totals: the figures come on different bases (D5). */
export function lifeStats(rows: LifeListRow[], today: Date): LifeStats {
  return {
    life: rows.filter((r) => r.type === "life").length,
    term: rows.filter((r) => r.type === "term").length,
    premiumDue: rows.filter((r) => premiumDueSoon(r, today)).length,
    maturing: rows.filter((r) => maturingSoon(r, today)).length,
  };
}
