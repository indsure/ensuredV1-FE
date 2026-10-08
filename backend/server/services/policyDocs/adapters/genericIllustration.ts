/**
 * General reader: the insurer's benefit illustration, for any non-linked plan that
 * has no product-specific reader yet.
 *
 * IRDAI requires a benefit illustration with a year-by-year table: premium, survival
 * benefit, maturity benefit, death benefit and the guaranteed surrender value. This
 * reader finds that table, works out each column from its heading (by position, since
 * headings wrap over several lines), and reads every policy year from 1 upwards.
 *
 * It is a FALLBACK (registry.ts): it runs only when no product-specific reader matched.
 * It refuses rather than guesses: no table, a gap in the years, no surrender column, or
 * two candidate surrender columns all mean "not supported". Non-guaranteed columns
 * (special surrender value, bonuses, projections at 4% / 8%) are never used.
 *
 * Customer identity rows are never read. No model calls, no eval.
 */

import { parseIsoDate } from "../../../../../shared/policyNumbers";
import { paiseFromRupeeText, type Paise } from "../../../../../shared/exactMath";
import type { IllustrationRow, ParsedFields, ReviewFlag } from "../../../../../shared/policyDocTypes";
import { findLines, norm, sourceOf } from "../docQuery";
import type { Identification, PolicyAdapter } from "../registry";
import type { DocumentText, PageText, TextItem } from "../textLayer";

const ID = "general-benefit-illustration";
const VERSION = "1.0.0";
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

type Col = "year" | "premium" | "cumulative" | "survival" | "maturity" | "death" | "gsv" | "ssv" | "total" | "other";

const NUM = /^(?:\d{1,3}(?:,\d{2,3})+|\d+)(?:\.\d{1,2})?$/;
const isNumCell = (s: string) => NUM.test(s) || s === "-" || s === "–" || /^nil$/i.test(s);
const cellPaise = (s: string): Paise | null => (s === "-" || s === "–" || /^nil$/i.test(s) ? { paise: 0 } : paiseFromRupeeText(s));

function classify(h: string): Col {
  const t = h.toLowerCase();
  if (/special|\bssv\b|non[- ]?guaranteed|bonus|@ ?\d|projected|fund/.test(t)) return t.includes("surrender") || t.includes("ssv") ? "ssv" : "other";
  if (/guaranteed\s+surrender|\bgsv\b|minimum\s+guaranteed/.test(t)) return "gsv";
  if (/surrender/.test(t)) return "gsv";
  if (/policy\s*year|^year\b|\byear\s*$|^\s*year/.test(t) && !/premium|benefit/.test(t)) return "year";
  if (/total\s+benefit|\(a\)\s*\+\s*\(b\)|total\s+(?:maturity|survival)/.test(t)) return "total";
  if (/cumulative|total\s+premiums?\s+paid/.test(t)) return "cumulative";
  if (/death/.test(t)) return "death";
  if (/maturity/.test(t)) return "maturity";
  if (/survival|income|money\s*back|payout|guaranteed\s+(?:additions?\s+)?benefit/.test(t)) return "survival";
  if (/premium/.test(t)) return "premium";
  return "other";
}

interface Table { page: PageText; rows: TextItem[][]; colX: number[]; spans: [number, number][]; headers: string[]; classes: Col[]; top: number; bottom: number }

/** Rows that start with a policy year and hold only numbers, grouped by baseline. */
function numericRows(page: PageText): TextItem[][] {
  const rows: { y: number; its: TextItem[] }[] = [];
  for (const it of [...page.items].filter((i) => i.s.trim()).sort((a, b) => b.y - a.y)) {
    const r = rows.find((x) => Math.abs(x.y - it.y) <= Math.max(2, it.h * 0.45));
    if (r) r.its.push(it); else rows.push({ y: it.y, its: [it] });
  }
  const out: TextItem[][] = [];
  for (const r of rows) {
    const its = r.its.sort((a, b) => a.x - b.x);
    // Start at the first integer cell that is followed only by numeric cells.
    for (let k = 0; k < its.length; k++) {
      const first = its[k].s.trim();
      if (!/^\d{1,3}$/.test(first)) continue;
      const rest = its.slice(k + 1).map((i) => i.s.trim());
      if (rest.length >= 3 && rest.every(isNumCell)) { out.push(its.slice(k)); break; }
    }
  }
  return out;
}

