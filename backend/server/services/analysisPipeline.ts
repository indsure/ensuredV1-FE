import fs from "fs";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { MASTER_AUDIT_PROMPT, PROMPT_VERSION } from "../promptTemplate";
import { LIFE_INSURANCE_PROMPT } from "../lifeInsurancePrompt";
import { VEHICLE_INSURANCE_PROMPT } from "../vehicleInsurancePrompt";
import { AIService } from "./aiService";
import {
  extractPolicyMetadata,
  appearsInDocument,
  fetchPolicyWordings,
  mergePolicyTexts
} from "../utils/policyWordingsFetcher";
import { applyScoreBucketing, getBucketingExplanation } from "../utils/scoreBucketing";
import { AI_CONFIG } from "../config/ai_config";
import {
  applyPolicyInputBudget,
  approximatePageCount,
  InputTooLargeError,
} from "../utils/inputBudget";
import type { GeminiCallMeta } from "./geminiUsage";

/**
 * A second health cover the SAME insured already holds, uploaded alongside the
 * base policy. These are read in the same audit call so the report can reason
 * about the whole stack (does the super top-up deductible actually bridge the
 * base cover, does the corporate cover vanish on a job change, …) instead of
 * judging the base policy in isolation.
 */
export type CompanionKind = "super_topup" | "corporate" | "ayushman";

export interface CompanionDoc {
  kind: CompanionKind;
  /** Extracted document text. Empty when the cover was declared but not uploaded. */
  text?: string;
  /** True when the agent ticked "has this cover" without attaching a document. */
  declaredOnly?: boolean;
}

const COMPANION_LABEL: Record<CompanionKind, string> = {
  super_topup: "SUPER TOP-UP / TOP-UP POLICY (same insured)",
  corporate: "CORPORATE / EMPLOYER GROUP HEALTH POLICY (same insured)",
  ayushman: "AYUSHMAN BHARAT PM-JAY (government scheme, same insured)",
};

/** Per-document cap on appended companion text. A base audit already runs a
 *  large prompt; three untrimmed companion policies could double the token
 *  bill for context that is only used qualitatively. */
const COMPANION_TEXT_CHAR_CAP = 20000;

/**
 * The rules for handling companion covers. These are interpolated INTO the audit
 * prompt ({{COMPANION_RULES}}), not appended after the policy text: instructions
 * that trail 40k characters of schedules get skimmed, which is exactly how an
 * uploaded corporate policy ended up reduced to a single passing mention.
 *
 * Scoring stays deliberately untouched — the audit score must keep meaning "how
 * good is THIS policy", so companion cover drives other_cover, cover_stack, the
 * narrative and the recommendations, never the NEC/NCAR arithmetic.
 */
export function buildCompanionRules(companions: CompanionDoc[]): string {
  const usable = companions.filter((c) => c.declaredOnly || (c.text && c.text.trim()));
  if (usable.length === 0) {
    // No companions: the two blocks must not be invented from the base policy.
    return `### OTHER COVER HELD (MANDATORY)

No other cover was supplied for this insured. Set "other_cover" to an empty array
and every field of "cover_stack" to null except verdict, which must be "unclear".
Do NOT infer other cover from mentions inside the base policy document.`;
  }

  const supplied = usable
    .map((c) => `  - ${COMPANION_LABEL[c.kind]}${c.declaredOnly ? " — DECLARED ONLY, no document supplied" : ""}`)
    .join("\n");

  return `### OTHER COVER HELD BY THIS INSURED (MANDATORY — DO NOT SKIP)

Additional health cover held by the SAME insured has been supplied at the end of
the policy text, fenced under "ADDITIONAL COVER HELD BY THE SAME INSURED". It is
NOT the policy under audit. Supplied:

${supplied}

**Scoring is unaffected.** audit_score, NEC, RCT and NCAR remain a verdict on the
BASE policy ALONE. Do NOT add this cover into NEC and do NOT soften any penalty
because of it — a score must stay comparable with audits run without these
documents.

You MUST produce one "other_cover" entry per cover listed above, and you MUST
fill "cover_stack". A supplied cover that is missing from other_cover is a failed
audit. Specifically:

- **Super top-up / top-up:** also fill coverage_structure.top_up and/or
  coverage_structure.super_top_up — sum_insured, deductible, type — and set
  deductible_achievable by checking whether the BASE sum insured plus accrued NCB
  actually reaches that deductible. State plainly in remarks whether the base
  policy's own defects (room rent proportionate deduction, sub-limits) mean the
  insured cannot in practice spend their way up to the deductible.
- **Corporate / employer cover:** dependency_risk MUST state that it ends with
  the job — on resignation, termination or retirement — and MUST name any
  dependent age-out date stated in the document. own_limits MUST list its OWN
  co-payment, room rent cap and disease sub-limits; these are usually WORSE than
  the retail policy and do not disappear because a retail policy exists.
- **Ayushman Bharat PM-JAY:** ₹5L family floater, cashless only at empanelled
  hospitals, subject to scheme eligibility. Never treat it as a substitute for
  retail cover; if eligibility is unverified, set usable_today to false.
- **Any cover blocked today** by an unexpired waiting period, an unbridgeable
  deductible or an unverified eligibility rule: set usable_today to false,
  EXCLUDE it from cover_stack.combined_effective_cover, and give the reason in
  cover_stack.excluded.
- **counted_in_total must be set on every entry.** Employment-linked corporate
  cover is usable_today true but counted_in_total FALSE — it is real today and
  gone the day the job ends, so it cannot be relied on for cover adequacy. Every
  entry with counted_in_total false must appear in cover_stack.excluded with its
  reason, and vice versa.
- Add one confidence_note naming each companion document you actually read.

cover_stack.combined_effective_cover = base NEC + only those covers with
usable_today true. required_cover = the same RCT used in the score. Set verdict
by stack_ratio: >= 1.0 ADEQUATE, 0.6-0.99 THIN, < 0.6 INADEQUATE.`;
}

