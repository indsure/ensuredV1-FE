/**
 * Business: the book in rupees.
 *
 * Pure helpers behind pages/agent/Business.tsx, kept out of the component so the
 * money rules sit in one readable place. The page's foot note states them too.
 *
 *  - The premium is the one PRINTED on the policy. We store no receipts and no
 *    commission, so nothing here may be called "collected" or "earned".
 *  - Data entry stores `premium` as the amount of each instalment, exactly as
 *    stated, and `annualised_premium` only when the document states a yearly
 *    total (backend/server/services/extractionFields.ts). A health check stores
 *    `report_data.premium = { amount, frequency }` (promptTemplate.ts). Ignore
 *    `report_data.policy_commercials`: no prompt fills it.
 *  - Only policies IN FORCE count. An expired health or motor row usually sits
 *    beside the renewal that replaced it, so counting both doubles the book.
 *  - Travel, marine and contractor's all risk are paid once per trip or project.
 *    They are not yearly money and never renew on a cycle, so they sit outside
 *    the yearly total and the renewal chart, as their own one-time figure.
 *  - Life and term: `expiry_date` is the MATURITY or cover end date, never a
 *    premium date. Due dates come from `next_premium_date` (or the start date),
 *    rolled forward by the frequency, and stop when the paying term ends.
 *    A life premium with no readable frequency is not guessed at.
 */

import { readFrequency } from "@/lib/policyValue";

export const ONE_TIME_TYPES = new Set(["travel", "marine", "contractor_all_risk"]);
const LIFE_TYPES = new Set(["life", "term"]);
const DAY = 86_400_000;

/** A rupee amount from a number or printed text ("23,456", "₹ 18,000.00"). */
export function parseAmount(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseDate(raw: unknown): Date | null {
  if (!raw) return null;
  const d = new Date(String(raw));
  return Number.isNaN(d.getTime()) ? null : d;
}

function addMonths(d: Date, months: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + months, d.getDate());
}

/** The narrow row the page selects. Never the whole report_data. */
export type BusinessRow = {
  id: string;
  insurance_type: string | null;
  insurer: string | null;
  sum_insured: number | string | null;
  expiry_date: string | null;
  customer_id: string | null;
  x_premium: unknown;
  x_annual: unknown;
  x_freq: string | null;
  x_next: string | null;
  x_start: string | null;
  x_ppt: unknown;
  h_premium: { amount?: unknown; frequency?: unknown } | null;
};

export type Status =
  | "yearly"     // counted in the yearly total
  | "one_time"   // travel / marine / CAR: counted on its own
  | "single"     // one payment for many years: not yearly money
  | "paid_up"    // life premium term is over: nothing more to pay
  | "unclear"    // life premium with no readable frequency
  | "missing";   // no premium on record

export type PolicyMoney = {
  id: string;
  type: string;
  insurer: string;
  cover: number | null;
  customerId: string | null;
  status: Status;
  /** Yearly premium when status is "yearly", else null. */
  yearly: number | null;
  /** The printed amount for a one-time policy. */
  oneTime: number | null;
  /** Health premium with no stated frequency, counted as yearly. */
  assumedYearly: boolean;
  /** Money falling due in the 12 months from `today`, instalment by instalment. */
  dues: { date: Date; amount: number }[];
};

/** Is the policy still running? Expired rows are left out of the page entirely. */
export function inForce(r: BusinessRow, today: Date): boolean {
  const end = parseDate(r.expiry_date);
  return !end || end.getTime() >= today.getTime() - DAY;
}

