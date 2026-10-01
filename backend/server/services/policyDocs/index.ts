/**
 * Policy document rules: the deterministic path from a PDF to reviewed terms.
 *
 * read text (embedded first, OCR only for failing pages)
 *   -> match one registered product adapter by insurer + UIN + option + layout
 *   -> parse fields with sources
 *
 * Nothing in this folder imports the AI service or any model client, and a
 * test enforces that. If no adapter matches, the answer is "unsupported";
 * there is no model fallback.
 */

import type { ParseOutcome } from "../../../../shared/policyDocTypes";
import { absliNishchitAayushV01 } from "./adapters/absliNishchitAayushV01";
import { hdfcClick2AchieveV02 } from "./adapters/hdfcClick2AchieveV02";
import { identifyAndParse, register, registeredAdapters } from "./registry";
import { acquireText, DocumentReadError, EXTRACTOR_ID, EXTRACTOR_VERSION, type DocumentText, type PageOcr } from "./textLayer";

// Registration: one line per supported product.
if (!registeredAdapters().some((a) => a.id === hdfcClick2AchieveV02.id)) register(hdfcClick2AchieveV02);
if (!registeredAdapters().some((a) => a.id === absliNishchitAayushV01.id)) register(absliNishchitAayushV01);

export interface DocumentParseResult {
  outcome: ParseOutcome;
  sha256: string;
  pageCount: number;
  pageMethods: { page: number; method: string; ocrConfidence: number | null; usable: boolean }[];
  extractor: { id: string; version: string };
}

export async function parsePolicyDocument(buf: Uint8Array, opts: { ocr?: PageOcr | null } = {}): Promise<DocumentParseResult> {
  const doc: DocumentText = await acquireText(buf, opts);
  return {
    outcome: identifyAndParse(doc),
    sha256: doc.sha256,
    pageCount: doc.pageCount,
    pageMethods: doc.pages.map((p) => ({ page: p.index, method: p.method, ocrConfidence: p.ocrConfidence, usable: p.quality.usable })),
    extractor: { id: EXTRACTOR_ID, version: EXTRACTOR_VERSION },
  };
}

export { DocumentReadError, registeredAdapters };