/**
 * The companion documents themselves, fenced and appended after the base policy
 * text and its matched wording. Rules for using them live in the prompt above.
 */
export function buildCompanionDocuments(companions: CompanionDoc[]): string {
  const usable = companions.filter((c) => c.declaredOnly || (c.text && c.text.trim()));
  if (usable.length === 0) return "";

  const blocks = usable
    .map((c) => {
      const header = `--- ${COMPANION_LABEL[c.kind]} ---`;
      if (c.declaredOnly || !c.text?.trim()) {
        return `${header}\n(The agent confirmed the insured holds this cover but did not upload a document. Treat it as existing but with unknown terms — do NOT assume limits, set usable_today to false, and note the missing document in confidence_notes.)`;
      }
      const text = c.text.trim();
      const clipped = text.length > COMPANION_TEXT_CHAR_CAP;
      return `${header}\n${text.slice(0, COMPANION_TEXT_CHAR_CAP)}${
        clipped ? "\n[…document truncated for length — base your remarks only on what is shown above…]" : ""
      }`;
    })
    .join("\n\n");

  return `

==================== ADDITIONAL COVER HELD BY THE SAME INSURED ====================

These are NOT the policy under audit. They are other health covers the same
insured already holds. Handle them exactly as instructed under "OTHER COVER HELD
BY THIS INSURED" in your instructions — one other_cover entry each, plus
cover_stack.

${blocks}

==================== END OF ADDITIONAL COVER ====================
`;
}

/**
 * Today's date as YYYY-MM-DD in IST. Deliberately NOT toISOString() — that is
 * UTC, so between 00:00 and 05:30 IST every audit would be stamped with
 * yesterday's date and every waiting period would look a day less served.
 */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export interface AnalysisResult {
  status: "completed" | "failed";
  result?: any;
  error?: string;
  metadata?: any;
  duration?: {
    extraction: number;
    fetch: number;
    ai: number;
    total: number;
  };
}

export function validateParsedReport(parsed: any): { valid: boolean; reason?: string } {
  if (!parsed || typeof parsed !== "object") return { valid: false, reason: "Response is not an object" };
  if (parsed.error && parsed.message) return { valid: false, reason: parsed.message };

  // Required top-level keys for a health audit report
  const required = ["audit_score", "final_verdict"];
  for (const key of required) {
    if (!(key in parsed)) {
      return { valid: false, reason: `Missing required field: ${key}` };
    }
  }

  if (typeof parsed.audit_score?.score !== "number") {
    return { valid: false, reason: "audit_score.score must be a number" };
  }

  return { valid: true };
}

/**
 * Usability check handed to AIService so the usage ledger can tell a billed
 * success from a billed failure. Mirrors what the pipeline does with the
 * response below (strip fences → parse → schema check); returns null when the
 * response is fine, or a reason string when it is not.
 */
export function validateAuditResponse(rawText: string): string | null {
  const cleaned = rawText.replace(/```json|```/g, "").trim();
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return "JSON parse failed";
  }
  const validation = validateParsedReport(parsed);
  return validation.valid ? null : (validation.reason ?? "schema validation failed");
}

function pushConfidenceNote(parsed: any, note: string) {
  if (Array.isArray(parsed.confidence_notes)) {
    parsed.confidence_notes.push(note);
  } else if (typeof parsed.confidence_notes === "string") {
    parsed.confidence_notes += ` ${note}`;
  } else {
    parsed.confidence_notes = [note];
  }
}

// Highest display bucket each verdict band is allowed to show, so the
// bucketed score can never visually contradict the verdict label.
/** The highest score each verdict may display: the top bucket strictly inside
 *  that verdict's band. VERDICT RULES put RISKY below 50 and BORDERLINE below
 *  70, so on the 5-point grid those ceilings are 45 and 65. These were 37.5 and
 *  62.5, the same ceilings on the old 12.5 grid; leaving them would have let a
 *  clamp put a non-multiple-of-5 score on screen. */
const VERDICT_DISPLAY_MAX: Record<string, number> = {
  SAFE: 100,
  BORDERLINE: 65,
  RISKY: 45,
};

