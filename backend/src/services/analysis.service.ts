import fs from "fs";
import type { Express } from "express";
import type { AnalysisJob } from "../interfaces";
import { extractPolicyText } from "./extraction.service";
import { AIService } from "./ai.service";
import {
  MASTER_AUDIT_PROMPT,
  LIFE_INSURANCE_PROMPT,
  VEHICLE_INSURANCE_PROMPT,
} from "../constants";
import {
  extractPolicyMetadata,
  fetchPolicyWordings,
  mergePolicyTexts,
} from "../utils/policyWordingsFetcher";
import { SuitabilityEngine } from "./suitability.service";

export async function runAnalysisPipeline(
  job: AnalysisJob,
  jobId: string,
  uploadedFile: Express.Multer.File,
  insuranceType: string
): Promise<void> {
  let globalTimeout: NodeJS.Timeout | undefined;

  try {
    globalTimeout = setTimeout(() => {
      if (job && job.status === "processing") {
        console.error(`[Job ${jobId}] GLOBAL TIMEOUT - Force failing job`);
        job.status = "failed";
        job.error =
          "Analysis timed out (global limit exceeded). Please try again.";
        job.completedAt = Date.now();
      }
    }, 6 * 60 * 1000);

    job.status = "processing";
    console.log(`[Job ${jobId}] Starting background analysis...`);

    const uploadedPolicyText = await extractPolicyText(uploadedFile);
    fs.unlinkSync(uploadedFile.path);

    if (!uploadedPolicyText.trim()) {
      job.status = "failed";
      job.error = "No text extracted from file";
      job.completedAt = Date.now();
      return;
    }

    console.log(
      `[Job ${jobId}] EXTRACTED TEXT LENGTH:`,
      uploadedPolicyText.length
    );

    // Step 1: Extract policy metadata
    console.log(`[Job ${jobId}] Extracting policy metadata...`);
    const metadata = await extractPolicyMetadata(uploadedPolicyText);
    console.log(`[Job ${jobId}] Metadata extracted:`, metadata);

    // Step 2: Fetch official policy wordings if metadata available
    let wordingsText: string | null = null;
    if (metadata.insurer && metadata.product) {
      console.log(
        `[Job ${jobId}] Fetching policy wordings for ${metadata.insurer} - ${metadata.product}...`
      );
      wordingsText = await fetchPolicyWordings(
        metadata.insurer,
        metadata.product || "",
        metadata.plan || "",
        metadata.year || ""
      );
      if (wordingsText) {
        console.log(
          `[Job ${jobId}] Policy wordings fetched, length:`,
          wordingsText.length
        );
      } else {
        console.log(
          `[Job ${jobId}] Policy wordings not found, proceeding with uploaded document only`
        );
      }
    } else {
      console.log(
        `[Job ${jobId}] Insufficient metadata to fetch wordings, proceeding with uploaded document only`
      );
    }

    // Step 3: Merge uploaded text with wordings
    const policyText = mergePolicyTexts(uploadedPolicyText, wordingsText);
    console.log(`[Job ${jobId}] Merged text length:`, policyText.length);

    // Select prompt based on insurance type
    let promptToUse = MASTER_AUDIT_PROMPT;

    if (insuranceType === "life") {
      promptToUse = LIFE_INSURANCE_PROMPT;
    } else if (insuranceType === "vehicle") {
      promptToUse = VEHICLE_INSURANCE_PROMPT;
    }

    // Call AIService
    console.log(`[Job ${jobId}] Calling AIService...`);

    let rawText: string;
    try {
      rawText = await AIService.generateContent(
        promptToUse,
        policyText,
        "gemini-3-pro-preview"
      );
    } catch (aiError: any) {
      console.error(`[Job ${jobId}] AI Service Error:`, aiError);
      throw aiError;
    }

    console.log(
      `[Job ${jobId}] AI Response received (length: ${rawText.length})`
    );

    const cleanedText = rawText.replace(/```json|```/g, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(cleanedText);
    } catch {
      job.status = "failed";
      job.error = "Invalid AI response format";
      job.completedAt = Date.now();
      return;
    }

    if (parsed.error && parsed.message) {
      job.status = "failed";
      job.error = parsed.message;
      job.completedAt = Date.now();
      return;
    }

    // Structural suitability check
    const userProfile = {
      age: parsed.identity?.ages?.[0]
        ? parseInt(parsed.identity.ages[0])
        : 35,
      cityTier:
        parsed.identity?.assumed_zone === "A"
          ? ("Tier 1" as const)
          : ("Tier 2" as const),
      hasPED: parsed.identity?.health_flags?.length > 0,
    };

    const suitability = SuitabilityEngine.evaluate(
      parsed.coverage_structure?.base_sum_insured || 500000,
      userProfile,
      parsed.claim_risk_analysis
    );

    // Hard override
    if (suitability.structural_verdict === "RISKY") {
      console.log(
        `[Job ${jobId}] STRUCTURAL FAILURE: BCAR ${suitability.bcar_ratio}. Forcing RISKY.`
      );
      parsed.final_verdict.label = "RISKY";
      parsed.final_verdict.summary = `STRUCTURAL FAILURE (BCAR < 0.4). ${parsed.final_verdict.summary}`;
      if (parsed.audit_ledger?.final_score > 50) {
        parsed.audit_ledger.final_score = 50;
      }
    }

    // Store result
    job.status = "completed";
    job.result = {
      ...parsed,
      suitability_analysis: suitability,
      __internal: {
        policyText,
      },
    };
    job.completedAt = Date.now();
    console.log(`[Job ${jobId}] Analysis completed successfully`);
    if (globalTimeout) clearTimeout(globalTimeout);
  } catch (err: any) {
    console.error(`[Job ${jobId}] Processing error:`, err);
    console.error("Error stack:", err.stack);

    // Clean up uploaded file if it exists
    if (uploadedFile && fs.existsSync(uploadedFile.path)) {
      try {
        fs.unlinkSync(uploadedFile.path);
      } catch (unlinkErr) {
        console.error("Failed to delete uploaded file:", unlinkErr);
      }
    }

    // Provide more helpful error messages
    let errorMessage = err.message || "Unknown error";

    if (
      errorMessage.includes("404") ||
      errorMessage.includes("not found")
    ) {
      errorMessage = `Model 'gemini-3-pro-preview' not found or not available. This could mean: 1) The model name is incorrect, 2) Your API key doesn't have access to this model, 3) The model is not available in your region. Please check your GEMINI_API_KEY and verify model availability.`;
    } else if (
      errorMessage.includes("fetch failed") ||
      errorMessage.includes("ECONNREFUSED") ||
      errorMessage.includes("ENOTFOUND")
    ) {
      errorMessage =
        "Network error: Unable to connect to Gemini API. Please check your internet connection and try again.";
    } else if (
      errorMessage.includes("API_KEY") ||
      errorMessage.includes("401") ||
      errorMessage.includes("403")
    ) {
      errorMessage =
        "API authentication failed. Please check your GEMINI_API_KEY in the .env.local file.";
    } else if (
      errorMessage.includes("quota") ||
      errorMessage.includes("429")
    ) {
      errorMessage =
        "API quota exceeded. Please check your Gemini API usage limits.";
    }

    job.status = "failed";
    job.error = errorMessage;
    job.completedAt = Date.now();
    if (globalTimeout) clearTimeout(globalTimeout);
  }
}
