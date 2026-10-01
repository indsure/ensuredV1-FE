/**
 * Document text acquisition for policy PDFs. No model call anywhere.
 *
 * 1. Each page's embedded text is read with pdf.js, keeping every fragment's
 *    position. Lines are rebuilt from positions, and a two-column page is
 *    split at its empty vertical gutter, so a clause in the left column is
 *    never glued to an unrelated clause on the right.
 * 2. Each page is graded. Only pages whose embedded text is missing or
 *    unusable are sent to OCR (a conventional engine, run locally), so a
 *    mostly digital PDF with one scanned page reads the scan and keeps the
 *    rest as printed.
 * 3. The printed page label ("Page 18 of 40") is kept beside the PDF index.
 *
 * The PDF is data. Nothing in it is followed, opened or executed: links,
 * scripts and form actions are never read. Errors carry codes, never page
 * text, so nothing from a customer document reaches the logs.
 */

import crypto from "node:crypto";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import type { ExtractionMethod, Region } from "../../../../shared/policyDocTypes";

export const EXTRACTOR_ID = "pdfjs-columns";
export const EXTRACTOR_VERSION = "1.0.0";

export const LIMITS = {
  maxBytes: 25 * 1024 * 1024,
  maxPages: 80,
  /** Embedded text below this many letters on a page sends the page to OCR. */
  minLettersPerPage: 40,
};