/**
 * Make final_verdict.label a deterministic function of the (raw) score and
 * NCAR, applying the authoritative VERDICT RULES from the prompt. This removes
 * drift between the AI's free-text label and the computed score, which the
 * bucketing step would otherwise amplify into visible contradictions.
 * Must run on the RAW score, BEFORE bucketing.
 */
export function reconcileVerdict(parsed: any) {
  if (!parsed?.audit_score || !parsed?.final_verdict) return;
  const score = parsed.audit_score.score;
  if (typeof score !== "number") return;
  const ncar = typeof parsed.audit_score.ncar === "number" ? parsed.audit_score.ncar : null;

  let canonical: "SAFE" | "BORDERLINE" | "RISKY";
  if (ncar !== null && ncar < 0.5) {
    canonical = "RISKY"; // NCAR auto-failure takes precedence over score
  } else if (score >= 70 && (ncar === null || ncar >= 0.75)) {
    canonical = "SAFE";
  } else if (score >= 50 || (ncar !== null && ncar >= 0.5)) {
    canonical = "BORDERLINE";
  } else {
    canonical = "RISKY";
  }

  if (parsed.final_verdict.label !== canonical) {
    pushConfidenceNote(
      parsed,
      `Verdict reconciled server-side from "${parsed.final_verdict.label}" to "${canonical}" to match score (${score}) and NCAR (${ncar ?? "n/a"}).`
    );
    parsed.final_verdict.label = canonical;
  }
}

/**
 * Ensure the (bucketed) display score does not sit in a higher band than the
 * verdict label implies — e.g. a BORDERLINE policy must not display 75.
 * Must run AFTER bucketing.
 */
export function clampDisplayScoreToVerdict(parsed: any) {
  const label = parsed?.final_verdict?.label;
  const max = VERDICT_DISPLAY_MAX[label];
  if (parsed?.audit_score && typeof parsed.audit_score.score === "number" && typeof max === "number") {
    if (parsed.audit_score.score > max) {
      parsed.audit_score.score = max;
    }
  }
}

/** Per-category caps from the prompt's SCORING SYSTEM. net_cover_penalty is
 *  uncapped by design (Step 1 is applied first and not capped). */
const BREAKDOWN_CAPS: Record<string, number> = {
  claim_rejection_risk: 30,
  oop_exposure: 30,
  coverage_quality_gap: 20,
};

/** Every field the score is rebuilt from. net_cover_penalty carries no cap here
 *  (STEP 1 is explicitly "NOT CAPPED"; its ladder tops out at 60 on its own) but
 *  it still has to be sign-normalised, because enforceRequiredCover only rewrites
 *  it on the health path and returns early when ages or zone are unusable. */
const BREAKDOWN_FIELDS = [
  "claim_rejection_risk",
  "oop_exposure",
  "coverage_quality_gap",
  "net_cover_penalty",
] as const;

/**
 * The score is rebuilt from `breakdown`, so a breakdown value that exceeds its
 * cap silently corrupts the score. Clamp before the arithmetic runs.
 */
export function enforceBreakdownCaps(parsed: any) {
  const breakdown = parsed?.audit_score?.breakdown;
  if (!breakdown) return;

  for (const key of BREAKDOWN_FIELDS) {
    const value = breakdown[key];
    if (typeof value !== "number") continue;

    // NaN/Infinity would flow into performScoreArithmeticCheck and poison the
    // sum, where every comparison against NaN is false and the bad score is
    // therefore never corrected. Zero it and say so.
    if (!Number.isFinite(value)) {
      breakdown[key] = 0;
      pushConfidenceNote(
        parsed,
        `Scoring ledger corrected server-side: ${key} was not a finite number and was treated as 0.`
      );
      continue;
    }

    let next = value;

    // SIGN. The prompt writes every penalty as "-15", so the model sometimes
    // emits the minus with it. None of these fields can ever be a bonus, so the
    // sign carries no information — but performScoreArithmeticCheck sums them
    // raw, so a breakdown of -25/-30/-8/-10 became `100 - (-73)` = 173, which
    // bucketed to a displayed 100 and reconciled the verdict from RISKY to SAFE.
    // A policy the model itself scored 27 shipped as "Excellent". Three of the
    // first thirty stored reports carry negative penalties, so this is a live
    // input, not a hypothetical. Magnitude is what the model meant: on that
    // report it wrote score 27, which is 100 minus the absolute sum.
    if (next < 0) {
      next = Math.abs(next);
      console.warn(`[Pipeline] breakdown.${key}=${value} is negative; using magnitude ${next}.`);
      pushConfidenceNote(
        parsed,
        `Scoring ledger corrected server-side: ${key} was returned as a negative number and was read as a deduction of ${next}.`
      );
    }

    // CAP. Applied after the sign fix, so a "-45" is capped at 30 rather than
    // sailing through because it was below the ceiling as a negative.
    const cap = BREAKDOWN_CAPS[key];
    if (cap !== undefined && next > cap) {
      console.warn(`[Pipeline] breakdown.${key}=${next} exceeds cap ${cap}; clamping.`);
      next = cap;
      pushConfidenceNote(
        parsed,
        `Scoring ledger corrected server-side: ${key} exceeded its maximum of ${cap}.`
      );
    }

    breakdown[key] = next;
  }
}

