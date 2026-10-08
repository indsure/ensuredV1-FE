/**
 * Strict number and date grammar for policy values.
 *
 * One contract, used by extraction, the save endpoint, the value engine and
 * the WhatsApp bot. A value either matches a known format and is normalised
 * (keeping what was actually written), or it is rejected with a reason so a
 * person can correct it. Nothing is ever "cleaned up" by deleting characters:
 * that is how "Rs. 50,000" used to become 0.5 and "1.5 lakh" became 1.5.
 *
 * Dates are calendar dates (YYYY-MM-DD) handled as strings, so no browser
 * time zone can move a policy anniversary. "Today" for a valuation is the
 * calendar date in India.
 *
 * Zero imports on purpose. This file is copied byte for byte to
 * shared/policyNumbers.ts (backend) and whatsapp-bot/src/shared (bot), and
 * tests fail if the copies differ.
 */

export type ParseFailure =
  | "empty"
  | "not_a_number"
  | "non_finite"
  | "negative"
  | "out_of_range"
  | "not_integer"
  | "invalid_date"
  | "ambiguous_date";

export type Parsed<T> =
  | { ok: true; value: T; original: string | number; normalized: boolean }
  | { ok: false; reason: ParseFailure; original: unknown };

const fail = (reason: ParseFailure, original: unknown): { ok: false; reason: ParseFailure; original: unknown } =>
  ({ ok: false, reason, original });

const isBlank = (raw: unknown) =>
  raw === null || raw === undefined || (typeof raw === "string" && raw.trim() === "");

/*
 * Rupee grammar, case-insensitive:
 *   [Rs | Rs. | INR | ₹]  digits  [.dd]  [lakh | lakhs | lac | lacs | crore | crores | cr]  [/-]
 * digits are plain (50000), Indian-grouped (5,00,000) or western-grouped
 * (500,000). At most two decimals: a third is paise or a typo.
 */
const RUPEE_RE =
  /^(?:(?:rs\.?|inr|₹)\s*)?(\d{1,3}(?:,\d{2})*,\d{3}|\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?\s*(lakhs?|lacs?|crores?|cr)?\.?\s*(?:\/-)?$/i;

const SCALE: Record<string, number> = {
  lakh: 1e5, lakhs: 1e5, lac: 1e5, lacs: 1e5, crore: 1e7, crores: 1e7, cr: 1e7,
};

/** An amount in rupees. Zero is allowed; negative is not. */
export function parseRupees(raw: unknown): Parsed<number> {
  if (isBlank(raw)) return fail("empty", raw);
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return fail("non_finite", raw);
    if (raw < 0) return fail("negative", raw);
    return { ok: true, value: raw, original: raw, normalized: false };
  }
  if (typeof raw !== "string") return fail("not_a_number", raw);
  const s = raw.trim();
  const m = RUPEE_RE.exec(s);
  if (!m) return fail("not_a_number", raw);
  const whole = m[1].replace(/,/g, "");
  const value = Number(whole + (m[2] ? "." + m[2] : "")) * (m[3] ? SCALE[m[3].toLowerCase()] : 1);
  if (!Number.isFinite(value)) return fail("non_finite", raw);
  const rounded = Math.round(value * 100) / 100;
  return { ok: true, value: rounded, original: raw, normalized: s !== String(rounded) };
}

const PLAIN_RE = /^\d+(?:\.\d+)?$/;

/**
 * A percentage, written as a percentage: 7 means 7%.
 *
 * Any value from 0 to 100 is accepted as typed. Nothing is ever multiplied by
 * 100. A value under 1 is legal (a 0.3% charge is real) but is also what a
 * decimal typed into a percent box looks like, so the editor asks the person
 * which they meant before saving (see percentNeedsConfirmation). The parser
 * itself does not guess.
 */
