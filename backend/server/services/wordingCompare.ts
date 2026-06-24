/**
 * Compare feature — extract a normalized WordingProfile from raw policy-wording text.
 *
 * One Gemini call per wording, deterministic (temp 0), result memoised by a hash of
 * the source text so re-comparing the same PDF in a session costs nothing. (A
 * DB-backed cache keyed on file SHA-256 is layered on at the route in Phase 2.)
 */
import crypto from "crypto";
import { AIService } from "./aiService";
import { AI_CONFIG } from "../config/ai_config";
import {
  buildExtractionPrompt,
  type WordingProfile,
} from "../types/wordingProfile";

// Process-lifetime memo. Key = sha256(policyText). Small + bounded in practice.
const profileCache = new Map<string, WordingProfile>();

export function hashText(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function coerceProfile(parsed: any): WordingProfile {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI response was not a JSON object");
  }
  // Trust the shape loosely; buildComparison() is defensive about missing axes.
  const conf = parsed.confidence;
  parsed.confidence = conf === "high" || conf === "medium" || conf === "low" ? conf : "low";
  parsed.insurer = parsed.insurer ?? null;
  parsed.plan_name = parsed.plan_name ?? null;
  parsed.uin = parsed.uin ?? null;
  parsed.sum_insured_options = parsed.sum_insured_options ?? null;
  return parsed as WordingProfile;
}

export async function extractWordingProfile(policyText: string): Promise<WordingProfile> {
  // PDF text extractors (pdfjs) insert a space between every text fragment, which
  // can balloon a 30-page wording past 700k chars. Collapse runs of whitespace so
  // the WHOLE document fits under the model cap — otherwise the tail sections
  // (waiting periods, moratorium, fine print) get truncated and read "Not specified".
  const text = (policyText || "")
    .replace(/[ \t ]{2,}/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!text) throw new Error("No text extracted from wording PDF");

  const key = hashText(text);
  const cached = profileCache.get(key);
  if (cached) return cached;

  // gemini-3.5-flash has a ~1M-token window; a normalized wording is well under
  // that. Cap generously so the full document is seen, not just the opening pages.
  const MAX_CHARS = 500_000;
  const userContent = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;

  const raw = await AIService.generateContent(buildExtractionPrompt(), userContent, AI_CONFIG.model);
  const cleaned = raw.replace(/```json|```/g, "").trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Gemini occasionally wraps or trails text; salvage the outermost JSON object.
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Invalid AI response format — JSON parse failed");
    }
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  }

  const profile = coerceProfile(parsed);
  profileCache.set(key, profile);
  return profile;
}