/**
 * Which scoring rules produced a report.
 *
 * Separate from PROMPT_VERSION because the two move independently: the prompt
 * can gain a field without any change to how a score is arrived at, and the
 * server-side arithmetic can change without a word of the prompt moving.
 *
 * Bump this whenever a stored report would score differently on the same input.
 * That is the whole contract. A report carrying an older stamp is not wrong, it
 * was scored under rules that no longer apply, and saying so is the difference
 * between an explanation and an unexplained number.
 *
 *   1.0.0  the rules as they stood before this was recorded. Never stamped, so
 *          an absent stamp means this or older.
 *   2.0.0  2026-09-11. Required cover re-anchored to what one admission costs,
 *          from the calculator's own figures; the floater multiplier removed,
 *          because a single-event threshold must not carry multi-event risk;
 *          the NCAR penalty changed from four steps to the prompt's continuous
 *          curve. Same policy, materially different score.
 */
export const SCORING_VERSION = "2.0.0";

/**
 * Record which rules scored this report, so a reader is never left comparing a
 * number against rules it was not produced under.
 *
 * Stored beside the report rather than inside audit_score, so it survives any
 * future rewrite of the score object and can be read without knowing anything
 * about scoring.
 */
export function stampEngineVersion(parsed: any) {
  if (!parsed || typeof parsed !== "object") return;
  parsed.engine = {
    prompt_version: PROMPT_VERSION,
    scoring_version: SCORING_VERSION,
    scored_at: new Date().toISOString().split("T")[0],
  };
}

/**
 * What one bad hospital admission costs, by age.
 *
 * These are the cover calculator's own anchors, copied from
 * frontend/client/src/lib/health-engine-logic.ts. They are duplicated rather
 * than imported for the same reason computeSingleEventCover is: the backend has
 * no @shared alias and the EC2 box runs tsx over backend/server alone, so a
 * cross-directory import that resolves locally and not on the box would take the
 * paid audit path down at boot. requiredCover.test.ts pins the two together.
 *
 * They replace a separate table the audit used to carry, which said a family
 * under 40 in Pune needed ₹8L while the calculator, for the same man on the same
 * day, priced a bad admission at ₹14L. One product, one event, two answers 75%
 * apart, and the ₹8L one decided whether a policy scored as well covered.
 *
 * Treat these as a product judgement about what we are willing to recommend, not
 * as a sourced medical statistic, and do not cite IRDAI against them.
 */
const WORST_CASE_BY_AGE: { maxAge: number; cost: number }[] = [
  { maxAge: 34,       cost: 1400000 },
  { maxAge: 44,       cost: 1750000 },
  { maxAge: 54,       cost: 2500000 },
  { maxAge: 64,       cost: 3500000 },
  { maxAge: 74,       cost: 4500000 },
  { maxAge: Infinity, cost: 5000000 },
];

/** Also the calculator's, where they are named Metro / Tier-1 / Tier-2. */
const ZONE_COST_MULTIPLIER: Record<string, number> = { A: 1.15, B: 1.05, D: 1.05, C: 1.0 };

/**
 * The NCAR penalty curve from STEP 1 of the prompt.
 *
 * This used to be four step bands (0/10/25/40/60) while the prompt specified a
 * continuous formula, so the same policy scored differently depending on which
 * of the two you read. At NCAR 0.89 the prompt says 4 and the bands said 10.
 * The prompt is the rulebook; the bands are gone.
 */
export function netCoverPenaltyFor(ncar: number): number {
  if (ncar >= 1.0) return 0;
  if (ncar >= 0.75) return Math.round((10 * (1.0 - ncar)) / 0.25);
  if (ncar >= 0.5) return Math.round(10 + (15 * (0.75 - ncar)) / 0.25);
  if (ncar >= 0.3) return Math.round(25 + (15 * (0.5 - ncar)) / 0.2);
  return Math.min(60, Math.round(40 + (20 * (0.3 - ncar)) / 0.3));
}

/**
 * Required cover: what a single bad admission costs this insured, today.
 *
 * Deliberately NOT scaled by how many lives share the policy. A car crash does
 * not cost more because there are more names on the card, and RCT is defined
 * throughout the prompt as a single-event threshold. The old ×1.4 / ×1.7 floater
 * multiplier was pricing the risk of a SECOND admission inside a single-event
 * number, at 40% where the calculator prices the same risk at 8%. That risk is
 * real and it belongs in the multi-year target the report shows alongside this,
 * not in the threshold the score is measured against.
 */
