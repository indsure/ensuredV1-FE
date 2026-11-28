// Reads the two PDFs LIC gives an agent: the monthly Premium Due list and the Commission sheet.
//
// No AI and no OCR: both are digital PDFs with real text, so pdf.js text items are grouped into
// lines by their y position and each line is matched against one strict pattern. A read is only
// accepted when its rows add up to the sheet's own Grand Total; that check is what stops a quietly
// wrong read (a row the pattern missed) from reaching the agent as "not paid".

import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

export type LicMode = "Y" | "H" | "Q" | "M" | "S";

export interface DueRow {
  sno: number;
  policyNo: string;
  holderName: string;
  doc: string; // YYYY-MM-DD
  planNo: number;
  licTerm: number;
  mode: LicMode;
  fup: string; // YYYY-MM
  flag: string | null; // FY | ST | LP | MT
  instPrem: number;
  dueCount: number;
  gst: number;
  totalPrem: number;
  estComm: number;
}

export interface DueSheet {
  kind: "due";
  period: string; // YYYY-MM
  agentCode: string;
  branchCode: string | null;
  rows: DueRow[];
  grandTotalPremium: number;
  grandTotalCommission: number;
}

export interface PaidRow {
  sno: number;
  holderName: string;
  policyNo: string;
  planNo: number;
  term: number;
  dueDate: string; // YYYY-MM-DD
  riskDate: string; // YYYY-MM-DD
  cbo: string;
  adjDate: string; // YYYY-MM-DD
  premium: number;
  commission: number;
}

export interface CommissionSheet {
  kind: "commission";
  period: string; // YYYY-MM
  batch: number | null;
  agentCode: string;
  branchCode: string | null;
  rows: PaidRow[];
  grandTotalPremium: number;
  grandTotalCommission: number;
  summary: {
    firstYearPremium: number | null;
    firstYearCommission: number | null;
    renewalPremium: number | null;
    renewalCommission: number | null;
    bonusCommission: number | null;
    totalCommission: number | null;
    incomeTax: number | null;
    netPayable: number | null;
    processedOn: string | null; // YYYY-MM-DD
  };
}

export type LicSheet = DueSheet | CommissionSheet;

export type LicParseErrorCode =
  | "no_text"
  | "not_lic_sheet"
  | "wrong_kind"
  | "totals_mismatch"
  | "no_rows"
  | "unreadable";

export class LicParseError extends Error {
  constructor(public code: LicParseErrorCode, message: string, public detail?: Record<string, unknown>) {
    super(message);
  }
}

/* ---------------------------------------------------------------- text */

/** Text of each page as lines, left to right, top to bottom. */
export async function pdfLines(data: Uint8Array): Promise<string[]> {
  let pdf: any;
  try {
    pdf = await pdfjs.getDocument({ data, disableFontFace: true, verbosity: 0 }).promise;
  } catch {
    throw new LicParseError("unreadable", "This file could not be opened as a PDF.");
  }
  const out: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    // Items on one printed line share a baseline; allow a little jitter.
    const lines: { y: number; items: { x: number; s: string }[] }[] = [];
    for (const it of content.items as any[]) {
      const s = String(it.str ?? "").replace(/\u0000/g, "");
      if (!s.trim()) continue;
      const x = it.transform[4];
      const y = it.transform[5];
      let line = lines.find((l) => Math.abs(l.y - y) < 2.5);
      if (!line) {
        line = { y, items: [] };
        lines.push(line);
      }
      line.items.push({ x, s });
    }
    lines.sort((a, b) => b.y - a.y);
    for (const l of lines) {
      l.items.sort((a, b) => a.x - b.x);
      out.push(l.items.map((i) => i.s.trim()).join(" ").replace(/\s+/g, " ").trim());
    }
  }
  return out;
}

/* ---------------------------------------------------------------- helpers */

const num = (s: string) => Number(s.replace(/,/g, ""));
const dmy = (s: string) => {
  const [d, m, y] = s.split("/");
  return `${y}-${m}-${d}`;
};
const my = (s: string) => {
  const [m, y] = s.split(/[/-]/);
  return `${y}-${m.padStart(2, "0")}`;
};
const MODE: Record<string, LicMode> = { Yly: "Y", Hly: "H", Qly: "Q", Mly: "M", SSP: "S", Sgl: "S" };
const close = (a: number, b: number) => Math.abs(a - b) < 0.6;

function agentCode(lines: string[]): string {
  for (const l of lines) {
    const m = l.match(/Agent Code\s*:\s*([A-Z]{0,4}\d{5,})/i);
    if (m) return m[1].toUpperCase();
  }
  return "";
}

function branchCode(lines: string[]): string | null {
  for (const l of lines) {
    const m = l.match(/Branch Code\s*:\s*(\w+)/i);
    if (m) return m[1];
  }
  return null;
}

