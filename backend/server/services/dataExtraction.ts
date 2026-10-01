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
import { valuationDateIso } from "../../../shared/policyNumbers";
import { checkFieldSources, coerceLegacy, coerceStrict, fillNextPremiumDate } from "./extractionEvidence";

export interface ExtractionResult {
  status: "completed" | "failed";
  data?: Record<string, any>;
  error?: string;
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
  // A value outside the strict grammar is null, with what was read kept under
  // `_unparsed` for a person to correct (see extractionEvidence.ts).
  const data: Record<string, any> = {};
  const unparsed: Record<string, string> = {};
  for (const f of fields) {
    const strict = type === "life" || type === "term";
    const c = (strict ? coerceStrict : coerceLegacy)(parsed[f.key], f.type as FieldType);
    data[f.key] = c.value;
    if (c.unparsed !== null) unparsed[f.key] = c.unparsed;
  }
  if (Object.keys(unparsed).length) data._unparsed = unparsed;

  // Life and term: check each source excerpt against the text, and label the
  // next premium date as stated or scheduled. Never a statement about payment.
  if ("field_sources" in data) {
    data.field_sources = checkFieldSources(data, policyText, new Set(fields.map((f) => f.key)));
  }
  fillNextPremiumDate(data, valuationDateIso());

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