export function lookupRequiredCover(age: number, zone: string): number | null {
  if (!Number.isFinite(age)) return null;
  const row = WORST_CASE_BY_AGE.find((r) => age <= r.maxAge);
  if (!row) return null;
  const mult = ZONE_COST_MULTIPLIER[(zone || "").toUpperCase()];
  if (mult === undefined) return null;
  // To the nearest ₹50,000, so the printed table in the prompt and the value
  // computed here are the same number and enforceRequiredCover has nothing to
  // correct on a run where the model read the table properly.
  return Math.round((row.cost * mult) / 50000) * 50000;
}

/**
 * RCT is a fixed lookup on age band and zone, so there is no reason to trust a
 * model with it — and when it drifts, everything downstream drifts with it:
 * NCAR, the net-cover penalty, the verdict, and cover_stack's denominator. One
 * observed run returned Rs 2.8 crore where the table says Rs 20 lakh, turning a
 * 0.29 NCAR into 0.02 and the cover stack into "9% of what you need".
 *
 * Recomputes RCT from identity, and if the model disagreed, corrects NCAR, the
 * net-cover penalty and the cover_stack denominator to match.
 */
const positive = (v: any): number =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;

/**
 * Single-event cover, computed from structured fields.
 *
 * MUST stay identical to calculateEffectiveCoverage in shared/policy.ts. It is
 * duplicated rather than imported because the backend has no @shared alias and the
 * EC2 box runs tsx over backend/server alone: a cross-directory import that resolves
 * locally and not on the box would take the paid audit path down at boot, which is
 * exactly how the last outage happened. effectiveCover.test.ts pins the two together.
 */
export function computeSingleEventCover(parsed: any): number {
  const cs = parsed?.coverage_structure;
  const base = positive(cs?.base_sum_insured);

  // Without a base, a bonus and a top-up are both undefined quantities. 0 means
  // "not extracted" and callers leave the report alone.
  if (base <= 0) return 0;

  // current_bonus is specified as absolute rupees but is populated as a percentage
  // in places (motor NCB is a percentage by nature). A value too small to be rupees
  // is discarded, never rescaled. A value above its own cap is a unit error and is
  // also discarded, NOT clamped to base: clamping would turn a bad 5Cr bonus into a
  // clean-looking 2Cr headline on a 1Cr policy.
  const rawNcb = positive(cs?.no_claim_bonus?.exists ? cs.no_claim_bonus.current_bonus : 0);
  const capPct = positive(cs?.no_claim_bonus?.cap_percentage);
  const ceiling = capPct > 0 ? base * (capPct / 100) : base;
  const ncb = rawNcb <= 100 || rawNcb > ceiling ? 0 : rawNcb;

  const topUp = cs?.top_up?.exists && cs.top_up.deductible_achievable === true
    ? positive(cs.top_up.sum_insured)
    : 0;

  const superTopUp = cs?.super_top_up?.exists && cs.super_top_up.deductible_achievable === true
    ? positive(cs.super_top_up.sum_insured)
    : 0;

  return base + ncb + topUp + superTopUp;
}

/**
 * Forces the three numbers that describe one quantity to agree.
 *
 * coverage_structure.total_effective_coverage (the report header),
 * audit_score.nec (NCAR, the net-cover penalty, the verdict) and
 * cover_stack.combined_effective_cover (the stack and the PDF) were each written
 * independently by the model with nothing reconciling them. Report 1b520f0d showed
 * 2.0Cr in its header against a 1Cr policy while scoring NCAR on 1.0Cr, in the same
 * report, because the model added a restoration tranche to two of the three.
 *
 * Runs BEFORE enforceRequiredCover, which divides nec by the RCT.
 */
