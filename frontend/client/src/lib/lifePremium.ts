/**
 * When a life or term premium is next due, worked out on the day it is asked.
 *
 * Extracted from Home's `dueOf` (lib/home.ts) so Home and the Policies list
 * show the same date. Rules, unchanged from Home:
 *
 *  - `expiry_date` on a life or term row is the MATURITY or cover end date,
 *    never a premium date, so it is never used here.
 *  - Start from the stated `next_premium_date`, else the commencement date, and
 *    roll forward by the frequency until today, stopping when the premium paying
 *    term ends. The stored next date was worked out once, at upload, so it goes
 *    stale; rolling it at view time keeps it current.
 *  - A yearly or half-yearly date that passed in the last 30 days stays on that
 *    date, marked passed, so the advisor checks it was paid. We hold no receipts,
 *    so this never says "late" or "lapsed".
 *  - No readable frequency: the printed date is returned once, unrolled.
 *  - Single premium, or the paying term is over: null (nothing is due).
 */

import { readFrequency } from "./policyValue";

/** How far back a passed yearly or half-yearly premium date is still shown. */
export const LATE_WINDOW_DAYS = 30;

export type LifePremiumInput = {
  next: unknown;
  start: unknown;
  freq: unknown;
  ppt: unknown;
};

export type LifePremiumDue = {
  date: Date;
  /** Instalments a year; null when the frequency could not be read. */
  perYear: number | null;
  /**
   * scheduled: rolled forward to the next due date on or after today.
   * passed: a yearly or half-yearly date that passed in the last 30 days.
   * printed: the frequency is unknown, so this is the printed date, not rolled
   *          (it can be in the past).
   */
  kind: "scheduled" | "passed" | "printed";
};

function parseDate(raw: unknown): Date | null {
  if (!raw) return null;
  const d = new Date(String(raw));
  return Number.isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseYears(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function addMonths(d: Date, months: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + months, d.getDate());
}

export function nextLifePremium(x: LifePremiumInput, today: Date): LifePremiumDue | null {
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const raw = readFrequency(x.freq);
  if (raw === "single") return null;
  const perYear: number | null = raw;

  const commenced = parseDate(x.start);
  const ppt = parseYears(x.ppt);
  const payingEnds = commenced && ppt ? addMonths(commenced, Math.round(ppt * 12)) : null;
  if (payingEnds && payingEnds.getTime() <= t0.getTime()) return null;

  const next = parseDate(x.next);
  const lateFrom = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() - LATE_WINDOW_DAYS);
  if (
    next && next.getTime() < t0.getTime() && next.getTime() >= lateFrom.getTime() &&
    (perYear === 1 || perYear === 2)
  ) {
    return { date: next, perYear, kind: "passed" };
  }

  let d = next ?? commenced;
  if (!d) return null;
  if (!perYear) return { date: d, perYear: null, kind: "printed" };

  const step = 12 / perYear;
  for (let guard = 0; d.getTime() < t0.getTime() && guard < 1200; guard++) d = addMonths(d, step);
  if (payingEnds && d.getTime() >= payingEnds.getTime()) return null;
  return { date: d, perYear, kind: "scheduled" };
}

/** Local calendar date as YYYY-MM-DD (never via toISOString, which shifts days in India). */
export function isoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