export function toMoney(r: BusinessRow, today: Date): PolicyMoney {
  const type = r.insurance_type || "health";
  const base: PolicyMoney = {
    id: r.id,
    type,
    insurer: (r.insurer || "").trim() || "Not recorded",
    cover: parseAmount(r.sum_insured),
    customerId: r.customer_id,
    status: "missing",
    yearly: null,
    oneTime: null,
    assumedYearly: false,
    dues: [],
  };
  const horizon = addMonths(today, 12);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (ONE_TIME_TYPES.has(type)) {
    const amount = parseAmount(r.x_premium);
    return amount == null ? base : { ...base, status: "one_time", oneTime: amount };
  }

  if (LIFE_TYPES.has(type)) {
    const amount = parseAmount(r.x_premium);
    const annual = parseAmount(r.x_annual);
    if (amount == null && annual == null) return base;
    const freq = readFrequency(r.x_freq);
    if (freq === "single") return { ...base, status: "single" };
    if (freq == null) return { ...base, status: "unclear" };

    const commenced = parseDate(r.x_start);
    const ppt = parseAmount(r.x_ppt);
    const payingEnds = commenced && ppt ? addMonths(commenced, Math.round(ppt * 12)) : null;
    if (payingEnds && payingEnds.getTime() <= start.getTime()) return { ...base, status: "paid_up" };

    const yearly = annual ?? (amount as number) * freq;
    const instalment = yearly / freq;
    const step = 12 / freq;
    const dues: PolicyMoney["dues"] = [];
    let d = parseDate(r.x_next) ?? commenced;
    if (d) {
      // A next premium date is worked out once, when the policy is read, so an
      // old one sits in the past. Roll it forward by the frequency, never guess.
      for (let guard = 0; d.getTime() < start.getTime() && guard < 1200; guard++) d = addMonths(d, step);
      for (; d.getTime() < horizon.getTime(); d = addMonths(d, step)) {
        if (payingEnds && d.getTime() >= payingEnds.getTime()) break;
        dues.push({ date: d, amount: instalment });
      }
    }
    return { ...base, status: "yearly", yearly, dues };
  }

  // Health, motor, property, fire: yearly products that renew on their expiry date.
  const amount = type === "health" ? parseAmount(r.h_premium?.amount) : parseAmount(r.x_premium);
  if (amount == null) return base;
  const freq = readFrequency(type === "health" ? r.h_premium?.frequency : r.x_freq);
  if (freq === "single") return { ...base, status: "single" };
  const yearly = amount * (freq ?? 1);
  const renews = parseDate(r.expiry_date);
  const dues = renews && renews.getTime() >= start.getTime() && renews.getTime() < horizon.getTime()
    ? [{ date: renews, amount: yearly }]
    : [];
  return { ...base, status: "yearly", yearly, assumedYearly: type === "health" && freq == null, dues };
}

/** Premium falling due in each of the next 12 calendar months, this one first. */
export function renewalBuckets(policies: PolicyMoney[], today: Date) {
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const buckets = Array.from({ length: 12 }, (_, i) => ({
    month: addMonths(first, i),
    amount: 0,
    ids: new Set<string>(),
  }));
  for (const p of policies) {
    for (const due of p.dues) {
      const m = (due.date.getFullYear() - first.getFullYear()) * 12 + (due.date.getMonth() - first.getMonth());
      if (m < 0 || m >= 12) continue;
      buckets[m].amount += due.amount;
      buckets[m].ids.add(p.id);
    }
  }
  return buckets.map((b) => ({ month: b.month, amount: Math.round(b.amount), count: b.ids.size }));
}

/** Sum a value per key, largest first. Null values are skipped, not zeroed. */
export function sumBy<T>(items: T[], key: (t: T) => string, val: (t: T) => number | null): [string, number][] {
  const m = new Map<string, number>();
  for (const it of items) {
    const v = val(it);
    if (v == null) continue;
    m.set(key(it), (m.get(key(it)) ?? 0) + v);
  }
  return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
}

/** ₹38.6 L, ₹4.2 Cr, ₹24k (Hindi: लाख, करोड़, हज़ार). For tiles and bar labels. */
export function shortInr(n: number, locale: string = "en"): string {
  const hi = locale === "hi";
  const trim = (x: string) => x.replace(/\.0$/, "");
  // Step up a unit where rounding would print "100k" or "100 L".
  if (n >= 1e5 - 500 && n < 1e5) n = 1e5;
  if (n >= 1e7 - 5000 && n < 1e7) n = 1e7;
  if (n >= 1e7)return `₹${trim((n / 1e7).toFixed(n >= 1e9 ? 0 : 1))} ${hi ? "करोड़" : "Cr"}`;
  if (n >= 1e5) return `₹${trim((n / 1e5).toFixed(1))} ${hi ? "लाख" : "L"}`;
  if (n >= 1e3) return hi ? `₹${trim((n / 1e3).toFixed(n >= 1e4 ? 0 : 1))} हज़ार` : `₹${trim((n / 1e3).toFixed(n >= 1e4 ? 0 : 1))}k`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

/** ₹1,24,500 for exact figures. */
export function fullInr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}
