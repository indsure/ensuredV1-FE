/**
 * Gemini page read for scanned car policies.
 *
 * Tesseract reads a scanned schedule's names, numbers and dates well and its
 * premium tables badly. On a car policy those tables are the add-on list and
 * the own-damage figures, which is everything the add-on card and the motor
 * score are built from, so a scan read by Tesseract alone could never be
 * scored. Real case, 2026-10-28: a Universal Sompo car policy put through
 * "Print to PDF" came back with 93 letters on its add-on page and a premium
 * table at 65% confidence, and scored nothing.
 *
 * So only those pages, at most VISION_MAX_PAGES of them, are sent to Gemini as
 * images and copied out word for word. Gemini transcribes; it does not judge.
 * Its text replaces Tesseract's for those pages and goes through the same
 * add-on detector as a text PDF.
 *
 * Paid, so it runs only when all of these hold: the PDF had no text layer, the
 * OCR text reads like a car or bike policy, and at least one page looks like
 * an add-on or premium page. Every call is written to the usage ledger, and
 * the daily spend ceiling is checked first. Any failure keeps the Tesseract
 * text, so the upload never fails because of this step.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { logGeminiUsage, extractUsage, isOverDailyCeiling, type GeminiCallMeta } from "../geminiUsage";
import { renderPage } from "./render";

export const VISION_MAX_PAGES = 3;
export const VISION_FEATURE = "motor_scan_vision";

/** Signals that the text is a motor policy. Two different ones are required. */
const MOTOR_SIGNALS = [
  /own\s*damage/i,
  /\bidv\b|insured\s*declared\s*value/i,
  /chassis/i,
  /engine\s*(no|number)/i,
  /registration\s*(no|number|mark)/i,
  /cubic\s*capacity|\bcc\b/i,
];

export function isMotorText(text: string): boolean {
  return MOTOR_SIGNALS.filter((re) => re.test(text)).length >= 2;
}

/**
 * Patterns that mark a page as one the add-on card needs. Each pattern that
 * matches adds one to the page's weight. A plain "premium" is not here: every
 * page of terms and disclaimers says it.
 */
const PAGE_SIGNALS = [
  /add[\s-]*on/i,
  /own\s*damage\s*premium|\bod\s*premium|basic\s*od|total\s*od/i,
  /premium\s*(details|schedule|computation|break)/i,
  /zero\s*dep|nil\s*dep|depreciation\s*(waiver|cover|reimbursement)/i,
  /engine\s*(protect|secure|guard)|return\s*to\s*invoice|consumables?|key\s*(replacement|protect)/i,
];

/**
 * The pages to send, 1-based, in document order. Heaviest pages win when more
 * than VISION_MAX_PAGES qualify.
 */
export function pickVisionPages(pages: { index: number; text: string }[]): number[] {
  return pages
    .map((p) => ({ index: p.index, weight: PAGE_SIGNALS.filter((re) => re.test(p.text)).length }))
    .filter((p) => p.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index)
    .slice(0, VISION_MAX_PAGES)
    .map((p) => p.index)
    .sort((a, b) => a - b);
}

const PROMPT =
  "Each image is one page of an Indian motor insurance policy. Copy out every word and number on each page exactly as printed. " +
  "Keep each table row on one line, with its cells in order separated by \" | \". Keep rupee amounts, minus signs and brackets exactly. " +
  "Include Yes/No, ticks and crosses as written. Do not summarise, correct, translate or add anything that is not printed. " +
  "If a part is unreadable, write [unreadable] in its place. " +
  "Return JSON only: {\"pages\": [{\"page\": <the page number given before the image>, \"text\": \"...\"}]}";

/**
 * The parsed reply, or null when it is not the shape asked for or names a
 * page that was not sent.
 */
export function parseVisionReply(raw: string, sent: number[]): Map<number, string> | null {
  let parsed: any;
  try {
    parsed = JSON.parse(raw.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ""));
  } catch {
    return null;
  }
  if (!parsed || !Array.isArray(parsed.pages)) return null;
  const out = new Map<number, string>();
  for (const p of parsed.pages) {
    const page = typeof p?.page === "string" ? Number(p.page.replace(/\D/g, "")) : p?.page;
    if (typeof page !== "number" || typeof p.text !== "string") return null;
    if (!sent.includes(page)) return null;
    const text = p.text.replace(/\u0000/g, "").trim();
    if (text) out.set(page, text);
  }
  return out.size > 0 ? out : null;
}

export type VisionResult = {
  pages: Map<number, string>;
  model: string;
  tokens: ReturnType<typeof extractUsage>;
};

/** Gemini's copy of the given pages, or null. Never throws. */
export async function transcribePages(
  pdfBytes: Uint8Array,
  pageIndexes: number[],
  meta?: Partial<GeminiCallMeta>
): Promise<VisionResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || pageIndexes.length === 0) return null;
  if (await isOverDailyCeiling()) return null;

  const usageMeta: GeminiCallMeta = { ...meta, feature: VISION_FEATURE };
  const modelName = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  const startedAt = Date.now();
  try {
    const parts: any[] = [{ text: PROMPT }];
    for (const index of pageIndexes) {
      const { png } = await renderPage(pdfBytes, index);
      parts.push({ text: `Page ${index}:` }, { inlineData: { data: png.toString("base64"), mimeType: "image/png" } });
    }
    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model: modelName,
      generationConfig: { temperature: 0, topP: 1, responseMimeType: "application/json", maxOutputTokens: 32768 },
    });
    const result = await model.generateContent({ contents: [{ role: "user", parts }] });
    const tokens = extractUsage(result.response);
    const raw = result.response.text();
    const pages = parseVisionReply(raw, pageIndexes);
    // Why a billed reply was not used. Never the text itself: it is a policy.
    const finish = result.response.candidates?.[0]?.finishReason ?? "unknown";
    if (!pages) console.warn(`[scanVision] reply not used: finish=${finish} chars=${raw.length} tokens=${JSON.stringify(tokens)}`);
    void logGeminiUsage(usageMeta, {
      model: modelName,
      tokens,
      status: pages ? "ok" : "degraded",
      latencyMs: Date.now() - startedAt,
      errorMessage: pages ? null : `reply was not the page JSON asked for (finish=${finish}, ${raw.length} chars)`,
    });
    return pages ? { pages, model: modelName, tokens } : null;
  } catch (err: any) {
    console.warn(`[scanVision] call failed: ${err?.message ?? err}`);
    void logGeminiUsage(usageMeta, {
      model: modelName,
      status: "error",
      latencyMs: Date.now() - startedAt,
      errorMessage: err?.message ?? String(err),
    });
    return null;
  }
}
