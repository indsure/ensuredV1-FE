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

    // Step 4: Select prompt
    let promptToUse = MASTER_AUDIT_PROMPT;
    if (insuranceType === "life") promptToUse = LIFE_INSURANCE_PROMPT;
    else if (insuranceType === "vehicle") promptToUse = VEHICLE_INSURANCE_PROMPT;

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
      return { status: "failed", error: "Invalid AI response format" };
    }

    if (parsed.error && parsed.message) {
      return { status: "failed", error: parsed.message };
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