export function parsePercent(raw: unknown): Parsed<number> {
  if (isBlank(raw)) return fail("empty", raw);
  let n: number;
  if (typeof raw === "number") n = raw;
  else if (typeof raw === "string") {
    const s = raw.trim().replace(/\s*%$/, "");
    if (!/^-?\d+(?:\.\d+)?$/.test(s)) return fail("not_a_number", raw);
    n = Number(s);
  } else return fail("not_a_number", raw);
  if (!Number.isFinite(n)) return fail("non_finite", raw);
  if (n < 0 || n > 100) return fail("out_of_range", raw);
  return { ok: true, value: n, original: raw as string | number, normalized: typeof raw === "string" };
}

/** True for a percentage that could be a decimal typed by mistake (0.07 for 7%). */
export function percentNeedsConfirmation(n: number): boolean {
  return n > 0 && n < 1;
}

/** A whole number such as a term in years. */
export function parseWholeNumber(raw: unknown, bounds: { min?: number; max?: number } = {}): Parsed<number> {
  if (isBlank(raw)) return fail("empty", raw);
  let n: number;
  if (typeof raw === "number") n = raw;
  else if (typeof raw === "string") {
    const s = raw.trim();
    if (!PLAIN_RE.test(s)) return fail("not_a_number", raw);
    n = Number(s);
  } else return fail("not_a_number", raw);
  if (!Number.isFinite(n)) return fail("non_finite", raw);
  if (!Number.isInteger(n)) return fail("not_integer", raw);
  if (bounds.min !== undefined && n < bounds.min) return fail("out_of_range", raw);
  if (bounds.max !== undefined && n > bounds.max) return fail("out_of_range", raw);
  return { ok: true, value: n, original: raw as string | number, normalized: typeof raw === "string" };
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.0{1,3})?Z?)?$/;

const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/**
 * A calendar date as YYYY-MM-DD.
 *
 * Only the ISO order is accepted, because it is the only one whose day and
 * month cannot be swapped: 03/04/2018 is 3 April in India and 4 March to a
 * JavaScript Date. A timestamp is accepted only at exactly midnight UTC (how
 * a date column often serialises); any other time would make the calendar
 * date depend on a time zone.
 */
export function parseIsoDate(raw: unknown): Parsed<string> {
  if (isBlank(raw)) return fail("empty", raw);
  if (typeof raw !== "string") return fail("ambiguous_date", raw);
  const m = DATE_RE.exec(raw.trim());
  if (!m) return fail("ambiguous_date", raw);
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (y < 1900 || y > 2200 || mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) {
    return fail("invalid_date", raw);
  }
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  return { ok: true, value: iso, original: raw, normalized: iso !== raw };
}

const pad = (n: number) => String(n).padStart(2, "0");
const parts = (iso: string) => iso.split("-").map(Number) as [number, number, number];

/** Calendar month arithmetic. A day past the end of the target month clamps to its last day. */
export function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = parts(iso);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${pad(nm)}-${pad(Math.min(d, daysInMonth(ny, nm)))}`;
}

/** The date of the given anniversary, counted from the start date itself (never chained). */
export function anniversaryIso(startIso: string, years: number): string {
  return addMonthsIso(startIso, years * 12);
}

/** Compare two YYYY-MM-DD dates: negative, zero or positive. */
export function compareIso(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Policy years completed on a date, counted by anniversary. */
export function completedPolicyYears(startIso: string, asOfIso: string): number {
  if (compareIso(asOfIso, startIso) < 0) return 0;
  let years = parts(asOfIso)[0] - parts(startIso)[0];
  while (years > 0 && compareIso(anniversaryIso(startIso, years), asOfIso) > 0) years -= 1;
  return Math.max(years, 0);
}

/** Whole days from a to b (b later is positive). */
export function daysBetweenIso(a: string, b: string): number {
  const [ay, am, ad] = parts(a);
  const [by, bm, bd] = parts(b);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

/**
 * The valuation date: today's calendar date in India.
 *
 * Every value here turns on an anniversary, so "today" has to be one agreed
 * calendar date rather than whatever the viewer's clock and zone say.
 */
export function valuationDateIso(now: Date = new Date()): string {
  const ist = new Date(now.getTime() + 330 * 60000);
  return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())}`;
}