/* ---------------------------------------------------------------- premium due */

// 12 892956141 LAXMAN ... 01/06/2005 90/22 Yly 06/2026 MT 4443.00 1 0.00 4443 222.15
const DUE_ROW =
  /^(\d{1,4}) (\d{8,10}) (.+?) (\d{2}\/\d{2}\/\d{4}) (\d{1,3})\/(\d{1,3}) (Yly|Hly|Qly|Mly|SSP|Sgl) (\d{2}\/\d{4})(?: (FY|ST|LP|MT))? ([\d,]+\.\d{2}) (\d{1,3}) ([\d,]+\.\d{2}) ([\d,]+(?:\.\d{1,2})?) ([\d,]+(?:\.\d{1,2})?)$/;

export function parseDueLines(lines: string[]): DueSheet {
  const head = lines.find((l) => /Premium Due List For The Agent/i.test(l));
  if (!head) throw new LicParseError("not_lic_sheet", "This is not an LIC Premium Due list.");
  const pm = head.match(/For\s+(\d{1,2}\/\d{4})\s*$/i) ?? lines.join(" ").match(/Due Month\s+(\d{1,2}\/\d{4})/i);
  if (!pm) throw new LicParseError("not_lic_sheet", "The month of this Premium Due list could not be found.");

  const rows: DueRow[] = [];
  const seen = new Set<number>();
  for (const l of lines) {
    const m = l.match(DUE_ROW);
    if (!m) continue;
    const sno = Number(m[1]);
    if (seen.has(sno)) continue; // a repeated header page must not double a row
    seen.add(sno);
    rows.push({
      sno,
      policyNo: m[2],
      holderName: m[3].trim(),
      doc: dmy(m[4]),
      planNo: Number(m[5]),
      licTerm: Number(m[6]),
      mode: MODE[m[7]],
      fup: my(m[8]),
      flag: m[9] ?? null,
      instPrem: num(m[10]),
      dueCount: Number(m[11]),
      gst: num(m[12]),
      totalPrem: num(m[13]),
      estComm: num(m[14]),
    });
  }

  const gt = lines.join(" ").match(/Grand Total\s+Premium\s*:\s*([\d,]+(?:\.\d+)?)\s*G\s*S\s*T\s*:\s*([\d,.]+)\s*Estimated Comn\s*:\s*([\d,]+(?:\.\d+)?)/i);
  if (!gt) throw new LicParseError("not_lic_sheet", "The Grand Total line of this Premium Due list is missing.");
  const grandTotalPremium = num(gt[1]);
  const grandTotalCommission = num(gt[3]);

  if (rows.length === 0) throw new LicParseError("no_rows", "No policies could be read from this Premium Due list.");
  const sumPrem = rows.reduce((s, r) => s + r.totalPrem, 0);
  const sumComm = rows.reduce((s, r) => s + r.estComm, 0);
  const maxSno = Math.max(...rows.map((r) => r.sno));
  if (!close(sumPrem, grandTotalPremium) || maxSno !== rows.length || !close(sumComm, grandTotalCommission)) {
    throw new LicParseError("totals_mismatch", "Some rows of this sheet could not be read, so it was not saved.", {
      rowsRead: rows.length, lastSerial: maxSno, sumPrem, grandTotalPremium,
    });
  }

  return {
    kind: "due",
    period: my(pm[1]),
    agentCode: agentCode(lines),
    branchCode: branchCode(lines),
    rows,
    grandTotalPremium,
    grandTotalCommission,
  };
}

/* ---------------------------------------------------------------- commission */

// 3 LAXMAN RAMCHAND MOORJANI 893095342 149-22 01/10/2026 01/10/2005 EPS1 04/11/2026 20771.00 1038.55
const PAID_ROW =
  /^(\d{1,4}) (.+?) (\d{8,10}) (\d{1,3})-(\d{1,3}) (\d{2}\/\d{2}\/\d{4}) (\d{2}\/\d{2}\/\d{4}) (\S+) (\d{2}\/\d{2}\/\d{4}) ([\d,]+\.\d{2}) (-?[\d,]+\.\d{2})$/;

function summaryAmount(lines: string[], label: RegExp, col: 0 | 1): number | null {
  for (const l of lines) {
    if (!label.test(l)) continue;
    const amts = l.match(/-?[\d,]+(?:\.\d{1,2})?(?=\s|$)/g);
    if (!amts || amts.length < 2) continue;
    // The row starts with its serial number; the last two figures are the two columns.
    const two = amts.slice(-2);
    return num(two[col]);
  }
  return null;
}

