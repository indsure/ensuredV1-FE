/**
 * Upload hook: read a life/term policy PDF with the deterministic path and
 * record the result for advisor review. Runs on its own, independent of any
 * model extraction on the same upload, so a model failure or a missing model
 * key never stops it, and nothing it records can be written by a model.
 *
 * Failures are recorded as a parse with status "failed" and a reason code.
 * Nothing from the document is logged.
 */

import { parsePolicyDocument, DocumentReadError } from "./index";
import { tesseractOcr } from "./ocr";
import { EXTRACTOR_ID, EXTRACTOR_VERSION, sha256 } from "./textLayer";
import { recordParse, type DbTx } from "../policyDocStore";

export type IngestResult =
  | { ok: true; status: string; parseId: string; created: boolean }
  | { ok: false; code: string };

const FAILED_TEXT: Record<string, string> = {
  not_a_pdf: "This file is not a PDF.",
  too_large: "This PDF is too large to read here.",
  too_many_pages: "This PDF has too many pages to read here.",
  password_protected: "This PDF is password protected. Upload an unlocked copy.",
  corrupt: "This PDF could not be opened.",
  empty: "No readable text was found in this PDF, even with OCR.",
  ocr_unavailable: "This PDF is scanned and OCR is not available.",
  timeout: "Reading this PDF took too long.",
};

export async function ingestPolicyDocument(db: DbTx, agentId: string, clientId: string, bytes: Uint8Array, storageRef: string | null): Promise<IngestResult> {
  try {
    const r = await parsePolicyDocument(bytes, { ocr: tesseractOcr });
    const rec = await recordParse(db, agentId, clientId, {
      sha256: r.sha256, byteSize: bytes.byteLength, pageCount: r.pageCount, storageRef,
      extractor: r.extractor, pageMethods: r.pageMethods, outcome: r.outcome,
    });
    return { ok: true, status: r.outcome.status, parseId: rec.parseId, created: rec.created };
  } catch (e: any) {
    const code = e instanceof DocumentReadError ? e.code : e?.code === "timeout" ? "timeout" : "failed";
    // Record the failure so the advisor sees why, without any document content.
    try {
      if (code !== "failed") {
        await recordParse(db, agentId, clientId, {
          sha256: sha256(bytes), byteSize: Math.max(bytes.byteLength, 1), pageCount: 1, storageRef,
          extractor: { id: EXTRACTOR_ID, version: EXTRACTOR_VERSION }, pageMethods: [],
          outcome: { status: "failed", adapterId: null, adapterVersion: null, reasons: [FAILED_TEXT[code] ?? "This PDF could not be read."], fields: {}, flags: [] },
        });
      }
    } catch { /* ownership or DB errors surface through the code below */ }
    console.warn(`[policy-doc] ingest failed: ${code}`);
    return { ok: false, code };
  }
}
