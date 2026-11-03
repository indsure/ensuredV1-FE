/**
 * How complete a catalogue health plan is, on its own, out of 100.
 *
 * compareMany() only answers "which of THESE plans wins": its scores are
 * relative to the other plans on the table, so a plan's number changes with
 * its company. Recommending plans needs an absolute number. This is it, built
 * from the same two things the comparison already uses, so the two never
 * disagree about what good looks like:
 *
 *   - AXES weights (wordingProfile.ts): how much each clause matters.
 *   - toneFor(): whether a clause is good, limited or bad for the buyer.
 *
 * Score = sum(weight x credit) / sum(weight), where credit is good 1,
 * limit 0.5, bad 0. A clause the wording leaves to another document
 * ("unknown") earns 0.25: it is not a promise the buyer can claim on, but it
 * is not proof of a bad term either, and scoring it 0 would rank plans by how
 * thoroughly their wording was read rather than by what they cover.
 *
 * Pure and deterministic: no AI, no I/O.
 */
import { AXES, toneFor, type AxisDatum, type Tone, type WordingProfile } from "../types/wordingProfile";

export const COMPLETENESS_VERSION = "1.0.0";

const CREDIT: Record<Tone, number> = { good: 1, limit: 0.5, bad: 0, unknown: 0.25 };

export interface CompletenessResult {
  score: number;                 // 0-100, rounded
  strengths: string[];           // heaviest clauses rated good, e.g. "Room Rent: No cap"
  gaps: string[];                // heaviest clauses rated bad or limited
  unknown: number;               // clauses the wording did not settle
}

function asDatum(v: unknown): AxisDatum | null {
  return v && typeof v === "object" ? (v as AxisDatum) : null;
}

export function scoreCompleteness(profile: WordingProfile): CompletenessResult {
  let earned = 0;
  let possible = 0;
  let unknown = 0;
  const good: { w: number; text: string }[] = [];
  const weak: { w: number; text: string; bad: boolean }[] = [];

  for (const def of AXES) {
    if (def.weight <= 0) continue;
    const d = asDatum(profile[def.key]) ?? { display: "" };
    const tone = toneFor(def, d) ?? "unknown";
    possible += def.weight;
    earned += def.weight * CREDIT[tone];
    const text = `${def.label}: ${d.display || "not stated"}`;
    if (tone === "good") good.push({ w: def.weight, text });
    else if (tone === "bad" || tone === "limit") weak.push({ w: def.weight, text, bad: tone === "bad" });
    else unknown++;
  }

  return {
    score: possible > 0 ? Math.round((earned / possible) * 100) : 0,
    strengths: good.sort((a, b) => b.w - a.w).slice(0, 3).map((g) => g.text),
    // Bad before limited at the same weight: a co-pay matters more than a capped ICU.
    gaps: weak.sort((a, b) => b.w - a.w || Number(b.bad) - Number(a.bad)).slice(0, 3).map((g) => g.text),
    unknown,
  };
}

/**
 * The largest sum insured a plan offers, in rupees, read from the catalogue's
 * free-text range ("₹5L – ₹2Cr", "3 lakh to 1 crore", "Up to ₹50 Lakh").
 * null when the text holds no amount we can read.
 */
export function maxSumInsured(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = raw.toLowerCase().replace(/,/g, "");
  if (/\bunlimited\b/.test(s)) return Number.MAX_SAFE_INTEGER;
  let max: number | null = null;
  const re = /(\d+(?:\.\d+)?)\s*(crores?|cr\b|lakhs?|lacs?|l\b)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const n = parseFloat(m[1]);
    const unit = m[2] ?? "";
    let v: number;
    if (/^cr/.test(unit)) v = n * 1e7;
    else if (/^(l|lakh|lac)/.test(unit)) v = n * 1e5;
    else if (n >= 100000) v = n;   // a bare rupee figure
    else continue;                  // a bare small number (an age, a year) is not an amount
    if (max == null || v > max) max = v;
  }
  return max;
}
