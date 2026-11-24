/**
 * Home: the rules behind the advisor's landing page.
 *
 * Home merges the old Dashboard, Insights and Business screens. The money rules
 * stay in lib/business.ts (toMoney, renewalBuckets); this file adds the one
 * thing those screens never agreed on: WHEN a policy falls due. Every renewal
 * list, the "due in 30 days" tile and the family "next due" read it from here,
 * so the numbers on the page cannot disagree with each other.
 *
 *  - Health, motor, property and the rest renew on `expiry_date`.
 *  - Life and term: `expiry_date` is MATURITY, never a premium date. The due
 *    date is `next_premium_date` (else the start date), rolled forward by the
 *    frequency, stopping when the paying term ends. With no readable frequency
 *    the printed next date is used once and never rolled.
 *  - Travel, marine and contractor's all risk are paid once. They never renew
 *    on a cycle, so they are never in a renewal list.
 *  - A policy with no premium on record is still listed. Its amount is null:
 *    shown as "Premium not read", never summed as zero.
 *  - Late = the due date passed in the last 30 days. For health and motor that
 *    is a renewal still to do. For life and term it only means the printed
 *    premium date has passed: we hold no receipts, so the page says "check it
 *    was paid", not "late".
 *  - Renewed-copy guard: an advisor who renews a policy usually uploads the
 *    new PDF. The old row then sits expired beside it. A late row is dropped
 *    when the same family holds a policy of the same type that runs longer.
 */

import { ADD_ON_FINDINGS_KEY } from "@shared/motorAddOns";
import { readFrequency } from "@/lib/policyValue";
import { LATE_WINDOW_DAYS, nextLifePremium } from "@/lib/lifePremium";
import { ONE_TIME_TYPES, inForce, parseAmount, toMoney, type BusinessRow, type PolicyMoney } from "@/lib/business";

const DAY = 86_400_000;
const LIFE_TYPES = new Set(["life", "term"]);
/** How far back a missed due date stays on the page (shared with lib/lifePremium). */
export { LATE_WINDOW_DAYS };
/** "This week" = late + the next 7 days; "this month" = days 8 to 30. */
export const WEEK_DAYS = 7;
export const MONTH_DAYS = 30;

export const HOME_SELECT = [
  "id", "insurance_type", "insurer", "sum_insured", "expiry_date", "customer_id",
  "policyholder_name", "name", "policy_name", "created_at", "score",
  "x_premium:extracted_data->premium",
  "x_annual:extracted_data->annualised_premium",
  "x_freq:extracted_data->>premium_frequency",
  "x_next:extracted_data->>next_premium_date",
  "x_start:extracted_data->>start_date",
  "x_ppt:extracted_data->premium_paying_term_years",
  `x_addons:extracted_data->${ADD_ON_FINDINGS_KEY}`,
  "x_cov:extracted_data->>coverage_type",
  "h_premium:report_data->premium",
].join(", ");

/** The narrow row Home selects. Business columns plus what the lists show. */
export type HomeRow = BusinessRow & {
  policyholder_name: string | null;
  name: string | null;
  policy_name: string | null;
  created_at: string;
  score: number | null;
  x_addons: unknown;
  x_cov: string | null;
};

export type Frequency = number | null;

export type Due = {
  row: HomeRow;
  type: string;
  date: Date;
  /** Whole days from today; negative = passed. */
  days: number;
  /** Amount due on that date, null when no premium is on record. */
  amount: number | null;
  /** Instalments a year, when known. Life and term show it beside the amount. */
  perYear: Frequency;
  /** Life and term: a premium date, not a renewal. */
  premiumDate: boolean;
  /** Shown but never summed: the frequency is unknown, so the amount may not be yearly. */
  uncounted?: boolean;
};

function parseDate(raw: unknown): Date | null {
  if (!raw) return null;
  const d = new Date(String(raw));
  return Number.isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY);
}

/** Who a policy belongs to, for grouping: the family if linked, else the printed name. */
export function familyKey(r: HomeRow): string | null {
  if (r.customer_id) return `c:${r.customer_id}`;
  const n = (r.policyholder_name || r.name || "").trim().toLowerCase().replace(/\s+/g, " ");
  return n ? `n:${n}` : null;
}

/**
 * The next date this policy needs the advisor, inside [today - 30, today + 30],
 * or null when it is outside that window, has no date, or never renews.
 */