export function parseCommissionLines(lines: string[]): CommissionSheet {
  const joined = lines.join(" ");
  if (!/Agency Commission/i.test(joined)) {
    throw new LicParseError("not_lic_sheet", "This is not an LIC Commission sheet.");
  }
  const pm = joined.match(/Summary of Premium and Commission of\s+(\d{1,2}\/\d{4})\s*\(\s*(\d+)(?:st|nd|rd|th)\s*batch\s*\)/i)
    ?? joined.match(/Batch\s*:\s*(\d+)(?:st|nd|rd|th)\s+of\s+(\d{1,2}\/\d{4})/i);
  if (!pm) throw new LicParseError("not_lic_sheet", "The month of this Commission sheet could not be found.");
  const period = /batch/i.test(pm[0]) && /^Batch/i.test(pm[0]) ? my(pm[2]) : my(pm[1]);
  const batch = /^Batch/i.test(pm[0]) ? Number(pm[1]) : Number(pm[2]);

  const rows: PaidRow[] = [];
  const seen = new Set<number>();
  for (const l of lines) {
    const m = l.match(PAID_ROW);
    if (!m) continue;
    const sno = Number(m[1]);
    if (seen.has(sno)) continue;
    seen.add(sno);
    rows.push({
      sno,
      holderName: m[2].trim(),
      policyNo: m[3],
      planNo: Number(m[4]),
      term: Number(m[5]),
      dueDate: dmy(m[6]),
      riskDate: dmy(m[7]),
      cbo: m[8],
      adjDate: dmy(m[9]),
      premium: num(m[10]),
      commission: num(m[11]),
    });
  }

  const gt = joined.match(/Grand Total\s+Premium\s*:\s*([\d,]+(?:\.\d+)?)\s*Commission\s*:\s*(-?[\d,]+(?:\.\d+)?)/i);
  if (!gt) throw new LicParseError("not_lic_sheet", "The Grand Total line of this Commission sheet is missing.");
  const grandTotalPremium = num(gt[1]);
  const grandTotalCommission = num(gt[2]);

  if (rows.length === 0) throw new LicParseError("no_rows", "No policies could be read from this Commission sheet.");
  const sumPrem = rows.reduce((s, r) => s + r.premium, 0);
  const sumComm = rows.reduce((s, r) => s + r.commission, 0);
  const maxSno = Math.max(...rows.map((r) => r.sno));
  if (!close(sumPrem, grandTotalPremium) || !close(sumComm, grandTotalCommission) || maxSno !== rows.length) {
    throw new LicParseError("totals_mismatch", "Some rows of this sheet could not be read, so it was not saved.", {
      rowsRead: rows.length, lastSerial: maxSno, sumPrem, grandTotalPremium,
    });
  }

  const processed = joined.match(/Processed on\s+(\d{2}\/\d{2}\/\d{4})/i);
  return {
    kind: "commission",
    period,
    batch: Number.isFinite(batch) ? batch : null,
    agentCode: agentCode(lines),
    branchCode: branchCode(lines),
    rows,
    grandTotalPremium,
    grandTotalCommission,
    summary: {
      firstYearPremium: summaryAmount(lines, /First Premium and Commission/i, 0),
      firstYearCommission: summaryAmount(lines, /First Premium and Commission/i, 1),
      renewalPremium: summaryAmount(lines, /Subsequent Year Premium and Commission/i, 0),
      renewalCommission: summaryAmount(lines, /Subsequent Year Premium and Commission/i, 1),
      bonusCommission: summaryAmount(lines, /Bonus Commission/i, 1),
      totalCommission: summaryAmount(lines, /Total Premium and Commission/i, 1),
      incomeTax: summaryAmount(lines, /Income Tax/i, 1),
      netPayable: summaryAmount(lines, /Net Payable/i, 1),
      processedOn: processed ? dmy(processed[1]) : null,
    },
  };
}

/* ---------------------------------------------------------------- entry */

/** Read a sheet the agent says is `expected`. Throws LicParseError with a message fit to show. */
export async function parseLicSheet(data: Uint8Array, expected: "due" | "commission"): Promise<LicSheet> {
  const lines = await pdfLines(data);
  if (lines.join("").replace(/\s/g, "").length < 40) {
    throw new LicParseError("no_text", "This PDF has no readable text. Please upload the PDF from the LIC agent portal, not a photo or scan.");
  }
  const joined = lines.join(" ");
  const isDue = /Premium Due List For The Agent/i.test(joined);
  const isComm = /Agency Commission/i.test(joined);
  if (expected === "due" && !isDue && isComm) {
    throw new LicParseError("wrong_kind", "This is a Commission sheet. Choose \"Commission sheet\" and upload it again.");
  }
  if (expected === "commission" && !isComm && isDue) {
    throw new LicParseError("wrong_kind", "This is a Premium Due list. Choose \"Premium due list\" and upload it again.");
  }
  return expected === "due" ? parseDueLines(lines) : parseCommissionLines(lines);
}
