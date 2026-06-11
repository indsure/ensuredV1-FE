/**
 * Lightweight OCR/data-entry extraction for non-health insurance types.
 * Reuses the same Gemini model as the audit pipeline, but performs ONE cheap
 * call that only reads the flat fields defined in extractionFields.ts.
 * No scoring, no forensic audit.
 */

import { AIService } from "./aiService";
import { AI_CONFIG } from "../config/ai_config";
import {
  EXTRACTION_FIELDS,
  buildExtractionPrompt,
  isDataEntryType,
  type FieldType,
} from "./extractionFields";

export interface ExtractionResult {
  status: "completed" | "failed";
  data?: Record<string, any>;
  error?: string;
}

function coerce(value: any, type: FieldType): any {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
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
  type: string
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
    rawText = await AIService.generateContent(prompt, policyText, AI_CONFIG.model);
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

  return { status: "completed", data };
}
