/**
 * Lightweight OCR/data-entry extraction for non-health insurance types.
 * Reuses the same Gemini model as the audit pipeline, but performs ONE cheap
 * call that only reads the flat fields defined in extractionFields.ts.
 * No scoring, no forensic audit.
 */

import { AIService } from "./aiService";
import { AI_CONFIG } from "../config/ai_config";
import type { GeminiCallMeta } from "./geminiUsage";
import {
  EXTRACTION_FIELDS,
  buildExtractionPrompt,
  isDataEntryType,
  type FieldType,
} from "./extractionFields";
import { detectMotorAddOns, ADD_ON_FINDINGS_KEY } from "../../../shared/motorAddOns";

export interface ExtractionResult {
  status: "completed" | "failed";
  data?: Record<string, any>;
  error?: string;
}

function coerce(value: any, type: FieldType): any {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  // json fields carry a nested object (the charge table); pass it through as-is.
  if (type === "json") return typeof value === "object" ? value : null;
  if (type === "number") {
    if (typeof value === "number") return value;
    const cleaned = String(value).replace(/[^0-9.\-]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  // text / date kept as trimmed strings
  return typeof value === "string" ? value.trim() : value;
}

export async function extractStructuredData(
  policyText: string,
  type: string,
  usageMeta?: Partial<GeminiCallMeta>
): Promise<ExtractionResult> {
  if (!policyText.trim()) {
    return { status: "failed", error: "No text extracted from file" };
  }
  if (!isDataEntryType(type)) {
    return { status: "failed", error: `Unsupported data-entry type: ${type}` };
  }

  const fields = EXTRACTION_FIELDS[type];
  const prompt = buildExtractionPrompt(type);

  let rawText: string;
  try {
    rawText = await AIService.generateContent(prompt, policyText, AI_CONFIG.model, {
      feature: "data_entry",
      ...usageMeta,
    });
  } catch (err: any) {
    return { status: "failed", error: err?.message || "AI extraction failed" };
  }

  const cleaned = rawText.replace(/```json|```/g, "").trim();
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { status: "failed", error: "Invalid AI response format — JSON parse failed" };
  }
  if (!parsed || typeof parsed !== "object") {
    return { status: "failed", error: "AI response was not a JSON object" };
  }

  // Keep only known keys, coerce to the declared type, default missing to null.
  const data: Record<string, any> = {};
  for (const f of fields) {
    data[f.key] = coerce(parsed[f.key], f.type);
  }

  /* The add-on checklist is read from the same text, in code, with no second
     model call and no extra cost. It is deliberately NOT an extraction field:
     the review form renders every field as a text input, and a text input
     would stringify this object and destroy it on the next save.

     Wrapped because a detector fault must never cost the agent their data
     entry. A missing checklist is a missing card; a thrown error is a policy
     that failed to import. */
  if (type === "motor") {
    try {
      const scan = detectMotorAddOns(policyText);
      if (scan) data[ADD_ON_FINDINGS_KEY] = scan;
    } catch (err: any) {
      console.warn("[add-ons] detection failed, continuing without it:", err?.message);
    }
  }

  return { status: "completed", data };
}