export function reconcileEffectiveCover(parsed: any) {
  if (!parsed?.coverage_structure) return;

  const computed = computeSingleEventCover(parsed);
  if (computed <= 0) return; // nothing extracted; leave the model's view alone

  const statedTotal = parsed.coverage_structure.total_effective_coverage;
  const statedNec = parsed?.audit_score?.nec;
  const drifted =
    (typeof statedTotal === "number" && Math.abs(statedTotal - computed) >= 1) ||
    (typeof statedNec === "number" && Math.abs(statedNec - computed) >= 1);

  parsed.coverage_structure.total_effective_coverage = computed;
  if (parsed.audit_score) parsed.audit_score.nec = computed;

  // NCAR is derived from nec, so a changed nec with an unchanged ratio beside it is
  // the same contradiction in a new place. enforceRequiredCover recomputes this too,
  // but it early-returns when identity.ages is missing (ages is not a required
  // field), which would strand the ratio here. Deriving it now means the two numbers
  // can never be seen disagreeing, whichever path runs.
  const rct = positive(parsed?.audit_score?.rct);
  if (parsed.audit_score && rct > 0) {
    parsed.audit_score.ncar = Number((computed / rct).toFixed(4));
    if (parsed.audit_score.breakdown) {
      parsed.audit_score.breakdown.net_cover_penalty = netCoverPenaltyFor(parsed.audit_score.ncar);
    }
  }

  // The stack is this policy plus other covers the same insured holds. The companion
  // portion is taken as whatever the stack held beyond this policy's own stated
  // total, rather than re-summed from other_cover: usable_today is optional there,
  // so a re-sum silently drops any companion policy that omitted it while the prose
  // beside the total still lists that policy as counted.
  if (parsed.cover_stack) {
    const statedCombined = positive(parsed.cover_stack.combined_effective_cover);
    const baseline = positive(statedTotal) || computed;
    const others = Math.max(0, statedCombined - baseline);
    const combined = computed + others;
    parsed.cover_stack.combined_effective_cover = combined;

    const stackRct = positive(parsed.cover_stack.required_cover) || rct;
    if (stackRct > 0) {
      const ratio = Number((combined / stackRct).toFixed(2));
      parsed.cover_stack.required_cover = stackRct;
      parsed.cover_stack.stack_ratio = ratio;
      parsed.cover_stack.verdict = ratio >= 1.0 ? "ADEQUATE" : ratio >= 0.6 ? "THIN" : "INADEQUATE";
    }

    // A restore must not survive in the prose after being removed from the number,
    // or the list contradicts the total it is supposed to explain.
    if (Array.isArray(parsed.cover_stack.counted)) {
      const kept = parsed.cover_stack.counted.filter((s: any) => !/restor/i.test(String(s)));
      if (kept.length !== parsed.cover_stack.counted.length) {
        parsed.cover_stack.counted = kept;
        if (!Array.isArray(parsed.cover_stack.excluded)) parsed.cover_stack.excluded = [];
        parsed.cover_stack.excluded.push(
          "Restoration: refills the cover for a later claim, so it is not counted toward what this policy can pay for one event."
        );
      }
    }

    // Remarks were written against the total before it was restated.
    if (drifted) parsed.cover_stack.remarks = null;
  }

  if (drifted) {
    pushConfidenceNote(
      parsed,
      `Effective cover corrected server-side to ₹${computed.toLocaleString("en-IN")} ` +
        `(single-event: base sum insured + accrued bonus + any bridged top-up). ` +
        `Restoration is excluded from this figure and is scored separately.`
    );
  }
}

export function enforceRequiredCover(parsed: any) {
  const ages: number[] = (parsed?.identity?.ages ?? [])
    .map((a: any) => parseInt(String(a).replace(/[^0-9]/g, ""), 10))
    .filter((n: number) => Number.isFinite(n) && n > 0 && n < 120);
  if (ages.length === 0) return;

  const eldest = Math.max(...ages);
  const expected = lookupRequiredCover(eldest, parsed?.identity?.assumed_zone);
  if (expected === null) return;

  if (!parsed.audit_score) return;

  // A correct RCT does NOT imply a correct NCAR. This used to return early here
  // whenever the model happened to state the right threshold, which skipped the
  // recomputation below and shipped whatever ratio the model had written. Report
  // 1b520f0d stated rct 6L (right), nec 2Cr and ncar 16.67 — and 2Cr/6L is 33.3,
  // so the ratio matched neither its own numerator nor anything else, and survived
  // untouched. NCAR is now always derived, never accepted.
  const stated = parsed.audit_score.rct;
  const rctWasWrong = !(typeof stated === "number" && Math.abs(stated - expected) < 1);

  if (rctWasWrong) {
    parsed.audit_score.rct = expected;
    pushConfidenceNote(
      parsed,
      `Required cover corrected server-side to ₹${expected.toLocaleString("en-IN")} for age ${eldest} in zone ${
        parsed?.identity?.assumed_zone ?? "?"
      } (stated: ${typeof stated === "number" ? "₹" + stated.toLocaleString("en-IN") : "none"}).`
    );
  }

  const nec = parsed.audit_score.nec;
  if (typeof nec !== "number" || expected <= 0) return;

  const ncar = Number((nec / expected).toFixed(4));
  parsed.audit_score.ncar = ncar;

  // The penalty follows the corrected NCAR band. performScoreArithmeticCheck
  // (which runs after this) recomputes the score from the breakdown.
  if (parsed.audit_score.breakdown) {
    parsed.audit_score.breakdown.net_cover_penalty = netCoverPenaltyFor(ncar);
  }

  // cover_stack quotes the same threshold — keep the two from disagreeing.
  if (parsed.cover_stack && typeof parsed.cover_stack.combined_effective_cover === "number") {
    parsed.cover_stack.required_cover = expected;
    const ratio = Number((parsed.cover_stack.combined_effective_cover / expected).toFixed(2));
    parsed.cover_stack.stack_ratio = ratio;
    parsed.cover_stack.verdict = ratio >= 1.0 ? "ADEQUATE" : ratio >= 0.6 ? "THIN" : "INADEQUATE";
  }
}