function findTable(doc: DocumentText): Table | null {
  for (const page of doc.pages) {
    const rows = numericRows(page);
    // The longest run of consecutive years starting at 1.
    const byYear = new Map<number, TextItem[]>();
    for (const r of rows) { const y = Number(r[0].s.trim()); if (!byYear.has(y)) byYear.set(y, r); }
    if (!byYear.has(1) || !byYear.has(2) || !byYear.has(3)) continue;
    const run: TextItem[][] = [];
    for (let y = 1; byYear.has(y); y++) run.push(byYear.get(y)!);
    if (run.length < 5) continue;
    // A later year after a missing one means a gap in the table: refuse rather than shorten the term.
    if (Array.from(byYear.keys()).some((y) => y > run.length + 1)) continue;
    // Columns: cells that overlap horizontally belong together (works for left, right or
    // centre aligned figures). Spans are merged across all rows.
    let spans: [number, number][] = [];
    for (const r of run) for (const c of r) spans.push([c.x, c.x + c.w]);
    spans.sort((p, q) => p[0] - q[0]);
    const merged: [number, number][] = [];
    for (const sp of spans) {
      const last = merged[merged.length - 1];
      if (last && sp[0] <= last[1] + 1) last[1] = Math.max(last[1], sp[1]);
      else merged.push([sp[0], sp[1]]);
    }
    spans = merged;
    const colOfX = (c: TextItem) => spans.findIndex(([a, b]) => c.x + c.w / 2 >= a - 1 && c.x + c.w / 2 <= b + 1);
    if (run.some((r) => new Set(r.map(colOfX)).size !== r.length)) continue;   // two cells of one row in one column
    // Headings: words above the first row (within 90pt), each given to the column under its centre,
    // or the nearest one. Page-wide lines (company names) are skipped.
    const top = run[0][0].y;
    const left = spans[0][0] - 70;
    const right = spans[spans.length - 1][1] + 30;
    const heads = page.items.filter((i) => i.s.trim() && i.y > top + 2 && i.y < top + 90 && i.x + i.w / 2 >= left && i.x + i.w / 2 <= right);
    // Each column owns the strip of page up to halfway to its neighbours, so a heading
    // belongs to the column whose strip its centre is in (left, centre or right aligned).
    const bounds = spans.slice(0, -1).map(([, e], i) => (e + spans[i + 1][0]) / 2);
    const words: string[][] = spans.map(() => []);
    for (const h of [...heads].sort((a, b) => b.y - a.y || a.x - b.x)) {
      const cx = h.x + h.w / 2;
      if (cx < spans[0][0] - 70 || cx > spans[spans.length - 1][1] + 40) continue;
      let col = bounds.findIndex((b) => cx < b);
      if (col < 0) col = spans.length - 1;
      // Text much wider than the column's strip is a sentence or a page heading, not a column title.
      const lo = col === 0 ? spans[0][0] - 70 : bounds[col - 1];
      const hi = col === spans.length - 1 ? spans[col][1] + 40 : bounds[col];
      if (h.w > 1.6 * (hi - lo)) continue;
      words[col].push(h.s.trim());
    }
    const headers = words.map((w) => norm(w.join(" ")));
    const classes = headers.map(classify);
    if (classes[0] !== "year") classes[0] = "year";
    return { page, rows: run, colX: spans.map(([, b]) => b), spans, headers, classes, top, bottom: run[run.length - 1][0].y };
  }
  return null;
}

function readDate(s: string): string | null {
  let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m) { const p = parseIsoDate(`${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`); return p.ok ? p.value : null; }
  m = /^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([A-Za-z]{3,9})[,\s-]+(\d{4})$/.exec(s);
  if (m) {
    const mo = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
    if (mo < 0) return null;
    const p = parseIsoDate(`${m[3]}-${String(mo + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`);
    return p.ok ? p.value : null;
  }
  return null;
}
const DATE = String.raw`(\d{1,2}[/.-]\d{1,2}[/.-]\d{4}|\d{1,2}(?:st|nd|rd|th)?[\s-]+[A-Za-z]{3,9}[,\s-]+\d{4})`;
// Policy years run from the risk commencement date where the schedule prints one, else from the policy start.
const DATE_LABELS: RegExp[] = [
  new RegExp(String.raw`(?:Risk Commencement Date|Date of (?:Risk Commencement|Commencement of Risk))\s*[:\-]?\s*${DATE}`, "i"),
  new RegExp(String.raw`(?:Date of Commencement(?: of (?:the )?Policy)?|Policy Commencement Date|Commencement Date)\s*[:\-]?\s*${DATE}`, "i"),
  new RegExp(String.raw`(?:Policy Issue Date|Date of Issue|Issue Date)\s*[:\-]?\s*${DATE}`, "i"),
];

function identify(doc: DocumentText): Identification {
  const t = findTable(doc);
  if (!t) return { result: "no_match", reason: "No year-by-year benefit illustration table was found." };
  const gsv = t.classes.filter((c) => c === "gsv").length;
  if (gsv === 0) return { result: "no_match", reason: "The benefit illustration has no guaranteed surrender value column." };
  if (gsv > 1) return { result: "no_match", reason: "The benefit illustration has more than one surrender value column, so it is not read." };
  return { result: "match" };
}

