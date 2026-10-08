/**
 * After the reader returns, before anything is stored.
 *
 * 1. Strict coercion. A number or date the reader returned in a shape outside
 *    the one grammar (shared/policyNumbers) is stored as null, and what it
 *    actually said is kept under `_unparsed` so a person can fix it. Nothing
 *    is cleaned up by deleting characters.
 *
 * 2. Source excerpts. For each key figure the reader is asked for the exact
 *    words it read the value from. Here we check those words really appear in
 *    the document text, and that the value appears in those words. A page
 *    number the reader claims is kept, marked as claimed: it cannot be checked
 *    from extracted text.
 *
 * 3. The scheduled next premium date. Worked out in code from the
 *    commencement date, frequency and premium paying term, and labelled
 *    `next_premium_date_basis: "schedule"`. It is a reminder date for the
 *    renewal screens. It says nothing about whether any premium was paid, and
 *    the value screens never treat it as if it did.
 *
 * No model call. Pure.
 */

import { addMonthsIso, compareIso, parseIsoDate, parseRupees, parseWholeNumber } from "../../../shared/policyNumbers";

export type FieldKind = "text" | "number" | "date" | "json";

export interface CoerceOut {
  value: unknown;
  unparsed: string | null;
}

export function coerceStrict(value: unknown, type: FieldKind): CoerceOut {
  if (value === null || value === undefined) return { value: null, unparsed: null };
  if (typeof value === "string" && value.trim() === "") return { value: null, unparsed: null };
  if (type === "json") return { value: value && typeof value === "object" && !Array.isArray(value) ? value : null, unparsed: null };
  if (type === "number") {
    const p = parseRupees(value);
    return p.ok ? { value: p.value, unparsed: null } : { value: null, unparsed: String(value).slice(0, 120) };
  }
  if (type === "date") {
    const p = parseIsoDate(value);
    return p.ok ? { value: p.value, unparsed: null } : { value: null, unparsed: String(value).slice(0, 120) };
  }
  return { value: typeof value === "string" ? value.trim() : value, unparsed: null };
}

/**
 * The previous coercion, kept for the lines of business this change does not
 * cover (motor, travel, property...). Their numbers do not drive surrender
 * values, and tightening them is a separate change with its own blast radius.
 */
export function coerceLegacy(value: unknown, type: FieldKind): CoerceOut {
  if (value === null || value === undefined) return { value: null, unparsed: null };
  if (typeof value === "string" && value.trim() === "") return { value: null, unparsed: null };
  if (type === "json") return { value: typeof value === "object" ? value : null, unparsed: null };
  if (type === "number") {
    if (typeof value === "number") return { value, unparsed: null };
    const n = Number(String(value).replace(/[^0-9.\-]/g, ""));
    return { value: Number.isFinite(n) ? n : null, unparsed: null };
  }
  return { value: typeof value === "string" ? value.trim() : value, unparsed: null };
}

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const digits = (s: string) => s.replace(/[^0-9]/g, "");

export interface CheckedSource {
  excerpt: string;
  /** The page the reader said; not checkable from extracted text. */
  pageClaimed: number | null;
  /** The excerpt appears, word for word (spacing aside), in the document text. */
  inText: boolean;
  /** The stored value appears in the excerpt. */
  valueInExcerpt: boolean;
}

function valueAppears(value: unknown, excerpt: string): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return digits(excerpt).includes(digits(String(Math.round(value))));
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-");
    const ex = excerpt.toLowerCase();
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    return ex.includes(y) && (ex.includes(String(Number(d))) && (ex.includes(m) || ex.includes(months[Number(m) - 1])));
  }
  return squash(excerpt).includes(squash(s));
}

/** Keep only well-formed sources for fields that exist, and check each against the text. */
export function checkFieldSources(
  data: Record<string, unknown>, policyText: string, knownFields: Set<string>
): Record<string, CheckedSource> {
  const raw = data.field_sources;
  const out: Record<string, CheckedSource> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const text = squash(policyText);
  for (const [key, v] of Object.entries(raw as Record<string, any>)) {
    if (!knownFields.has(key) || key === "field_sources") continue;
    const excerpt = typeof v?.excerpt === "string" ? v.excerpt.trim().slice(0, 240) : "";
    if (!excerpt) continue;
    const page = parseWholeNumber(v?.page, { min: 1, max: 5000 });
    out[key] = {
      excerpt,
      pageClaimed: page.ok ? page.value : null,
      inText: excerpt.length >= 6 && text.includes(squash(excerpt)),
      valueInExcerpt: valueAppears(data[key], excerpt),
    };
  }
  return out;
}

function perYear(freq: unknown): number | "single" | null {
  const s = String(freq ?? "").toLowerCase();
  if (!s.trim()) return null;
  if (/single|one.?time|lump/.test(s)) return "single";
  if (/month/.test(s)) return 12;
  if (/quarter/.test(s)) return 4;
  if (/half|semi|six/.test(s)) return 2;
  if (/annual|year/.test(s)) return 1;
  return null;
}

/**
 * A stated next premium date is kept and labelled "stated". Without one, the
 * next scheduled due date after today is worked out and labelled "schedule".
 * Single premium, a finished premium term, or a schedule we cannot read: null.
 */
export function fillNextPremiumDate(data: Record<string, unknown>, today: string): void {
  if (!("next_premium_date" in data)) return;
  if (data.next_premium_date) {
    data.next_premium_date_basis = "stated";
    return;
  }
  const start = parseIsoDate(data.start_date);
  const f = perYear(data.premium_frequency);
  const ppt = parseWholeNumber(data.premium_paying_term_years ?? data.policy_term_years, { min: 1, max: 100 });
  if (!start.ok || f === null || f === "single" || !ppt.ok) {
    data.next_premium_date_basis = null;
    return;
  }
  const step = 12 / f;
  for (let k = 0; k < ppt.value * f; k++) {
    const due = addMonthsIso(start.value, k * step);
    if (compareIso(due, today) > 0) {
      data.next_premium_date = due;
      data.next_premium_date_basis = "schedule";
      return;
    }
  }
  data.next_premium_date_basis = null;
}
