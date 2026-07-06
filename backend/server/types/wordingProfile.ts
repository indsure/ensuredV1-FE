/**
 * IndSure "Compare" — Wording-vs-Wording comparison engine.
 *
 * A WordingProfile is a normalized, person-AGNOSTIC snapshot of the IRDAI-standard
 * comparable clauses extracted from a single product policy-wording PDF. Two of
 * these are laid side-by-side by buildComparison() to produce a ComparisonResult.
 *
 * This file is the SINGLE SOURCE OF TRUTH:
 *   - AXES drives the Gemini extraction prompt (so the model is asked for exactly
 *     the fields we rank on),
 *   - AXES drives the deterministic per-row winner ranking, and
 *   - the ComparisonResult rows it emits drive the frontend table.
 *
 * Keep it pure (no node/IO imports) so it stays portable.
 */

// ─── Axis value ────────────────────────────────────────────────────────────────
// Every comparable clause is normalized to this shape by the extractor. Only the
// field relevant to the axis' ranking `direction` needs to be populated; `display`
// (a short, customer-facing string) and `note` (one-line nuance) are always set.
export interface AxisDatum {
  display: string;            // e.g. "No cap", "36 months", "Up to 100%"
  note?: string | null;       // one-line nuance, optional
  number?: number | null;     // numeric axes (months, days, %, ₹)
  ordinal?: number | null;    // ordinal axes — higher is always better (scale per axis)
  exists?: boolean | null;    // boolean coverage axes
  optional?: boolean | null;  // true if the ranked value is ONLY achievable via a paid
                              // optional cover/rider/add-on, not inbuilt in the base plan
}

export type WordingProfile = {
  // header / identity
  insurer: string | null;
  plan_name: string | null;
  uin: string | null;
  sum_insured_options: string | null;   // e.g. "₹5L – ₹2Cr"
  confidence: "high" | "medium" | "low";
} & Record<string, AxisDatum | string | null>;

// ─── Ranking direction ─────────────────────────────────────────────────────────
type Direction =
  | "lower"          // smaller number is better (waiting periods, co-pay %, moratorium…)
  | "higher"         // larger number is better (bonus %, hosp days, grace, free-look…)
  | "higher_ordinal" // larger ordinal is better (room rent, ICU, restoration, sub-limits…)
  | "exists"         // covered (true) beats not-covered (false)
  | "info";          // shown for context, never has a winner

export type AxisGroup =
  | "money_at_claim"
  | "waiting"
  | "bonus_reset"
  | "coverages"
  | "fine_print";

export interface AxisDef {
  key: string;
  label: string;          // English label (frontend may i18n by key later)
  group: AxisGroup;
  direction: Direction;
  weight: number;         // importance in the overall verdict (0 = excluded from score)
  /** Prompt-time guidance: tells Gemini exactly what to put in the AxisDatum. */
  prompt: string;
}