function parse(doc: DocumentText): { fields: ParsedFields; flags: ReviewFlag[] } {
  const ctx = { sha256: doc.sha256, parser: ID, parserVersion: VERSION };
  const t = findTable(doc)!;
  const fields: ParsedFields = {};
  const region = { x: Math.min(...t.rows.map((r) => r[0].x)), y: t.bottom, w: Math.max(...t.colX) - Math.min(...t.rows.map((r) => r[0].x)), h: t.top - t.bottom };
  const src = sourceOf({ page: t.page, region }, `Benefit illustration: ${t.headers.filter(Boolean).join(" | ")}`.slice(0, 200), "Benefit illustration", ctx);
  const idx = (c: Col) => { const i = t.classes.indexOf(c); return i >= 0 && t.classes.lastIndexOf(c) === i ? i : -1; };
  const colOf = (c: TextItem) => t.spans.findIndex(([a, b]) => c.x + c.w / 2 >= a - 1 && c.x + c.w / 2 <= b + 1);
  const cell = (r: TextItem[], col: number): Paise | null => {
    if (col < 0) return null;
    const c = r.find((x) => colOf(x) === col);
    return c ? cellPaise(c.s.trim()) : { paise: 0 };   // an empty cell in a printed table is a nil amount
  };
  const rows: IllustrationRow[] = t.rows.map((r) => ({
    year: Number(r[0].s.trim()),
    premium: cell(r, idx("premium")), survival: cell(r, idx("survival")), maturity: cell(r, idx("maturity")),
    death: cell(r, idx("death")), gsv: cell(r, idx("gsv")),
  }));
  fields["illustration.rows"] = { state: "found", value: rows, raw: t.headers.join(" | "), source: src };
  fields["schedule.policy_term_years"] = { state: "found", value: rows.length, raw: `Illustration years 1 to ${rows.length}`, source: src };
  const paying = rows.filter((r) => (r.premium?.paise ?? 0) > 0);
  if (idx("premium") >= 0 && paying.length && paying.every((r, i) => r.year === i + 1)) {
    fields["schedule.premium_paying_term_years"] = { state: "found", value: paying.length, raw: `Premium in illustration years 1 to ${paying.length}`, source: src };
    fields["schedule.annualized_premium"] = { state: "found", value: paying[0].premium!, raw: "Illustration, year 1 premium", source: src };
  }

  // Policy start, for placing today in the right policy year.
  for (const re of DATE_LABELS) {
    const hits = findLines(doc, re);
    const dates = Array.from(new Set(hits.map((h) => readDate(h.match[1])).filter((d): d is string => !!d)));
    if (dates.length === 1) {
      const h = hits.find((x) => readDate(x.match[1]) === dates[0])!;
      fields["schedule.commencement_date"] = { state: "found", value: dates[0], raw: h.match[0], source: sourceOf({ page: h.page, region: h.line.region }, norm(h.line.text).slice(0, 120), "Policy schedule", ctx) };
      break;
    }
    if (dates.length > 1) {
      fields["schedule.commencement_date"] = { state: "conflicting", reason: "The document gives different start dates.", candidates: hits.map((h) => ({ raw: h.match[0], source: sourceOf({ page: h.page, region: h.line.region }, null, "Policy schedule", ctx) })) };
      break;
    }
  }
  if (!fields["schedule.commencement_date"]) fields["schedule.commencement_date"] = { state: "missing", reason: "No policy start date was found." };

  // Product UIN printed with the illustration, when there is exactly one there.
  const uins = Array.from(new Set(findLines(doc, /\bUIN\b\s*[:\-]?\s*([0-9]{3}[A-Z][0-9]{3}V[0-9]{2})\b/, [t.page.index - 1, t.page.index]).map((h) => h.match[1])));
  if (uins.length === 1) fields["identity.uin"] = { state: "found", value: uins[0], raw: uins[0], source: src };

  const flags: ReviewFlag[] = [{
    id: "read_from_illustration", fieldKeys: ["illustration.rows"], choices: [], blocksCalculation: false,
    note: "Read by the general reader from the insurer's benefit illustration. Surrender values are the insurer's year-end figures; check them against the illustration.",
  }];
  return { fields, flags };
}

/** For tests and private checks: the table the reader found. */
export const __internals = { findTable, classify };

export const genericIllustration: PolicyAdapter = {
  id: ID, version: VERSION, insurer: "Any", product: "Any plan with a benefit illustration", uin: "any",
  supports: "Any non-linked plan whose PDF includes the insurer's year-by-year benefit illustration with a guaranteed surrender value column.",
  identify, parse, fallback: true,
};
