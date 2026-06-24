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

// ─── Comparison result (what the API returns / frontend renders) ─────────────────
export type Winner = "a" | "b" | "tie" | "na";

export interface ComparisonRow {
  key: string;
  label: string;
  group: AxisGroup;
  a: { display: string; note?: string | null; optional?: boolean };
  b: { display: string; note?: string | null; optional?: boolean };
  winner: Winner;
}

export interface ComparisonResult {
  a: { insurer: string | null; plan_name: string | null; uin: string | null; sum_insured_options: string | null; confidence: string };
  b: { insurer: string | null; plan_name: string | null; uin: string | null; sum_insured_options: string | null; confidence: string };
  groups: { group: AxisGroup; label: string; rows: ComparisonRow[] }[];
  verdict: {
    winner: Winner;                 // "a" | "b" | "tie"
    winner_name: string | null;     // plan/insurer name of the winner
    score_a: number;                // weighted win score (0-100ish, relative)
    score_b: number;
    wins_a: number;                 // count of decisive rows won
    wins_b: number;
    ties: number;
    reasons: string[];              // top weighted reasons the winner is ahead (customer-facing)
    counterpoint: string | null;    // strongest reason the OTHER plan might still be picked
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────────
function asDatum(v: AxisDatum | string | null | undefined): AxisDatum {
  if (v && typeof v === "object") return v as AxisDatum;
  return { display: "—", note: null };
}

const num = (d: AxisDatum): number | null =>
  typeof d.number === "number" && !Number.isNaN(d.number) ? d.number : null;
const ord = (d: AxisDatum): number | null =>
  typeof d.ordinal === "number" && !Number.isNaN(d.ordinal) ? d.ordinal : null;

const isOptional = (d: AxisDatum): boolean => d.optional === true;

/**
 * Fairness guard: if the winning side's advantage is ONLY available as a paid
 * optional add-on while the other side already has the (lesser) benefit inbuilt,
 * we do NOT award a decisive "Better" — it would mislead a customer comparing
 * base plans. Downgrade such a win to a tie (the `optional` tag still shows).
 */
function applyOptionalGuard(winner: Winner, da: AxisDatum, db: AxisDatum): Winner {
  if (winner !== "a" && winner !== "b") return winner;
  const winDatum = winner === "a" ? da : db;
  const loseDatum = winner === "a" ? db : da;
  if (isOptional(winDatum) && !isOptional(loseDatum)) return "tie";
  return winner;
}

/** Deterministic per-axis winner. Returns the winner plus whether it was decisive. */
function rankAxis(def: AxisDef, da: AxisDatum, db: AxisDatum): Winner {
  switch (def.direction) {
    case "info":
      return "na";
    case "exists": {
      const a = da.exists, b = db.exists;
      if (a == null || b == null) return "na";
      if (a === b) {
        // Both cover (or both don't). An INBUILT cover beats an optional-only one.
        if (a === true && isOptional(da) !== isOptional(db)) return isOptional(da) ? "b" : "a";
        return "tie";
      }
      return a ? "a" : "b";
    }
    case "lower": {
      const a = num(da), b = num(db);
      if (a == null || b == null) return "na";
      if (a === b) return "tie";
      return applyOptionalGuard(a < b ? "a" : "b", da, db);
    }
    case "higher": {
      const a = num(da), b = num(db);
      if (a == null || b == null) return "na";
      if (a === b) return "tie";
      return applyOptionalGuard(a > b ? "a" : "b", da, db);
    }
    case "higher_ordinal": {
      const a = ord(da), b = ord(db);
      if (a == null || b == null) return "na";
      if (a === b) return "tie";
      return applyOptionalGuard(a > b ? "a" : "b", da, db);
    }
    default:
      return "na";
  }
}

const nameOf = (p: WordingProfile): string | null =>
  p.plan_name || p.insurer || null;

/**
 * Build the full side-by-side comparison from two extracted profiles.
 * Pure & deterministic — the verdict is explainable, not AI-generated.
 */
export function buildComparison(a: WordingProfile, b: WordingProfile): ComparisonResult {
  const rows: ComparisonRow[] = [];
  let scoreA = 0, scoreB = 0, winsA = 0, winsB = 0, ties = 0;
  const reasonCandidates: { weight: number; text: string; winner: Winner }[] = [];

  for (const def of AXES) {
    const da = asDatum(a[def.key]);
    const db = asDatum(b[def.key]);
    const winner = rankAxis(def, da, db);

    rows.push({
      key: def.key,
      label: def.label,
      group: def.group,
      a: { display: da.display ?? "—", note: da.note ?? null, optional: da.optional === true },
      b: { display: db.display ?? "—", note: db.note ?? null, optional: db.optional === true },
      winner,
    });

    if (def.weight > 0 && (winner === "a" || winner === "b")) {
      if (winner === "a") { scoreA += def.weight; winsA++; }
      else { scoreB += def.weight; winsB++; }
      const better = winner === "a" ? da.display : db.display;
      const worse = winner === "a" ? db.display : da.display;
      reasonCandidates.push({
        weight: def.weight,
        winner,
        text: `${def.label}: ${better} vs ${worse}`,
      });
    } else if (def.weight > 0 && winner === "tie") {
      ties++;
    }
  }

  // Group the rows in declared group order.
  const groups = (Object.keys(AXIS_GROUP_LABELS) as AxisGroup[]).map((g) => ({
    group: g,
    label: AXIS_GROUP_LABELS[g],
    rows: rows.filter((r) => r.group === g),
  }));

  // Overall winner from weighted score.
  let winner: Winner = "tie";
  if (scoreA > scoreB) winner = "a";
  else if (scoreB > scoreA) winner = "b";

  const winnerProfile = winner === "a" ? a : winner === "b" ? b : null;
  const total = scoreA + scoreB || 1;

  // Top reasons = highest-weight axes the winner actually won.
  const reasons = reasonCandidates
    .filter((r) => r.winner === winner)
    .sort((x, y) => y.weight - x.weight)
    .slice(0, 4)
    .map((r) => r.text);

  // Counterpoint = highest-weight axis the LOSER won (honest selling).
  const counterpoint =
    winner === "tie"
      ? null
      : reasonCandidates
          .filter((r) => r.winner !== winner)
          .sort((x, y) => y.weight - x.weight)
          .map((r) => r.text)[0] ?? null;

  return {
    a: { insurer: a.insurer, plan_name: a.plan_name, uin: a.uin, sum_insured_options: a.sum_insured_options, confidence: a.confidence },
    b: { insurer: b.insurer, plan_name: b.plan_name, uin: b.uin, sum_insured_options: b.sum_insured_options, confidence: b.confidence },
    groups,
    verdict: {
      winner,
      winner_name: winnerProfile ? nameOf(winnerProfile) : null,
      score_a: Math.round((scoreA / total) * 100),
      score_b: Math.round((scoreB / total) * 100),
      wins_a: winsA,
      wins_b: winsB,
      ties,
      reasons,
      counterpoint,
    },
  };
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
