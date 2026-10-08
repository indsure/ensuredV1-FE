/**
 * First inception of continuous cover, read from a renewal schedule's list of
 * previous policies. Pure text work: NO network, NO Gemini.
 *
 * Why this exists: a National Mediclaim schedule listed eleven previous policies,
 * the oldest "26080048138500002005 /Dt.13/12/2014". That is an EXPIRY date, so
 * cover began on 14/12/2013. The prompt already says "earliest previous expiry
 * minus one policy year", but the model stored 2014 and the report showed 11.8
 * years instead of 12.8. One year matters: on a young policy it is the difference
 * between a waiting period served and one still running.
 *
 * Matching is deliberately narrow, because a wrong inception is worse than the
 * model's guess:
 *   1. The document must talk about previous / preceding / prior policies or a
 *      renewal history at all.
 *   2. A candidate date must sit just after a policy-number-like token.
 *   3. It must fall on the SAME day and month as the current expiry. Annual
 *      renewals expire on one anniversary, so this throws out proposal, receipt
 *      and print dates, which share the page but not the anniversary.
 *   4. It must be in an earlier year than the current expiry.
 * A ported policy (different anniversary at the old insurer) simply does not
 * match, and the model's date stands.
 */

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const HISTORY_GATE = /\b(previous|preceding|prior)\s+polic|renewal\s+history/i;

// dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy, or dd-Mon-yyyy / dd Mon yyyy.
const DATE_RE = /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})\b|\b(\d{1,2})[\s\-\/]([A-Za-z]{3})[A-Za-z]*[\s\-\/,]+(\d{4})\b/g;

// A policy number: 8+ characters of digits/letters/slashes/dashes with at least
// six digits in them. Must end within this many characters before the date.
const POLICY_NO_RE = /[A-Z0-9][A-Z0-9\/\-]{7,}/gi;
const POLICY_NO_WINDOW = 60;

interface Ymd { y: number; m: number; d: number }

const parseIso = (iso: string | null | undefined): Ymd | null => {
  const m = typeof iso === "string" ? iso.match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
  return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
};

const toIso = (dt: Date): string => dt.toISOString().slice(0, 10);

const validYmd = ({ y, m, d }: Ymd): boolean => {
  if (y < 1970 || m < 1 || m > 12 || d < 1) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

const hasPolicyNumberBefore = (text: string, dateIndex: number): boolean => {
  const before = text.slice(Math.max(0, dateIndex - POLICY_NO_WINDOW - 40), dateIndex);
  POLICY_NO_RE.lastIndex = 0;
  let found: RegExpExecArray | null;
  while ((found = POLICY_NO_RE.exec(before))) {
    const digits = found[0].replace(/\D/g, "").length;
    const endsWithin = before.length - (found.index + found[0].length) <= POLICY_NO_WINDOW;
    if (digits >= 6 && endsWithin) return true;
  }
  return false;
};

export interface RenewalInception {
  /** YYYY-MM-DD: the day after the earliest previous expiry, one year earlier. */
  inception: string;
  /** YYYY-MM-DD: the earliest previous expiry it was derived from. */
  earliestExpiry: string;
  /** How many previous expiries matched, for the confidence note. */
  matched: number;
}

export function deriveInceptionFromRenewalHistory(
  text: string,
  currentExpiryIso: string | null | undefined,
): RenewalInception | null {
  const expiry = parseIso(currentExpiryIso);
  if (!expiry || typeof text !== "string" || !HISTORY_GATE.test(text)) return null;

  let earliest: Ymd | null = null;
  let matched = 0;
  DATE_RE.lastIndex = 0;
  let hit: RegExpExecArray | null;
  while ((hit = DATE_RE.exec(text))) {
    const ymd: Ymd = hit[1]
      ? { d: +hit[1], m: +hit[2], y: +hit[3] }
      : { d: +hit[4], m: MONTHS[hit[5].toLowerCase()] ?? 0, y: +hit[6] };
    if (!validYmd(ymd)) continue;
    if (ymd.d !== expiry.d || ymd.m !== expiry.m || ymd.y >= expiry.y) continue;
    if (!hasPolicyNumberBefore(text, hit.index)) continue;
    matched++;
    if (!earliest || ymd.y < earliest.y) earliest = ymd;
  }
  if (!earliest) return null;

  // That policy year ran from (expiry - 1 year + 1 day) to its expiry.
  const start = new Date(Date.UTC(earliest.y - 1, earliest.m - 1, earliest.d));
  start.setUTCDate(start.getUTCDate() + 1);
  return {
    inception: toIso(start),
    earliestExpiry: toIso(new Date(Date.UTC(earliest.y, earliest.m - 1, earliest.d))),
    matched,
  };
}

const daysBetween = (fromIso: string, toIsoDate: string): number =>
  Math.round((Date.parse(toIsoDate) - Date.parse(fromIso)) / 86_400_000);

/**
 * Move policy_timeline.policy_inception_date EARLIER when the renewal history
 * proves continuous cover began before the date the model wrote. Never later:
 * a model date older than ours may come from a porting record we do not parse.
 * Returns the derivation when it changed the report, else null.
 *
 * Waiting periods are NOT recomputed here. Their is_active_today flags feed the
 * score, so flipping them needs the scoring to rerun with them, which is a
 * separate change.
 */
export function reconcileInceptionDate(
  parsed: any,
  text: string,
  todayIso: string,
  note: (parsed: any, msg: string) => void,
): RenewalInception | null {
  const tl = parsed?.policy_timeline;
  if (!tl || typeof tl !== "object") return null;

  const derived = deriveInceptionFromRenewalHistory(text, tl.policy_expiry_date);
  if (!derived) return null;

  const modelDate = parseIso(tl.policy_inception_date) ? String(tl.policy_inception_date).slice(0, 10) : null;
  if (modelDate && derived.inception >= modelDate) return null;

  tl.policy_inception_date = derived.inception;
  const age = daysBetween(derived.inception, todayIso);
  if (Number.isFinite(age) && age >= 0) tl.policy_age_days = age;

  note(
    parsed,
    `Continuous cover start corrected to ${derived.inception}${modelDate ? ` (was ${modelDate})` : ""}: ` +
    `the earliest of ${derived.matched} previous policy expiry dates listed on the schedule is ` +
    `${derived.earliestExpiry}, and that policy year began one year earlier.`
  );
  return derived;
}