export function performScoreArithmeticCheck(parsed: any) {
  if (parsed.audit_score && parsed.audit_score.breakdown) {
    const breakdown = parsed.audit_score.breakdown;
    const sum = (breakdown.net_cover_penalty || 0) +
                (breakdown.claim_rejection_risk || 0) +
                (breakdown.oop_exposure || 0) +
                (breakdown.coverage_quality_gap || 0);
    let expectedScore = Math.max(0, 100 - sum);

    // NCAR auto-failure caps the score at 40 (prompt: STEP 1 / FINAL SCORE), so
    // the recomputed score must respect it too — otherwise the arithmetic check
    // would undo the cap the model correctly applied.
    const ncar = parsed.audit_score.ncar;
    if (typeof ncar === "number" && ncar < 0.5) {
      expectedScore = Math.min(expectedScore, 40);
    }

    if (Math.abs(expectedScore - parsed.audit_score.score) > 2) {
      console.warn(`[Pipeline] Score mismatch warning: Original AI score=${parsed.audit_score.score}, Corrected=${expectedScore}`);
      parsed.audit_score.score = expectedScore;

      const overrideNote = "Score recalculated server-side due to arithmetic mismatch from AI output.";
      if (Array.isArray(parsed.confidence_notes)) {
        parsed.confidence_notes.push(overrideNote);
      } else if (typeof parsed.confidence_notes === "string") {
        parsed.confidence_notes += ` ${overrideNote}`;
      } else {
        parsed.confidence_notes = [overrideNote];
      }
    }
  }
}


