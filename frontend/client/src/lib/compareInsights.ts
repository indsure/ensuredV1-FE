/**
 * Compare view logic: which rows matter, which plans to call out, and how to say a limit in
 * rupees. Pure and import-free (type imports only) so the backend test runner can exercise it.
 *
 * Every call-out is derived from the engine's per-cell tone. Nothing here is hand-written per
 * plan, so a card can never claim something the table does not show.
 */
import type { Cell, ComparisonResult, ComparisonRow, Tone } from "./wordingProfile";

/** The rows a buyer decides on, in the order they are read. Everything else is "more details". */
export const SECTIONS: { id: "claim" | "wait" | "grow"; keys: string[] }[] = [
  { id: "claim", keys: ["room_rent", "icu", "copayment", "deductible", "sub_limits", "consumables", "pre_hosp", "post_hosp"] },
  { id: "wait", keys: ["ped_waiting", "specific_disease_waiting", "maternity"] },
  { id: "grow", keys: ["cumulative_bonus", "restoration"] },
];
export const KEY_ROWS = new Set(SECTIONS.flatMap((s) => s.keys));

/** The six things that decide how much of a hospital bill comes back. */
export const CLAIM_KEYS = ["room_rent", "icu", "copayment", "sub_limits", "deductible", "consumables"];

/** Benefits worth an "only one with" call-out, most important first. */
const ONLY_KEYS = ["maternity", "restoration", "cumulative_bonus", "consumables", "domiciliary", "global_cover", "organ_donor", "modern_treatments"];

export const INFO_KEYS = new Set(["notable_exclusions", "optional_riders"]);

/** The rows that answer "does this plan suit me", per situation. */
export const FIT: Record<"baby" | "ped" | "city" | "senior", string[]> = {
  baby: ["maternity"],
  ped: ["ped_waiting"],
  city: ["room_rent", "icu"],
  senior: ["copayment", "specific_disease_waiting", "sub_limits"],
};

const UNKNOWN_RE = /not specified|not stated|not mentioned|unclear|as per (the )?(policy )?schedule|per (the )?schedule|certificate of insurance/i;

export function isBlank(display: string | null | undefined): boolean {
  const d = (display ?? "").trim();
  return !d || d === "—" || d === "-";
}

/** The cell's tone, or a cautious stand-in for results saved before the engine sent tones:
 *  "unknown" when the wording defers, "good" for a row winner, otherwise no colour at all. */
export function toneOf(rowKey: string, c: Cell): Tone | undefined {
  if (c.tone) return c.tone;
  if (isBlank(c.display)) return "unknown";
  if (INFO_KEYS.has(rowKey)) return undefined;
  if (UNKNOWN_RE.test(c.display)) return "unknown";
  return c.winner ? "good" : undefined;
}

export function allRows(r: ComparisonResult): ComparisonRow[] {
  return r.groups.flatMap((g) => g.rows);
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** A row where every plan says the same thing is not a difference. */
export function isSameRow(row: ComparisonRow): boolean {
  const cells = row.cells;
  if (cells.length < 2) return false;
  if (cells.some((c) => isBlank(c.display))) return false;
  const tones = cells.map((c) => toneOf(row.key, c));
  if (tones.some((t) => t === "unknown")) return false;
  if (tones.some((t) => t !== tones[0])) return false;
  if (cells.some((c) => !!c.optional !== !!cells[0].optional)) return false;
  const vals = cells.map((c) => c.value);
  if (vals.every((v) => typeof v === "number") && vals.every((v) => v === vals[0])) return true;
  return cells.every((c) => norm(c.display) === norm(cells[0].display));
}

export type Insight =
  | { kind: "strongest"; side: number; rowKeys: string[] }
  | { kind: "only"; side: number; rowKey: string }
  | { kind: "watch"; side: number; rowKeys: string[] }
  | { kind: "papers"; side: number; count: number };

/** The single side holding the strictly highest count, or -1. */
function uniqueMax(counts: number[], floor: number): number {
  const max = Math.max(...counts);
  if (max < floor) return -1;
  return counts.filter((c) => c === max).length === 1 ? counts.indexOf(max) : -1;
}

export function insights(r: ComparisonResult): Insight[] {
  const n = r.sides.length;
  const byKey = new Map(allRows(r).map((row) => [row.key, row]));
  const toneAt = (key: string, i: number) => {
    const row = byKey.get(key);
    return row ? toneOf(key, row.cells[i]) : undefined;
  };
  const claim = CLAIM_KEYS.filter((k) => byKey.has(k));
  const sides = Array.from({ length: n }, (_, i) => i);
  const out: Insight[] = [];

  // Strongest at claim time: most claim-day factors that are plainly good. Unknowns do not
  // count as good, so a plan whose limits all sit in an unread schedule cannot win this.
  const goods = sides.map((i) => claim.filter((k) => toneAt(k, i) === "good"));
  const best = uniqueMax(goods.map((g) => g.length), 2);
  if (best >= 0) out.push({ kind: "strongest", side: best, rowKeys: goods[best] });

  // Only one with X: exactly one plan covers it and every other plan plainly does not.
  let onlyCount = 0;
  for (const k of ONLY_KEYS) {
    if (onlyCount >= 2 || !byKey.has(k)) continue;
    const covered = sides.filter((i) => toneAt(k, i) === "good");
    if (covered.length === 1 && sides.every((i) => i === covered[0] || toneAt(k, i) === "bad")) {
      out.push({ kind: "only", side: covered[0], rowKey: k });
      onlyCount++;
    }
  }

  // Watch out: the plan that cuts the most from a claim, when it cuts on at least two counts.
  const bads = sides.map((i) => claim.filter((k) => toneAt(k, i) === "bad"));
  const worst = uniqueMax(bads.map((b) => b.length), 2);
  if (worst >= 0 && worst !== best) out.push({ kind: "watch", side: worst, rowKeys: bads[worst] });

  // Read the papers: three or more of the main rows are left to the policy schedule.
  const keyRows = Array.from(KEY_ROWS).filter((k) => byKey.has(k));
  const unknowns = sides.map((i) => keyRows.filter((k) => toneAt(k, i) === "unknown").length);
  sides
    .filter((i) => unknowns[i] >= 3)
    .sort((a, b) => unknowns[b] - unknowns[a])
    .slice(0, 2)
    .forEach((i) => out.push({ kind: "papers", side: i, count: unknowns[i] }));

  return out;
}

/** "1% of SI/day" reads as jargon to a 60-year-old. Say "cover" and "a day". */
export function plainDisplay(display: string): string {
  return display
    .replace(/\bsum insured\b/gi, "cover")
    .replace(/\bSI\b/g, "cover")
    .replace(/\s*\/\s*day\b/gi, " a day")
    .replace(/\s*\/\s*(yr|year)\b/gi, " a year");
}

const PCT_RE = /(\d+(?:\.\d+)?)\s*%\s*(?:of\s*)?(?:the\s*)?(?:base\s*)?(?:SI|sum\s*insured|cover)\b/i;

/** The rupee amount a "% of cover" limit works out to at the chosen cover, or null. */
export function coverRupees(display: string, sumInsured: number): string | null {
  const m = display.match(PCT_RE);
  if (!m) return null;
  const amount = Math.round((sumInsured * parseFloat(m[1])) / 100);
  return "₹" + amount.toLocaleString("en-IN");
}

export function hasPercentOfCover(r: ComparisonResult): boolean {
  return allRows(r).some((row) => (row.key === "room_rent" || row.key === "icu") && row.cells.some((c) => PCT_RE.test(c.display)));
}