// ─── The axes (single source of truth) ──────────────────────────────────────────
// Ordinal scales (higher = better) are spelled out in `prompt` so the model and the
// ranking agree. Weights: money-at-claim & PED dominate because that is what an
// agent actually wins or loses a customer on.
export const AXES: AxisDef[] = [
  // ── Money at claim ──
  {
    key: "room_rent", label: "Room Rent", group: "money_at_claim",
    direction: "higher_ordinal", weight: 5,
    prompt: 'Room rent eligibility. ordinal: 5=no cap / at actuals / any room, 4=single private room, 3=% of SI per day (e.g. 1%), 2=fixed ₹ amount per day, 1=shared room only, 0=unclear. display: short e.g. "No cap" or "1% of SI/day" or "Single Private Room".',
  },
  {
    key: "icu", label: "ICU / ICCU", group: "money_at_claim",
    direction: "higher_ordinal", weight: 3,
    prompt: 'ICU/ICCU room eligibility. ordinal: 5=no cap / at actuals, 3=% of SI per day (e.g. 2%), 2=fixed ₹ amount/day, 0=unclear. display: short.',
  },
  {
    key: "copayment", label: "Co-payment", group: "money_at_claim",
    direction: "lower", weight: 5,
    prompt: 'Mandatory co-payment the insured bears on every claim. number: the percentage (0 if none). display: "None" or e.g. "20% (age 61+)". note: who/when it applies.',
  },
  {
    key: "sub_limits", label: "Sub-limits / Disease Capping", group: "money_at_claim",
    direction: "higher_ordinal", weight: 4,
    prompt: 'Disease-wise / procedure sub-limits that cap payouts (e.g. cataract ₹40k). ordinal: 5=no sub-limits at all, 3=few/minor sub-limits, 1=many or significant sub-limits, 0=unclear. display: "No sub-limits" or e.g. "Cataract, knee capped". note: which.',
  },
  {
    key: "deductible", label: "Deductible", group: "money_at_claim",
    direction: "lower", weight: 2,
    prompt: 'Aggregate/base deductible the insured pays before cover starts. number: ₹ amount (0 if none). display: "None" or e.g. "₹50,000".',
  },
  // ── Waiting periods ──
  {
    key: "initial_waiting", label: "Initial Waiting", group: "waiting",
    direction: "lower", weight: 1,
    prompt: 'Initial waiting period for illnesses. number: days (usually 30). display: e.g. "30 days".',
  },
  {
    key: "ped_waiting", label: "Pre-Existing (PED) Waiting", group: "waiting",
    direction: "lower", weight: 5,
    prompt: 'Pre-existing disease waiting period. number: months (e.g. 36, 24, 12). If a range/options, use the BEST (lowest) achievable. display: e.g. "36 months" or "24 mo (optional)".',
  },
  {
    key: "specific_disease_waiting", label: "Specific-Disease Waiting", group: "waiting",
    direction: "lower", weight: 3,
    prompt: 'Specific named-disease waiting period (e.g. cataract, hernia). number: months (e.g. 24). display: e.g. "24 months".',
  },
  {
    key: "maternity", label: "Maternity", group: "waiting",
    direction: "exists", weight: 3,
    prompt: 'Maternity benefit. exists: true if covered (even as inbuilt or optional), false if excluded. number: waiting months if stated. display: "Covered (24mo wait)" / "Optional add-on" / "Not covered". note: limit if any.',
  },
  // ── Bonus & reset ──
  {
    key: "cumulative_bonus", label: "Cumulative Bonus / NCB", group: "bonus_reset",
    direction: "higher", weight: 3,
    prompt: 'No-claim / cumulative bonus. number: max cumulative bonus % achievable (e.g. 100, 50). display: e.g. "Up to 100%" or "50% (10%/yr)". note: rate per year.',
  },
  {
    key: "restoration", label: "Restoration / Reset", group: "bonus_reset",
    direction: "higher_ordinal", weight: 4,
    prompt: 'Sum-insured restoration/reset benefit. ordinal: 5=unlimited restorations (full SI), 4=once/year full SI for unrelated & related illnesses, 3=once/year full SI (unrelated only), 2=partial restoration, 0=none/unclear. display: e.g. "Unlimited, 100%" or "Once/yr, 100%". note: trigger conditions.',
  },
  // ── Coverages ──
  {
    key: "pre_hosp", label: "Pre-Hospitalisation", group: "coverages",
    direction: "higher", weight: 2,
    prompt: 'Pre-hospitalisation expenses cover. number: days (e.g. 30, 60). display: e.g. "60 days".',
  },
  {
    key: "post_hosp", label: "Post-Hospitalisation", group: "coverages",
    direction: "higher", weight: 2,
    prompt: 'Post-hospitalisation expenses cover. number: days (e.g. 90, 180). display: e.g. "180 days".',
  },
  {
    key: "day_care", label: "Day-Care Procedures", group: "coverages",
    direction: "exists", weight: 1,
    prompt: 'Day-care procedures cover. exists: true if covered. display: e.g. "All day-care" or "Listed only".',
  },
  {
    key: "domiciliary", label: "Domiciliary Treatment", group: "coverages",
    direction: "exists", weight: 1,
    prompt: 'Domiciliary (home) treatment cover. exists: true/false. display: "Covered"/"Not covered".',
  },
  {
    key: "ayush", label: "AYUSH Treatment", group: "coverages",
    direction: "exists", weight: 1,
    prompt: 'AYUSH (Ayurveda/Homeopathy etc.) cover. exists: true/false. display: e.g. "Covered up to SI".',
  },
  {
    key: "organ_donor", label: "Organ Donor", group: "coverages",
    direction: "exists", weight: 1,
    prompt: 'Organ donor expenses cover. exists: true/false. display: "Covered"/"Not covered".',
  },
  {
    key: "ambulance", label: "Road Ambulance", group: "coverages",
    direction: "higher", weight: 1,
    prompt: 'Road ambulance cover. number: ₹ limit per hospitalisation (use a large number like 999999 if "at actuals"/no limit). display: e.g. "At actuals" or "₹2,000/trip".',
  },
  {
    key: "modern_treatments", label: "Modern Treatments", group: "coverages",
    direction: "exists", weight: 1,
    prompt: 'Modern treatments (robotic surgery, etc.). exists: true if covered. display: "Covered (up to SI)" / "Sub-limited" / "Not covered".',
  },
  {
    key: "consumables", label: "Consumables", group: "coverages",
    direction: "exists", weight: 1,
    prompt: 'Non-medical / consumables cover (gloves, etc., often a rider). exists: true if covered (inbuilt or optional). display: e.g. "Optional rider" / "Not covered".',
  },
  {
    key: "global_cover", label: "Global / Overseas Cover", group: "coverages",
    direction: "exists", weight: 1,
    prompt: 'International/overseas treatment cover. exists: true if available (inbuilt or optional). display: e.g. "Optional" / "Not covered".',
  },
  // ── Fine print ──
  {
    key: "moratorium", label: "Moratorium Period", group: "fine_print",
    direction: "lower", weight: 2,
    prompt: 'Moratorium period after which no claim can be contested (except fraud). number: months (e.g. 60). display: e.g. "60 months".',
  },
  {
    key: "grace_period", label: "Grace Period", group: "fine_print",
    direction: "higher", weight: 1,
    prompt: 'Premium grace period. number: days (e.g. 30). display: e.g. "30 days".',
  },
  {
    key: "free_look", label: "Free-Look Period", group: "fine_print",
    direction: "higher", weight: 0,
    prompt: 'Free-look period. number: days (e.g. 30). display: e.g. "30 days".',
  },
  {
    key: "portability", label: "Portability", group: "fine_print",
    direction: "exists", weight: 1,
    prompt: 'Portability allowed (IRDAI mandate; nearly always yes). exists: true/false. display: "Allowed".',
  },
  // ── Info-only (no winner) ──
  {
    key: "notable_exclusions", label: "Notable Exclusions", group: "fine_print",
    direction: "info", weight: 0,
    prompt: 'display: a short comma-joined list of the most material SPECIFIC exclusions beyond the IRDAI standard ones (skip the standard Excl01–18). Keep under ~120 chars.',
  },
  {
    key: "optional_riders", label: "Optional Riders", group: "fine_print",
    direction: "info", weight: 0,
    prompt: 'display: a short comma-joined list of notable optional covers/riders offered. Keep under ~120 chars.',
  },
];

