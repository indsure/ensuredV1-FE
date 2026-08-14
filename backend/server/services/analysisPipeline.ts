import fs from "fs";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { MASTER_AUDIT_PROMPT } from "../promptTemplate";
import { LIFE_INSURANCE_PROMPT } from "../lifeInsurancePrompt";
import { VEHICLE_INSURANCE_PROMPT } from "../vehicleInsurancePrompt";
import { AIService } from "./aiService";
import {
  extractPolicyMetadata,
  fetchPolicyWordings,
  mergePolicyTexts
} from "../utils/policyWordingsFetcher";
import { applyScoreBucketing, getBucketingExplanation } from "../utils/scoreBucketing";
import { AI_CONFIG } from "../config/ai_config";
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
const VERDICT_DISPLAY_MAX: Record<string, number> = {
  SAFE: 100,
  BORDERLINE: 62.5,
  RISKY: 37.5,
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

/**
 * The score is rebuilt from `breakdown`, so a breakdown value that exceeds its
 * cap silently corrupts the score. Clamp before the arithmetic runs.
 */
export function enforceBreakdownCaps(parsed: any) {
  const breakdown = parsed?.audit_score?.breakdown;
  if (!breakdown) return;
  for (const [key, cap] of Object.entries(BREAKDOWN_CAPS)) {
    const value = breakdown[key];
    if (typeof value === "number" && value > cap) {
      console.warn(`[Pipeline] breakdown.${key}=${value} exceeds cap ${cap}; clamping.`);
      breakdown[key] = cap;
      pushConfidenceNote(
        parsed,
        `Scoring ledger corrected server-side: ${key} exceeded its maximum of ${cap}.`
      );
    }
  }
}

/**
 * Required Cover Threshold by scoring age (eldest insured) and zone — the table
 * from SCORING SYSTEM / STEP 1 of the audit prompt, in code.
 */
const RCT_TABLE: { maxAge: number; A: number; BD: number; C: number }[] = [
  { maxAge: 39,       A: 1000000, BD: 800000,  C: 600000 },
  { maxAge: 55,       A: 1500000, BD: 1200000, C: 800000 },
  { maxAge: 65,       A: 2000000, BD: 1500000, C: 1000000 },
  { maxAge: Infinity, A: 2500000, BD: 2000000, C: 1200000 },
];

/** Penalty bands for NCAR, also from STEP 1. */
function netCoverPenaltyFor(ncar: number): number {
  if (ncar >= 1.0) return 0;
  if (ncar >= 0.75) return 10;
  if (ncar >= 0.5) return 25;
  if (ncar >= 0.3) return 40;
  return 60;
}

export function lookupRequiredCover(age: number, zone: string): number | null {
  if (!Number.isFinite(age)) return null;
  const row = RCT_TABLE.find((r) => age <= r.maxAge);
  if (!row) return null;
  const z = (zone || "").toUpperCase();
  if (z === "A") return row.A;
  if (z === "C") return row.C;
  if (z === "B" || z === "D") return row.BD;
  return null;
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
export function enforceRequiredCover(parsed: any) {
  const ages: number[] = (parsed?.identity?.ages ?? [])
    .map((a: any) => parseInt(String(a).replace(/[^0-9]/g, ""), 10))
    .filter((n: number) => Number.isFinite(n) && n > 0 && n < 120);
  if (ages.length === 0) return;

  const eldest = Math.max(...ages);
  const expected = lookupRequiredCover(eldest, parsed?.identity?.assumed_zone);
  if (expected === null) return;

  const stated = parsed?.audit_score?.rct;
  if (typeof stated === "number" && Math.abs(stated - expected) < 1) return; // already right

  if (!parsed.audit_score) return;
  parsed.audit_score.rct = expected;
  pushConfidenceNote(
    parsed,
    `Required cover corrected server-side to ₹${expected.toLocaleString("en-IN")} for age ${eldest} in zone ${
      parsed?.identity?.assumed_zone ?? "?"
    } (stated: ${typeof stated === "number" ? "₹" + stated.toLocaleString("en-IN") : "none"}).`
  );

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

    // Step 3: Merge texts. Companion covers are appended AFTER the base policy
    // and its official wording, clearly fenced so the model never mistakes them
    // for the document under audit. Metadata (step 1) deliberately ran on the
    // base text alone, so insurer/product still identify the audited policy.
    const mergedPolicyText =
      mergePolicyTexts(policyText, wordingsText) + buildCompanionDocuments(companions);

    // Capture whether wording was matched
    const wordingMatched = wordingsText !== null && wordingsText.trim().length > 0;

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
      { feature: "policy_audit", ...usageMeta }
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

    // RCT first: NCAR, the net-cover penalty, the score and the verdict all
    // derive from it, so it has to be right before anything downstream runs.
    enforceRequiredCover(parsed);
    enforceBreakdownCaps(parsed);
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

    return {
      status: "completed",
      result: {
        ...parsed,
        __internal: {
          policyText: mergedPolicyText,
        },
      },
      metadata: metadata,
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
