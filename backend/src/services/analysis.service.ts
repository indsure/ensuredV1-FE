import fs from "fs";
import type { Express } from "express";
import type { AnalysisJob } from "../interfaces";
import { extractPolicyText } from "./extraction.service";
import { AIService } from "./ai.service";
import { AI_CONFIG } from "../config";
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
import { getRAGService } from "./rag.service";
import type { UserProfile } from "../types/userProfile";

export async function runAnalysisPipeline(
  job: AnalysisJob,
  jobId: string,
  uploadedFile: Express.Multer.File,
  insuranceType: string,
  userProfile?: UserProfile
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

    // Step 2: Try RAG-based context assembly first, fallback to legacy
    let policyText: string;
    let ragProvenance: any = null;

    if (process.env.DATABASE_URL && metadata.insurer && metadata.product) {
      try {
        console.log(`[Job ${jobId}] Using RAG pipeline for context assembly...`);
        const ragService = getRAGService();
        const ragContext = await ragService.assembleContext({
          uploadedPolicyText,
          insurer: metadata.insurer,
          plan: metadata.product || metadata.plan || "",
          year: metadata.year ? Number(metadata.year) : undefined,
          userProfile,
          queryType: "analyze",
        });

        policyText = ragContext.contextText;
        ragProvenance = ragContext.provenance;

        console.log(
          `[Job ${jobId}] RAG context assembled: ${ragContext.chunksUsed} chunks, coverage=${ragContext.kbCoverage}`
        );
      } catch (ragErr) {
        console.warn(`[Job ${jobId}] RAG failed, falling back to legacy:`, (ragErr as Error).message);
        policyText = await legacyContextAssembly(jobId, uploadedPolicyText, metadata);
      }
    } else {
      policyText = await legacyContextAssembly(jobId, uploadedPolicyText, metadata);
    }

    console.log(`[Job ${jobId}] Final context length:`, policyText.length);

    // Select prompt based on insurance type
    let promptToUse = MASTER_AUDIT_PROMPT;

    if (insuranceType === "life") {
      promptToUse = LIFE_INSURANCE_PROMPT;
    } else if (insuranceType === "vehicle") {
      promptToUse = VEHICLE_INSURANCE_PROMPT;
    }

    // Call AIService with correct model name
    console.log(`[Job ${jobId}] Calling AIService with model: ${AI_CONFIG.model}...`);

    let rawText: string;
    try {
      rawText = await AIService.generateContent(
        promptToUse,
        policyText,
        AI_CONFIG.model
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

    // Structural suitability check — prefer user profile over AI-parsed data
    const suitabilityProfile = {
      age: userProfile?.age ?? (parsed.identity?.ages?.[0]
        ? parseInt(parsed.identity.ages[0])
        : 35),
      cityTier: userProfile?.cityTier ?? (
        parsed.identity?.assumed_zone === "A"
          ? ("Tier 1" as const)
          : ("Tier 2" as const)
      ),
      hasPED: userProfile?.preExistingConditions?.length
        ? userProfile.preExistingConditions.length > 0
        : parsed.identity?.health_flags?.length > 0,
      pedCount: userProfile?.preExistingConditions?.length ?? undefined,
      familySize: userProfile?.familySize,
    };

    const suitability = SuitabilityEngine.evaluate(
      parsed.coverage_structure?.base_sum_insured || 500000,
      suitabilityProfile,
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
      rag_provenance: ragProvenance,
      __internal: {
        policyText: uploadedPolicyText,
        insurer: metadata.insurer,
        plan: metadata.product || metadata.plan,
        year: metadata.year,
      },
    };
    job.completedAt = Date.now();
    console.log(job.result);
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
      errorMessage = `AI model '${AI_CONFIG.model}' not found or not available. Please check your API key and model availability.`;
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

// Legacy context assembly (fallback when DB is not available)
async function legacyContextAssembly(
  jobId: string,
  uploadedPolicyText: string,
  metadata: { insurer: string | null; product: string | null; plan: string | null; year: string | number | null }
): Promise<string> {
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
  }

  return mergePolicyTexts(uploadedPolicyText, wordingsText);
}