export const AXIS_GROUP_LABELS: Record<AxisGroup, string> = {
  money_at_claim: "Money at Claim",
  waiting: "Waiting Periods",
  bonus_reset: "Bonus & Reset",
  coverages: "Coverages",
  fine_print: "Fine Print",
};

// ─── Comparison result (N-way: 2..4 plans; API returns / frontend renders) ───────
export interface Cell {
  display: string;
  note?: string | null;
  optional?: boolean;
  winner: boolean;        // true if this side is a (decisive) best on this row
}

export interface ComparisonRow {
  key: string;
  label: string;
  group: AxisGroup;
  cells: Cell[];          // one per side, in side order
}

export interface Side {
  insurer: string | null;
  plan_name: string | null;
  uin: string | null;
  sum_insured_options: string | null;
  confidence: string;
}

export interface ComparisonResult {
  sides: Side[];          // 2..4 plans, in display order
  groups: { group: AxisGroup; label: string; rows: ComparisonRow[] }[];
  verdict: {
    winner_index: number;        // index into sides; -1 if tie
    winner_name: string | null;
    scores: number[];            // relative 0-100 per side
    wins: number[];              // decisive rows won per side
    reasons: string[];           // top reasons the winner leads
    counterpoint: string | null; // strongest axis another plan beat the winner on
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────────
function asDatum(v: AxisDatum | string | null | undefined): AxisDatum {
  if (v && typeof v === "object") return v as AxisDatum;
  return { display: "—", note: null };
}

const numV = (d: AxisDatum): number | null =>
  typeof d.number === "number" && !Number.isNaN(d.number) ? d.number : null;
const ordV = (d: AxisDatum): number | null =>
  typeof d.ordinal === "number" && !Number.isNaN(d.ordinal) ? d.ordinal : null;

// Normalize an axis datum to a single comparable number where HIGHER = better,
// plus whether that value is only via a paid add-on. null = not comparable.
function comparable(def: AxisDef, d: AxisDatum): { val: number | null; optional: boolean } {
  switch (def.direction) {
    case "info":
      return { val: null, optional: false };
    case "exists": {
      if (d.exists == null) return { val: null, optional: false };
      // inbuilt-covered (2) > optional-covered (1) > not covered (0)
      return { val: d.exists ? (d.optional ? 1 : 2) : 0, optional: false };
    }
    case "lower": {
      const n = numV(d);
      return { val: n == null ? null : -n, optional: d.optional === true };
    }
    case "higher": {
      const n = numV(d);
      return { val: n == null ? null : n, optional: d.optional === true };
    }
    case "higher_ordinal": {
      const o = ordV(d);
      return { val: o == null ? null : o, optional: d.optional === true };
    }
    default:
      return { val: null, optional: false };
  }
}

/**
 * Per-axis winners across N sides → boolean[] (one per side). A win is awarded only
 * when DECISIVE (some eligible side is strictly worse), and paid-add-on-only
 * advantages over an inbuilt baseline are suppressed (baseline-first policy).
 */
function winnersFor(def: AxisDef, data: AxisDatum[]): boolean[] {
  const out: boolean[] = new Array(data.length).fill(false);
  if (def.direction === "info") return out;
  const elig = data
    .map((d, i) => ({ i, ...comparable(def, d) }))
    .filter((x) => x.val != null) as { i: number; val: number; optional: boolean }[];
  if (elig.length < 2) return out; // need ≥2 comparable sides to declare a winner
  const best = Math.max(...elig.map((x) => x.val));
  const worst = Math.min(...elig.map((x) => x.val));
  if (best <= worst) return out; // all equal → tie row
  let winners = elig.filter((x) => x.val === best);
  // baseline-first guard: don't reward an add-on-only best over an inbuilt baseline.
  if (winners.every((w) => w.optional) && elig.some((x) => !x.optional && x.val < best)) return out;
  // if inbuilt and optional tie for best, only inbuilt cells win.
  if (winners.some((w) => !w.optional)) winners = winners.filter((w) => !w.optional);
  for (const w of winners) out[w.i] = true;
  return out;
}

const nameOf = (p: WordingProfile): string | null =>
  p.plan_name || p.insurer || null;

const sideOf = (p: WordingProfile): Side => ({
  insurer: p.insurer,
  plan_name: p.plan_name,
  uin: p.uin,
  sum_insured_options: p.sum_insured_options,
  confidence: p.confidence,
});

/**
 * Build an N-way (2..4) side-by-side comparison from extracted profiles.
 * Pure & deterministic — the verdict is explainable, not AI-generated.
 */
export function compareMany(profiles: WordingProfile[]): ComparisonResult {
  const n = profiles.length;
  const rows: ComparisonRow[] = [];
  const scores: number[] = new Array(n).fill(0);
  const wins: number[] = new Array(n).fill(0);
  const reasonCandidates: { weight: number; sideIndex: number; text: string }[] = [];

  for (const def of AXES) {
    const data = profiles.map((p) => asDatum(p[def.key]));
    const w = winnersFor(def, data);

    rows.push({
      key: def.key,
      label: def.label,
      group: def.group,
      cells: data.map((d, i) => ({
        display: d.display ?? "—",
        note: d.note ?? null,
        optional: d.optional === true,
        winner: w[i],
      })),
    });

    if (def.weight > 0) {
      for (let i = 0; i < n; i++) {
        if (w[i]) {
          scores[i] += def.weight;
          wins[i]++;
          reasonCandidates.push({ weight: def.weight, sideIndex: i, text: `${def.label}: ${data[i].display}` });
        }
      }
    }
  }

  const groups = (Object.keys(AXIS_GROUP_LABELS) as AxisGroup[]).map((g) => ({
    group: g,
    label: AXIS_GROUP_LABELS[g],
    rows: rows.filter((r) => r.group === g),
  }));

  // Overall winner = highest weighted score; tie if the top score isn't unique.
  const maxScore = Math.max(...scores);
  const topCount = scores.filter((s) => s === maxScore).length;
  const winnerIndex = maxScore > 0 && topCount === 1 ? scores.indexOf(maxScore) : -1;

  const total = scores.reduce((a, b) => a + b, 0) || 1;
  const normScores = scores.map((s) => Math.round((s / total) * 100));

  const reasons =
    winnerIndex < 0
      ? []
      : reasonCandidates
          .filter((r) => r.sideIndex === winnerIndex)
          .sort((a, b) => b.weight - a.weight)
          .slice(0, 4)
          .map((r) => r.text);

  // Counterpoint: highest-weight axis another plan beat the winner on (honest selling).
  const counterpoint =
    winnerIndex < 0
      ? null
      : reasonCandidates
          .filter((r) => r.sideIndex !== winnerIndex)
          .sort((a, b) => b.weight - a.weight)
          .map((r) => `${r.text} (${nameOf(profiles[r.sideIndex]) ?? "another plan"})`)[0] ?? null;

  return {
    sides: profiles.map(sideOf),
    groups,
    verdict: {
      winner_index: winnerIndex,
      winner_name: winnerIndex >= 0 ? nameOf(profiles[winnerIndex]) : null,
      scores: normScores,
      wins,
      reasons,
      counterpoint,
    },
  };
}

/** 2-way convenience wrapper (PDF upload flow). */
export function buildComparison(a: WordingProfile, b: WordingProfile): ComparisonResult {
  return compareMany([a, b]);
}

/** Build the Gemini extraction prompt from the axis registry (kept in sync). */
export function buildExtractionPrompt(): string {
  const axisLines = AXES.map((d) => `  - "${d.key}": ${d.prompt}`).join("\n");
  return `You are an IRDAI-licensed health-insurance policy analyst. You are given the FULL POLICY WORDING text of ONE health-insurance product. Extract a structured, product-level profile of its standard comparable clauses.

Return ONLY a single JSON object (no markdown, no commentary). Shape:
{
  "insurer": string|null,            // company name, e.g. "HDFC ERGO"
  "plan_name": string|null,          // product/plan name, e.g. "my:Optima Secure"
  "uin": string|null,                // the UIN if present
  "sum_insured_options": string|null,// range of sum insured offered, e.g. "₹5L – ₹2Cr"
  "confidence": "high"|"medium"|"low",
  // each axis below is an object: { "display": string, "note": string|null, "optional": boolean, and ONE of "number"|"ordinal"|"exists" as instructed }
${axisLines}
}

Rules:
- "display" must be SHORT and customer-facing (a 40+ insurance agent reads it aloud). No legalese.
- Populate the SPECIFIC ranking field named in each axis instruction ("number", "ordinal", or "exists"). If a value is genuinely not found, set that field to null and "display" to "Not specified".
- BASELINE FIRST (critical for fairness): always report the value of the BASE / INBUILT / DEFAULT plan in the ranking field. If a better value (e.g. lower PED waiting, unlimited restoration, higher bonus) is ONLY achievable by buying a paid optional cover / rider / add-on, you MUST still put the INBUILT base value in the ranking field, set "optional": false, and mention the optional upgrade in "note" (e.g. "24mo reducible via optional add-on"). Only set "optional": true and use the optional value in the ranking field when the benefit is ENTIRELY optional (no inbuilt version exists at all). Never present a paid add-on's value as if it were the standard plan.
- For ordinal axes, use EXACTLY the integer scale described (higher = better).
- Numbers must be plain numbers (months as months, days as days, % as the number, ₹ as the rupee amount) — never strings.
- Do NOT invent values. Base everything on the wording text provided.
- Output strictly valid JSON.`;
}