export interface TextItem {
  s: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Line {
  text: string;
  /** 0 = left column, 1 = right column, -1 = spans the page (headings, tables). */
  column: number;
  region: Region;
}

export interface PageText {
  /** 1-based index in the PDF. */
  index: number;
  printedLabel: string | null;
  method: ExtractionMethod;
  /** Engine's own confidence for OCR pages (0-100). Shown, never used to approve anything. */
  ocrConfidence: number | null;
  columns: 1 | 2;
  lines: Line[];
  /** The lines joined in reading order. */
  text: string;
  /** Positioned fragments (PDF units, y up), for tables whose cells wrap. */
  items: TextItem[];
  width: number;
  quality: { letters: number; usable: boolean };
}

export interface DocumentText {
  sha256: string;
  pageCount: number;
  pages: PageText[];
  extractor: { id: string; version: string };
  ocrUsed: boolean;
}

export type DocErrorCode =
  | "not_a_pdf" | "too_large" | "too_many_pages" | "password_protected" | "corrupt" | "empty" | "ocr_unavailable" | "timeout";

export class DocumentReadError extends Error {
  constructor(public code: DocErrorCode) {
    super(code);
    this.name = "DocumentReadError";
  }
}

/** OCR for one page. Implemented in ./ocr; injectable so tests can run with or without it. */
export interface PageOcr {
  ocrPage(pdf: Uint8Array, pageIndex: number): Promise<{ items: TextItem[]; confidence: number; width: number; height: number }>;
}

export const sha256 = (buf: Uint8Array) => crypto.createHash("sha256").update(buf).digest("hex");

/** Rebuild lines from positioned fragments, split into columns if the page has a gutter. */
export function layoutLines(items: TextItem[], width: number): { columns: 1 | 2; lines: Line[] } {
  const words = items.filter((i) => i.s.trim() !== "");
  if (!words.length) return { columns: 1, lines: [] };

  // Find the clearest vertical gutter in the middle of the page.
  let gutter: number | null = null;
  let best = Infinity;
  for (let x = Math.round(width * 0.38); x <= Math.round(width * 0.62); x += 2) {
    const crossing = words.filter((w) => w.x < x - 1 && w.x + w.w > x + 1).length;
    if (crossing < best) { best = crossing; gutter = x; }
  }
  const left = gutter === null ? 0 : words.filter((w) => w.x + w.w <= gutter!).length;
  const right = gutter === null ? 0 : words.filter((w) => w.x >= gutter!).length;
  // Two columns only if almost nothing crosses the gutter and both sides carry text.
  const twoCols = gutter !== null && best <= Math.max(2, words.length * 0.02) && left >= words.length * 0.2 && right >= words.length * 0.2;

  const colOf = (w: TextItem) => (!twoCols ? 0 : w.x + w.w <= gutter! + 1 ? 0 : w.x >= gutter! - 1 ? 1 : -1);

  const buckets = new Map<string, TextItem[]>();
  for (const w of words) {
    const c = colOf(w);
    const tol = Math.max(2, w.h * 0.45);
    let key: string | null = null;
    for (const k of buckets.keys()) {
      const [kc, ky] = k.split("|").map(Number);
      if (kc === c && Math.abs(ky - w.y) <= tol) { key = k; break; }
    }
    if (!key) { key = `${c}|${w.y}`; buckets.set(key, []); }
    buckets.get(key)!.push(w);
  }

  const lines: Line[] = [];
  for (const [k, its] of buckets) {
    const c = Number(k.split("|")[0]);
    its.sort((a, b) => a.x - b.x);
    let text = "";
    let prevEnd: number | null = null;
    for (const it of its) {
      if (prevEnd !== null && it.x - prevEnd > Math.max(1.5, it.h * 0.15) && !text.endsWith(" ") && !it.s.startsWith(" ")) text += " ";
      text += it.s;
      prevEnd = it.x + it.w;
    }
    const x0 = Math.min(...its.map((i) => i.x));
    const x1 = Math.max(...its.map((i) => i.x + i.w));
    const y0 = Math.min(...its.map((i) => i.y));
    const h = Math.max(...its.map((i) => i.h));
    lines.push({ text: text.replace(/\s+/g, " ").trim(), column: c, region: { x: x0, y: y0, w: x1 - x0, h } });
  }

  // Reading order: spanning lines above the columns, left column, right column,
  // spanning lines below. PDF y grows upwards, so higher y comes first.
  const colTop = Math.max(...lines.filter((l) => l.column >= 0).map((l) => l.region.y), -Infinity);
  const colBottom = Math.min(...lines.filter((l) => l.column >= 0).map((l) => l.region.y), Infinity);
  const byY = (a: Line, b: Line) => b.region.y - a.region.y || a.region.x - b.region.x;
  const above = lines.filter((l) => l.column === -1 && l.region.y > colTop).sort(byY);
  const below = lines.filter((l) => l.column === -1 && l.region.y <= colTop).sort(byY);
  const mid = [0, 1].flatMap((c) => lines.filter((l) => l.column === c).sort(byY));
  void colBottom;
  return { columns: twoCols ? 2 : 1, lines: twoCols ? [...above, ...mid, ...below] : lines.sort(byY) };
}

const PAGE_LABEL_RE = /\bPage\s+(\d{1,4})\s+of\s+(\d{1,4})\b/i;

function grade(lines: Line[]) {
  const letters = lines.reduce((n, l) => n + (l.text.match(/[A-Za-z]/g)?.length ?? 0), 0);
  return { letters, usable: letters >= LIMITS.minLettersPerPage };
}

export function looksLikePdf(buf: Uint8Array): boolean {
  const head = Buffer.from(buf.subarray(0, 1024)).toString("latin1");
  return head.includes("%PDF-");
}

/**
 * Read every page. `ocr` is used only for pages whose embedded text fails the
 * grade; without an OCR engine those pages stay unusable and say so.
 */
export async function acquireText(buf: Uint8Array, opts: { ocr?: PageOcr | null } = {}): Promise<DocumentText> {
  if (!looksLikePdf(buf)) throw new DocumentReadError("not_a_pdf");
  if (buf.byteLength > LIMITS.maxBytes) throw new DocumentReadError("too_large");
  const hash = sha256(buf);

  let pdf: any;
  try {
    // A copy: pdf.js takes ownership of the buffer it is given.
    pdf = await pdfjs.getDocument({ data: new Uint8Array(buf), disableFontFace: true, isEvalSupported: false, verbosity: 0 }).promise;
  } catch (e: any) {
    if (e?.name === "PasswordException") throw new DocumentReadError("password_protected");
    throw new DocumentReadError("corrupt");
  }
  if (pdf.numPages > LIMITS.maxPages) throw new DocumentReadError("too_many_pages");

  const pages: PageText[] = [];
  let ocrUsed = false;
  for (let i = 1; i <= pdf.numPages; i++) {
    let items: TextItem[] = [];
    let width = 595;
    try {
      const page = await pdf.getPage(i);
      width = page.getViewport({ scale: 1 }).width;
      const tc = await page.getTextContent();
      items = tc.items
        .filter((it: any) => typeof it.str === "string")
        .map((it: any) => ({ s: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: it.height || Math.abs(it.transform[3]) }));
    } catch {
      items = [];
    }
    let pageItems = items.filter((it) => it.s.trim() !== "");
    let pageWidth = width;
    let { columns, lines } = layoutLines(items, width);
    let method: ExtractionMethod = "embedded_text";
    let ocrConfidence: number | null = null;
    let quality = grade(lines);

    if (!quality.usable && opts.ocr) {
      const r = await opts.ocr.ocrPage(buf, i);
      const laid = layoutLines(r.items, r.width);
      const g = grade(laid.lines);
      if (g.letters > quality.letters) {
        ({ columns, lines } = laid);
        pageItems = r.items;
        pageWidth = r.width;
        method = "ocr";
        ocrConfidence = r.confidence;
        quality = g;
        ocrUsed = true;
      }
    }
    const text = lines.map((l) => l.text).join("\n");
    const label = PAGE_LABEL_RE.exec(text);
    pages.push({ index: i, printedLabel: label ? label[1] : null, method, ocrConfidence, columns, lines, text, quality, items: pageItems, width: pageWidth });
  }
  await pdf.destroy?.();
  if (!pages.some((p) => p.quality.usable)) throw new DocumentReadError(opts.ocr ? "empty" : "ocr_unavailable");
  return { sha256: hash, pageCount: pages.length, pages, extractor: { id: EXTRACTOR_ID, version: EXTRACTOR_VERSION }, ocrUsed };
}
