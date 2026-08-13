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
  usageMeta?: Partial<GeminiCallMeta>
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

    // Step 3: Merge texts
    const mergedPolicyText = mergePolicyTexts(policyText, wordingsText);

    // Capture whether wording was matched
    const wordingMatched = wordingsText !== null && wordingsText.trim().length > 0;

    // Step 4: Select prompt
    let promptToUse = MASTER_AUDIT_PROMPT;
    if (insuranceType === "life") promptToUse = LIFE_INSURANCE_PROMPT;
    else if (insuranceType === "vehicle") promptToUse = VEHICLE_INSURANCE_PROMPT;

    // Interpolate wording matched variable
    promptToUse = promptToUse.replace("{{WORDING_MATCHED}}", wordingMatched ? "true" : "false");

    // Interpolate today's date. Without this the model has no anchor for "today"
    // and every waiting-period field (is_active_today, months_remaining,
    // policy_age_days, policy_fully_active) drifts toward its training cutoff.
    // Global replace: the token appears in several sections of the prompt.
    promptToUse = promptToUse.replace(/{{ANALYSIS_DATE}}/g, todayISO());

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
