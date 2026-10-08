/**
 * Small, deterministic ways of finding things in a laid-out document, used by
 * product adapters. No model, no fuzzy matching, no guessing: a pattern either
 * matches the text as printed (after fixed, listed normalisations) or it does
 * not, and the caller decides what "not found" means for its field.
 *
 * Normalisations (applied the same way everywhere, and nothing else):
 *   - the rupee glyph some PDFs encode as a backtick -> ₹
 *   - en/em dashes and minus -> "-"; curly quotes -> straight
 *   - runs of spaces -> one space
 */

import type { ExtractionMethod, Region, SourceRef } from "../../../../shared/policyDocTypes";
import type { DocumentText, Line, PageText, TextItem } from "./textLayer";

export function norm(s: string): string {
  return s
    .replace(/`/g, "₹")
    .replace(/[\u2012\u2013\u2014\u2212]/g, "-")
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export interface Hit {
  page: PageText;
  line: Line;
  lineIndex: number;
  match: RegExpExecArray;
}

export function findLines(doc: DocumentText, re: RegExp, pages?: number[]): Hit[] {
  const out: Hit[] = [];
  for (const page of doc.pages) {
    if (pages && !pages.includes(page.index)) continue;
    page.lines.forEach((line, lineIndex) => {
      const m = new RegExp(re.source, re.flags.replace("g", "")).exec(norm(line.text));
      if (m) out.push({ page, line, lineIndex, match: m });
    });
  }
  return out;
}

export interface Located {
  text: string;
  page: PageText;
  region: Region;
}

/**
 * The value printed to the right of a label in a two-cell table row. The
 * label's first line is the anchor; the value is the row of fragments to the
 * right of the label cell nearest that line (labels often wrap below their
 * value). `maxX` keeps a third table column out.
 */
export function valuesRightOf(doc: DocumentText, labelRe: RegExp, pages: number[], opts: { maxXFrac?: number; variantRe?: RegExp } = {}): Located[] {
  const hits = findLines(doc, labelRe, pages);
  const out: Located[] = [];
  for (const h of hits) {
    if (opts.variantRe) {
      // A label whose distinguishing words wrap onto the next line(s) of the same cell.
      const next = h.page.lines.slice(h.lineIndex, h.lineIndex + 3).filter((l) => l.column === h.line.column).map((l) => norm(l.text)).join(" ");
      if (!opts.variantRe.test(next)) continue;
    }
    const a = h.line.region;
    const labelRight = labelCellRight(h.page, h);
    const maxX = h.page.width * (opts.maxXFrac ?? 0.72);
    const cands = h.page.items.filter(
      (it) => it.x >= labelRight + 3 && it.x < maxX && it.y <= a.y + a.h * 0.9 && it.y >= a.y - a.h * 2.6
    );
    if (!cands.length) continue;
    cands.sort((p, q) => Math.abs(p.y - a.y) - Math.abs(q.y - a.y));
    const y0 = cands[0].y;
    const row = cands.filter((c) => Math.abs(c.y - y0) <= Math.max(2, c.h * 0.5)).sort((p, q) => p.x - q.x);
    const text = norm(row.map((r) => r.s).join(" "));
    const x0 = Math.min(...row.map((r) => r.x));
    const x1 = Math.max(...row.map((r) => r.x + r.w));
    out.push({ text, page: h.page, region: { x: Math.min(a.x, x0), y: Math.min(a.y, y0), w: x1 - Math.min(a.x, x0), h: a.h } });
  }
  return out;
}

/** Right edge of the label's own words: the label text items on the anchor row, left of any value. */
function labelCellRight(page: PageText, h: Hit): number {
  const a = h.line.region;
  const rowItems = page.items.filter((it) => Math.abs(it.y - a.y) <= Math.max(2, it.h * 0.5) && it.x >= a.x - 1).sort((p, q) => p.x - q.x);
  // Walk the row while the words still belong to the label the pattern matched.
  const target = norm(h.match[0]);
  let acc = "";
  let right = a.x;
  for (const it of rowItems) {
    if (acc.length >= target.length) break;
    acc = norm(acc + " " + it.s);
    right = it.x + it.w;
  }
  return right;
}

/**
 * The words of a clause in reading order: from the line matching `startRe`
 * up to (not including) the first later line matching `endRe`, across
 * columns and onto following pages. Hyphenated line ends are rejoined.
 */
export function clauseText(doc: DocumentText, startRe: RegExp, endRe: RegExp, opts: { afterRe?: RegExp; maxPages?: number } = {}): (Located & { pages: number[] }) | null {
  let started = false;
  let armed = !opts.afterRe;
  let first: { page: PageText; region: Region } | null = null;
  const parts: string[] = [];
  const pages: number[] = [];
  for (const page of doc.pages) {
    for (const line of page.lines) {
      const t = norm(line.text);
      if (/^Page \d+ of \d+$/i.test(t)) continue;
      if (!armed) { if (opts.afterRe!.test(t)) armed = true; continue; }
      if (!started) {
        if (startRe.test(t)) {
          started = true;
          first = { page, region: line.region };
          pages.push(page.index);
          parts.push(t);
        }
        continue;
      }
      if (endRe.test(t)) return finish();
      if (!pages.includes(page.index)) {
        pages.push(page.index);
        if (opts.maxPages && pages.length > opts.maxPages) return finish();
      }
      parts.push(t);
    }
  }
  return started ? finish() : null;

  function finish() {
    let text = "";
    for (const p of parts) {
      // A word broken at a hyphen across lines ("G-" / "Sec", "paid-" / "up") is
      // rejoined keeping the hyphen; contract wording does not use soft hyphens.
      text = /[A-Za-z0-9]-$/.test(text) && /^[A-Za-z]/.test(p) ? text + p : text ? text + " " + p : p;
    }
    return { text: norm(text), page: first!.page, region: first!.region, pages };
  }
}

/**
 * Rows of a two-cell table between a header line and an end line, in one
 * page column. Each visual line is split where its right-hand cell begins
 * (the first fragment matching `rightCellRe`); lines without such a fragment
 * are wrapped continuations and go to the cell they sit under. A row starts
 * at a left cell matching `rowStartRe`.
 */
export function tableRows(
  page: PageText, headerRe: RegExp, endRe: RegExp, rightCellRe: RegExp, rowStartRe: RegExp
): { left: string; right: string; region: Region }[] | null {
  const header = page.lines.find((l) => headerRe.test(norm(l.text)));
  if (!header) return null;
  const end = page.lines.find((l) => l.region.y < header.region.y && l.column === header.column && endRe.test(norm(l.text)));
  const yBottom = end ? end.region.y + end.region.h * 0.5 : -Infinity;
  const rightColLines = page.lines.filter((l) => l.column === 1);
  const gutter = rightColLines.length ? Math.min(...rightColLines.map((l) => l.region.x)) - 3 : page.width / 2;
  const [colLeft, colRight] = page.columns === 2 ? (header.column === 1 ? [gutter, page.width] : [0, gutter]) : [0, page.width];
  const items = page.items.filter((i) => i.y < header.region.y - 1 && i.y > yBottom && i.x >= colLeft && i.x < colRight);

  const vis = groupItems(items);
  type Row = { left: string[]; right: string[]; top: number; bottom: number };
  const rows: Row[] = [];
  let splitX: number | null = null;
  for (const line of vis) {
    const k = line.its.findIndex((i) => rightCellRe.test(norm(i.s)));
    let left: TextItem[], right: TextItem[];
    if (k >= 0) {
      splitX = line.its[k].x;
      left = line.its.slice(0, k);
      right = line.its.slice(k);
    } else if (splitX !== null) {
      left = line.its.filter((i) => i.x < splitX! - 2);
      right = line.its.filter((i) => i.x >= splitX! - 2);
    } else {
      left = line.its;
      right = [];
    }
    const lt = norm(left.map((i) => i.s).join(" "));
    if (lt && rowStartRe.test(lt)) {
      rows.push({ left: [lt], right: right.length ? [norm(right.map((i) => i.s).join(" "))] : [], top: line.y + line.h, bottom: line.y });
    } else if (rows.length) {
      const r = rows[rows.length - 1];
      if (lt) r.left.push(lt);
      if (right.length) r.right.push(norm(right.map((i) => i.s).join(" ")));
      r.bottom = line.y;
    }
  }
  return rows.map((r) => ({
    left: norm(r.left.join(" ")), right: norm(r.right.join(" ")),
    region: { x: colLeft, y: r.bottom, w: colRight - colLeft, h: r.top - r.bottom },
  }));
}

function groupItems(items: TextItem[]): { y: number; h: number; its: TextItem[] }[] {
  const rows: { y: number; h: number; its: TextItem[] }[] = [];
  for (const it of [...items].sort((a, b) => b.y - a.y)) {
    const r = rows.find((x) => Math.abs(x.y - it.y) <= Math.max(2, it.h * 0.45));
    if (r) r.its.push(it);
    else rows.push({ y: it.y, h: it.h, its: [it] });
  }
  for (const r of rows) r.its.sort((a, b) => a.x - b.x);
  return rows;
}

function groupRows(items: TextItem[]): { text: string; y: number; h: number }[] {
  const rows: { y: number; h: number; its: TextItem[] }[] = [];
  for (const it of [...items].sort((a, b) => b.y - a.y)) {
    const r = rows.find((x) => Math.abs(x.y - it.y) <= Math.max(2, it.h * 0.45));
    if (r) r.its.push(it);
    else rows.push({ y: it.y, h: it.h, its: [it] });
  }
  return rows.map((r) => ({ y: r.y, h: r.h, text: r.its.sort((a, b) => a.x - b.x).map((i) => i.s).join(" ") }));
}

export function sourceOf(
  loc: { page: PageText; region: Region }, excerpt: string | null, clause: string | null,
  ctx: { sha256: string; parser: string; parserVersion: string }
): SourceRef {
  return {
    documentSha256: ctx.sha256,
    pdfPage: loc.page.index,
    printedPage: loc.page.printedLabel,
    clause,
    excerpt: excerpt ? (excerpt.length > 200 ? excerpt.slice(0, 199).replace(/\s+\S*$/, "") + "…" : excerpt) : null,
    region: { x: round(loc.region.x), y: round(loc.region.y), w: round(loc.region.w), h: round(loc.region.h) },
    method: loc.page.method as ExtractionMethod,
    parser: ctx.parser,
    parserVersion: ctx.parserVersion,
  };
}
const round = (n: number) => Math.round(n * 10) / 10;