export function dueOf(r: HomeRow, today: Date, ahead: number = MONTH_DAYS): Due | null {
  const type = r.insurance_type || "health";
  if (ONE_TIME_TYPES.has(type)) return null;
  const t0 = startOfDay(today);
  const earliest = addDays(t0, -LATE_WINDOW_DAYS);
  const latest = addDays(t0, ahead);
  const inWindow = (d: Date) => d.getTime() >= earliest.getTime() && d.getTime() <= latest.getTime();
  const make = (date: Date, amount: number | null, perYear: Frequency, premiumDate: boolean): Due =>
    ({ row: r, type, date, days: daysBetween(t0, date), amount, perYear, premiumDate });

  if (LIFE_TYPES.has(type)) {
    // The date itself comes from lib/lifePremium, shared with the Policies list.
    // A yearly or half-yearly date that passed in the last 30 days comes back as
    // "passed", so the advisor checks it was paid. Monthly and quarterly roll
    // straight to the next instalment: that is the one worth a call.
    const due = nextLifePremium({ next: r.x_next, start: r.x_start, freq: r.x_freq, ppt: r.x_ppt }, t0);
    if (!due) return null;
    const perYear: Frequency = due.perYear;
    const printed = parseAmount(r.x_premium);
    const annual = parseAmount(r.x_annual);
    const instalment = perYear ? (annual != null ? annual / perYear : printed) : printed;

    if (due.kind === "passed") return make(due.date, instalment, perYear, true);
    // No readable frequency: show the printed date once, but its amount is not
    // summed anywhere (lib/business.ts leaves the same policy out of the chart).
    if (due.kind === "printed") {
      return inWindow(due.date) && due.date.getTime() >= t0.getTime()
        ? { ...make(due.date, instalment, null, true), uncounted: true }
        : null;
    }
    return inWindow(due.date) ? make(due.date, instalment, perYear, true) : null;
  }

  const renews = parseDate(r.expiry_date);
  if (!renews || !inWindow(renews)) return null;
  const amount = type === "health" ? parseAmount(r.h_premium?.amount ?? r.x_premium) : parseAmount(r.x_premium);
  const freq = readFrequency(type === "health" ? r.h_premium?.frequency ?? r.x_freq : r.x_freq);
  // A multi-year single premium is not what this renewal will cost; leave it unread.
  const yearly = amount == null || freq === "single" ? null : amount * (freq ?? 1);
  return make(renews, yearly, 1, false);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Same policy, renewed: same family, type, insurer and plan name. Two cars or a
 *  base plan plus a super top-up differ in plan name (or insurer), so they stay apart. */
function renewalKey(r: HomeRow): string | null {
  const fam = familyKey(r);
  if (!fam) return null;
  const norm = (s: string | null) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
  return `${fam}|${r.insurance_type || "health"}|${norm(r.insurer)}|${norm(r.policy_name)}`;
}

/** Every policy due in the window, soonest first, with renewed copies removed. */
export function dueList(
  rows: HomeRow[],
  today: Date,
  /** `ahead`: days forward (Home uses 30). `replaced`: policies with a newer one linked to them. */
  opts: { ahead?: number; replaced?: Set<string> } = {},
): Due[] {
  // Expiry dates per renewal key, to spot a row whose renewal is already on file:
  // another copy of the same policy expiring about a year after this one.
  const expiries = new Map<string, number[]>();
  for (const r of rows) {
    if (LIFE_TYPES.has(r.insurance_type || "health")) continue;
    const key = renewalKey(r);
    const end = parseDate(r.expiry_date);
    if (!key || !end) continue;
    expiries.set(key, [...(expiries.get(key) ?? []), end.getTime()]);
  }
  const renewedAlready = (d: Due) => {
    const key = renewalKey(d.row);
    const ends = key ? expiries.get(key) : undefined;
    if (!ends) return false;
    return ends.some((e) => {
      const gap = (e - d.date.getTime()) / DAY;
      return gap >= 300 && gap <= 430;
    });
  };
  const out: Due[] = [];
  for (const r of rows) {
    if (opts.replaced?.has(r.id)) continue;
    const d = dueOf(r, today, opts.ahead);
    if (!d) continue;
    if (!d.premiumDate && renewedAlready(d)) continue;
    out.push(d);
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function splitDue(list: Due[]) {
  const week = list.filter((d) => d.days <= WEEK_DAYS);
  const month = list.filter((d) => d.days > WEEK_DAYS && d.days <= MONTH_DAYS);
  return { week, month };
}

export function sumDue(list: Due[]): { amount: number; priced: number } {
  let amount = 0;
  let priced = 0;
  for (const d of list) {
    if (d.amount == null || d.uncounted) continue;
    amount += d.amount;
    priced++;
  }
  return { amount: Math.round(amount), priced };
}

/** Birthdays in the next `days` days, today included. dob is YYYY-MM-DD. */
export function upcomingBirthdays<T extends { dob: string | null }>(people: T[], today: Date, days = WEEK_DAYS) {
  const t0 = startOfDay(today);
  const out: { person: T; date: Date; days: number }[] = [];
  for (const p of people) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(p.dob ?? "");
    if (!m) continue;
    const month = Number(m[2]) - 1;
    const day = Number(m[3]);
    let next = new Date(t0.getFullYear(), month, day);
    if (next.getTime() < t0.getTime()) next = new Date(t0.getFullYear() + 1, month, day);
    const n = daysBetween(t0, next);
    if (n <= days) out.push({ person: p, date: next, days: n });
  }
  return out.sort((a, b) => a.days - b.days);
}

/** The in-force book as money, plus the facts the stat tiles and cards need. */
export function summarise(rows: HomeRow[], today: Date) {
  const live = rows.filter((r) => inForce(r, today));
  const money: PolicyMoney[] = live.map((r) => toMoney(r, today));
  const priced = money.filter((p) => p.yearly != null);
  const totalPremium = priced.reduce((a, p) => a + (p.yearly ?? 0), 0);
  const totalCover = money.reduce((a, p) => a + (p.cover ?? 0), 0);
  const families = new Set(money.map((p) => p.customerId).filter(Boolean) as string[]);
  // "About ₹X a year each": only premium that belongs to a family, over those families.
  const familyPriced = priced.filter((p) => p.customerId);
  const familyPremium = familyPriced.reduce((a, p) => a + (p.yearly ?? 0), 0);
  const pricedFamilies = new Set(familyPriced.map((p) => p.customerId as string));
  const weekAgo = today.getTime() - 7 * DAY;
  const addedThisWeek = live.filter((r) => new Date(r.created_at).getTime() >= weekAgo).length;

  // Premium and count by type, largest premium first. Life and term stay apart.
  const byType = new Map<string, { premium: number; count: number }>();
  for (const p of money) {
    const cur = byType.get(p.type) ?? { premium: 0, count: 0 };
    cur.count++;
    cur.premium += p.yearly ?? 0;
    byType.set(p.type, cur);
  }
  const typeRows = Array.from(byType.entries()).sort((a, b) => b[1].premium - a[1].premium || b[1].count - a[1].count);

  const byInsurer = new Map<string, number>();
  for (const p of priced) byInsurer.set(p.insurer, (byInsurer.get(p.insurer) ?? 0) + (p.yearly ?? 0));
  const topInsurers = Array.from(byInsurer.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);

  // Families: premium, types held, policies.
  const fam = new Map<string, PolicyMoney[]>();
  for (const p of money) {
    if (!p.customerId) continue;
    fam.set(p.customerId, [...(fam.get(p.customerId) ?? []), p]);
  }
  const familyRows = Array.from(fam.entries()).map(([id, ps]) => ({
    id,
    policies: ps.length,
    premium: ps.reduce((a, p) => a + (p.yearly ?? 0), 0),
    types: Array.from(new Set(ps.map((p) => p.type))),
  }));
  const topFamilies = familyRows.filter((f) => f.premium > 0).sort((a, b) => b.premium - a.premium).slice(0, 5);
  const healthNoTerm = familyRows.filter((f) => f.types.includes("health") && !f.types.includes("term"));

  // Weak cover is a judgement about health WORDING, so it stays a health list.
  const weakHealth = live.filter(
    (r) => (r.insurance_type || "health") === "health" && typeof r.score === "number" && r.score < 70,
  );

  return {
    inForce: live.length,
    expired: rows.length - live.length,
    noDate: live.filter((r) => {
      const ty = r.insurance_type || "health";
      if (ONE_TIME_TYPES.has(ty)) return false;
      return LIFE_TYPES.has(ty) ? !r.x_next && !r.x_start : !r.expiry_date;
    }).length,
    priced: priced.length,
    missingPremium: money.filter((p) => p.status === "missing").length,
    noFamily: money.filter((p) => !p.customerId).length,
    totalPremium,
    totalCover,
    families: families.size,
    perFamily: pricedFamilies.size ? familyPremium / pricedFamilies.size : null,
    addedThisWeek,
    typeRows,
    topInsurers,
    topFamilies,
    healthNoTerm,
    weakHealth,
    money,
  };
}
