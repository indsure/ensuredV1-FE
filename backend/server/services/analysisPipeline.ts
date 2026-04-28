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

export function performScoreArithmeticCheck(parsed: any) {
  if (parsed.audit_score && parsed.audit_score.breakdown) {
    const breakdown = parsed.audit_score.breakdown;
    const sum = (breakdown.net_cover_penalty || 0) +
                (breakdown.claim_rejection_risk || 0) +
                (breakdown.oop_exposure || 0) +
                (breakdown.coverage_quality_gap || 0);
    const expectedScore = Math.max(0, 100 - sum);

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
  insuranceType: string = "health"
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

    // Step 5: Call AI
    const aiStartTime = Date.now();
    const rawText = await AIService.generateContent(
      promptToUse,
      mergedPolicyText,
      "gemini-3.1-pro-preview"
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

    performScoreArithmeticCheck(parsed);

    // Apply score bucketing to reduce variance
    if (parsed.audit_score) {
      parsed.audit_score = applyScoreBucketing(parsed.audit_score);
      
      // Add bucketing explanation to confidence notes
      const bucketingNote = getBucketingExplanation();
      if (Array.isArray(parsed.confidence_notes)) {
        parsed.confidence_notes.push(bucketingNote);
      } else if (typeof parsed.confidence_notes === "string") {
        parsed.confidence_notes += ` ${bucketingNote}`;
      } else {
        parsed.confidence_notes = [bucketingNote];
      }
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