export async function runAnalysisPipeline(
  policyText: string,
  insuranceType: string = "health",
  usageMeta?: Partial<GeminiCallMeta>,
  companions: CompanionDoc[] = []
): Promise<AnalysisResult> {
  const startTime = Date.now();
  let extractionTime = 0;
  let fetchTime = 0;
  let aiTime = 0;

  try {
    if (!policyText.trim()) {
      return { status: "failed", error: "No text extracted from file" };
    }

    // Step 1: Extract metadata
    const metadataStartTime = Date.now();
    const metadata = await extractPolicyMetadata(policyText);
    extractionTime = Date.now() - metadataStartTime;

    // Step 2: Fetch official wordings if available
    let wordingsText: string | null = null;
    if (metadata.insurer && metadata.product) {
      const fetchStartTime = Date.now();
      wordingsText = await fetchPolicyWordings(
        metadata.insurer,
        metadata.product || "",
        metadata.plan || "",
        metadata.year || ""
      );
      fetchTime = Date.now() - fetchStartTime;
    }

    // Step 3: Enforce the input budget, THEN merge.
    //
    // This is the cap that was missing: policy text used to go straight from
    // the PDF extractor into the prompt with no size check, which is how one
    // audit reached 542,778 input tokens and returned 23 unusable ones.
    // Oversized-but-recoverable inputs are truncated (wordings first) and
    // flagged; anything past the hard ceiling throws before any spend.
    //
    // Companion covers are folded into the evidence BEFORE budgeting rather
    // than appended after it. Each companion is already capped individually by
    // COMPANION_TEXT_CHAR_CAP, but N of them are not, and a budget that some of
    // the payload walks around is not a budget. They sit at the tail, clearly
    // fenced, so the model still never mistakes them for the document under
    // audit. Metadata (step 1) deliberately ran on the base text alone, so
    // insurer/product still identify the audited policy.
    const evidenceText = policyText + buildCompanionDocuments(companions);

    let budget;
    try {
      budget = applyPolicyInputBudget(evidenceText, wordingsText);
    } catch (err: any) {
      if (err instanceof InputTooLargeError) {
        console.error(
          `[Pipeline] Rejected oversized document before any Gemini spend: ` +
          `~${err.estimatedTokens.toLocaleString("en-US")} tokens (~${err.approxPages} pages), ` +
          `ceiling ${err.limitTokens.toLocaleString("en-US")}.`
        );
        return { status: "failed", error: err.message };
      }
      throw err;
    }

    if (budget.truncated) {
      console.warn(
        `[Pipeline] Input over budget — truncated ${budget.truncatedSections.join(", ")}: ` +
        `~${budget.originalTokens.toLocaleString("en-US")} → ${budget.estimatedTokens.toLocaleString("en-US")} tokens.`
      );
    }

    const mergedPolicyText = mergePolicyTexts(budget.evidence, budget.wordings);

    // Capture whether wording was matched
    const wordingMatched = budget.wordings !== null && budget.wordings.trim().length > 0;

    // Step 4: Select prompt
    let promptToUse = MASTER_AUDIT_PROMPT;
    if (insuranceType === "life") promptToUse = LIFE_INSURANCE_PROMPT;
    else if (insuranceType === "vehicle") promptToUse = VEHICLE_INSURANCE_PROMPT;

    // Interpolate wording matched variable
    promptToUse = promptToUse.replace("{{WORDING_MATCHED}}", wordingMatched ? "true" : "false");

    // Companion-cover rules go INSIDE the prompt, not after the policy text.
    // The life/vehicle prompts carry no placeholder, so this is a no-op there.
    promptToUse = promptToUse.replace("{{COMPANION_RULES}}", buildCompanionRules(companions));

    // Interpolate today's date. Without this the model has no anchor for "today"
    // and every waiting-period field (is_active_today, months_remaining,
    // policy_age_days, policy_fully_active) drifts toward its training cutoff.
    // Global replace: the token appears in several sections of the prompt.
    promptToUse = promptToUse.replace(/\{\{ANALYSIS_DATE\}\}/g, todayISO());

    // Step 5: Call AI
    const aiStartTime = Date.now();
    const rawText = await AIService.generateContent(
      promptToUse,
      mergedPolicyText,
      AI_CONFIG.model,
      { feature: "policy_audit", ...usageMeta },
      // Let the ledger know whether the billed response was actually usable.
      // Without this, a response we cannot parse is still filed as status 'ok'.
      { validateResponse: validateAuditResponse }
    );
    aiTime = Date.now() - aiStartTime;

    // Step 6: Parse JSON
    const cleanedText = rawText.replace(/```json|```/g, "").trim();
    let parsed: any;
    try {
      parsed = JSON.parse(cleanedText);
    } catch {
      return { status: "failed", error: "Invalid AI response format — JSON parse failed" };
    }

    // Step 7: Validate schema before returning
    const validation = validateParsedReport(parsed);
    if (!validation.valid) {
      console.error("[Pipeline] Schema validation failed:", validation.reason);
      return { status: "failed", error: `AI response validation failed: ${validation.reason}` };
    }

    // Cover first: enforceRequiredCover divides audit_score.nec by the RCT, so the
    // nec it reads has to be the reconciled single-event figure, not the model's.
    // HEALTH ONLY. "Single-event cover" is a health concept and the other lines of
    // business mean different things by the same field: the motor prompt maps
    // total_effective_coverage to the IDV (vehicleInsurancePrompt.ts) and states NCB
    // as a percentage, and the life prompt lets riders carry their own sums that
    // legitimately belong in the total. Running the health definition over either
    // would rewrite a correct number into a wrong one.
    if (insuranceType === "health") reconcileEffectiveCover(parsed);
    // RCT next: NCAR, the net-cover penalty, the score and the verdict all
    // derive from it, so it has to be right before anything downstream runs.
    enforceRequiredCover(parsed);
    enforceBreakdownCaps(parsed);
    // A truncated document must never yield a report that looks complete —
    // the score is derived from clauses that may have been in the omitted
    // region, so the user has to be told the audit saw only part of the file.
    if (budget.truncated) {
      pushConfidenceNote(
        parsed,
        `Document exceeded the analysis input budget (~${budget.originalTokens.toLocaleString("en-US")} tokens, ` +
        `roughly ${approximatePageCount(budget.originalTokens)} pages). ` +
        `${budget.truncatedSections.join(" and ")} were partially omitted, so this score may be incomplete — ` +
        `clauses in the omitted section could not be assessed.`
      );
    }

    performScoreArithmeticCheck(parsed);

    // Lock the verdict label to the (raw) score + NCAR before bucketing
    reconcileVerdict(parsed);

    // Apply score bucketing to reduce variance
    if (parsed.audit_score) {
      parsed.audit_score = applyScoreBucketing(parsed.audit_score);

      // Keep the bucketed display score inside the verdict's band
      clampDisplayScoreToVerdict(parsed);

      // Add bucketing explanation to confidence notes
      pushConfidenceNote(parsed, getBucketingExplanation());
    }

    // Last, so it records the rules everything above actually ran under.
    stampEngineVersion(parsed);

    const planCandidate =
      metadata.product ||
      metadata.plan ||
      (parsed as any)?.coverage_structure?.policy_name ||
      null;
    const planVerified = appearsInDocument(planCandidate, mergedPolicyText);

    // The full policy text is deliberately NOT attached to the result.
    //
    // It used to ride along as `__internal.policyText` and got persisted into
    // clients.report_data, which the PUBLIC share endpoint returns wholesale —
    // so anyone holding a share link could read the entire source document,
    // policyholder phone, address, DOB, nominees and medical declaration
    // included. Nothing ever read it back: it is an input to this pipeline, not
    // an output. See stripInternal() in routes.ts for the guard that protects
    // reports already stored with it.
    return {
      status: "completed",
      result: {
        ...parsed,
      },
      metadata: {
        ...metadata,
        // Resolve the plan name ONCE, here, where the document text is still in
        // scope, and say plainly whether it was read from that document.
        //
        // The three callers used to each pick `product || plan ||
        // coverage_structure.policy_name` and store the winner as fact. None of
        // them could tell a reading from a guess, so an alias match on the word
        // "restore" was written to clients.policy_name and printed to a customer
        // as their plan. A name only counts as read if it is actually in the
        // document; anything else is offered to the advisor as a suggestion.
        planName: planCandidate,
        planNameVerified: planVerified,
        input_budget: {
          original_tokens: budget.originalTokens,
          sent_tokens: budget.estimatedTokens,
          truncated: budget.truncated,
          truncated_sections: budget.truncatedSections,
        },
      },
      duration: {
        extraction: extractionTime,
        fetch: fetchTime,
        ai: aiTime,
        total: Date.now() - startTime
      }
    };

  } catch (err: any) {
    console.error("Analysis Pipeline Error:", err);
    return {
      status: "failed",
      error: err.message || "Unknown analysis error"
    };
  }
}
