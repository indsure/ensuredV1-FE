import { SELFTEST_PDF } from "./selftest.js";
// Reads the text layer of a PDF in the browser (pdf.js) and finds register fields with fixed label rules.
// Nothing is uploaded. Scanned PDFs have no text layer and are reported as such; nothing is guessed.
const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
const MAX_PAGES = 20;
const MAX_LINES = 600;

export class ReadError extends Error { constructor(code, message, detail = "") { super(message); this.code = code; this.detail = detail; } }

let loading = null;
function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("could not load " + src)); document.head.appendChild(s); });
}
// pdf.js and its worker are normally loaded by plain <script> tags at page start (the same way React is),
// so pdf.js runs on the page itself and needs no Worker. Loading on demand is only a fallback.
export function loadPdfJs() {
  if (!loading) loading = (async () => {
    if (!window.pdfjsLib) await loadScript(PDFJS + "pdf.min.js");
    if (!window.pdfjsWorker) await loadScript(PDFJS + "pdf.worker.min.js");
    if (!window.pdfjsLib || !window.pdfjsWorker) throw new Error("pdf.js loaded but did not start");
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js";
    return window.pdfjsLib;
  })().catch((e) => { loading = null; throw new ReadError("load", "The PDF reader could not load. Check the internet connection and try again.", e?.message || String(e)); });
  return loading;
}

// Reads a tiny built-in PDF once, so the page can say whether reading works in this view.
let selfTest = null;
export function readerSelfTest() {
  if (!selfTest) selfTest = (async () => {
    try {
      const b64 = SELFTEST_PDF;
      if (!b64) return { state: "fail", detail: "self-test file missing from the page" };
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const file = new File([bytes], "self-test.pdf", { type: "application/pdf" });
      const fx = await readPolicyPdf(file);
      return fx.fields.policyNo?.v === "SELFTEST-001" ? { state: "ok" } : { state: "fail", detail: `read the test PDF but found "${fx.fields.policyNo?.v || "no policy number"}"` };
    } catch (e) {
      return { state: "fail", detail: e?.detail ? `${e.message} (${e.detail})` : `${e?.name || "Error"}: ${e?.message || e}` };
    }
  })();
  return selfTest;
}

// ---- PDF -> lines with x positions
export async function pdfToLines(file, onProgress = () => {}) {
  const isPdf = /\.pdf$/i.test(file.name) || file.type === "application/pdf";
  if (!isPdf) throw new ReadError("type", /\.(jpe?g|png|heic|webp|tiff?)$/i.test(file.name) ? "This is a photo, not a PDF. Photos need OCR, which this demo cannot run in the browser." : "Only PDF files can be read. Choose the policy PDF.");
  const lib = await loadPdfJs();
  let pdf;
  try {
    pdf = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false, disableFontFace: true }).promise;
  } catch (e) {
    if (e && e.name === "PasswordException") throw new ReadError("password", "This PDF is password protected. Open it, save a copy without the password, and attach that.");
    throw new ReadError("broken", "This file could not be opened as a PDF. It may be damaged.", `${e?.name || "Error"}: ${e?.message || e}`);
  }
  const lines = [];
  const pages = Math.min(pdf.numPages, MAX_PAGES);
  for (let p = 1; p <= pages; p++) {
    onProgress(p, pdf.numPages);
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const items = tc.items.filter((i) => i.str && i.str.trim()).map((i) => ({ x: i.transform[4], y: i.transform[5], w: i.width, h: Math.abs(i.transform[3]) || 10, s: i.str.replace(/\u00a0/g, " ") }));
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    const rows = [];
    for (const it of items) {
      const row = rows.find((r) => Math.abs(r.y - it.y) <= Math.max(2, it.h * 0.45));
      if (row) row.items.push(it); else rows.push({ y: it.y, items: [it] });
    }
    rows.sort((a, b) => b.y - a.y);
    if (pages > 1) lines.push({ page: p, text: `[Page ${p}]`, segs: [], marker: true });
    for (const r of rows) {
      r.items.sort((a, b) => a.x - b.x);
      const segs = [];
      for (const it of r.items) {
        const last = segs[segs.length - 1];
        const gap = last ? it.x - last.x2 : Infinity;
        if (last && gap < it.h * 1.2) { last.s += (gap > it.h * 0.15 ? " " : "") + it.s; last.x2 = it.x + it.w; }
        else segs.push({ x: it.x, x2: it.x + it.w, s: it.s });
      }
      segs.forEach((s) => (s.s = s.s.replace(/\s+/g, " ").trim()));
      lines.push({ page: p, text: segs.map((s) => s.s).join("    "), segs });
    }
  }
  return { lines: lines.slice(0, MAX_LINES), pages: pdf.numPages, readPages: pages, textChars: lines.reduce((a, l) => a + (l.marker ? 0 : l.text.length), 0) };
}

// ---- value parsers
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12, january: 1, february: 2, march: 3, april: 4, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
const DATE_RE = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b|\b(\d{1,2})(?:st|nd|rd|th)?[\s\/\-.]+(\d{1,2}|[A-Za-z]{3,9})[\s\/\-.,]+(\d{4}|\d{2})\b|\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/g;
const pad = (n) => String(n).padStart(2, "0");
function mkDate(y, m, d) {
  y = +y; if (y < 100) y += 2000;
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1990 && y <= 2100)) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCDate() !== +d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}
export function findDates(s) {
  const out = [];
  const re = new RegExp(DATE_RE.source, "g");
  for (let m = re.exec(s); m; m = re.exec(s)) {
    let iso = null, ambiguous = false;
    if (m[1]) iso = mkDate(m[1], +m[2], +m[3]);
    else if (m[4]) {
      const mm = /^\d+$/.test(m[5]) ? +m[5] : MON[m[5].toLowerCase()];
      if (mm) { iso = mkDate(m[6], mm, +m[4]); ambiguous = /^\d+$/.test(m[5]) && +m[4] <= 12 && +m[5] <= 12 && +m[4] !== +m[5]; }
    } else if (m[7]) { const mm = MON[m[7].toLowerCase()]; if (mm) iso = mkDate(m[9], mm, +m[8]); }
    if (iso) out.push({ iso, ambiguous, index: m.index, end: m.index + m[0].length });
    else re.lastIndex = m.index + 1;
  }
  return out;
}
const AMT_RE = /(?:(₹|rs\.?|inr|usd|us\$|\$|aed|eur|€)\s*)?(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(\s*%|\s*\/-)?/gi;
export function findAmounts(s) {
  const dates = findDates(s);
  const out = [];
  for (const m of s.matchAll(AMT_RE)) {
    if (m[3] && m[3].includes("%")) continue;
    if (dates.some((d) => m.index >= d.index && m.index < d.end)) continue;
    const prev = s.slice(Math.max(0, m.index - 1), m.index);
    if (/[A-Za-z\/]/.test(prev)) continue; // part of a code like NGI/26/0991
    if (/\bno\.?\s*$/i.test(s.slice(Math.max(0, m.index - 4), m.index))) continue; // a reference number, "No. 67"
    const next = s.slice(m.index + m[0].length, m.index + m[0].length + 1);
    if (!m[3] && /^[)\-\/A-Za-z]/.test(next)) continue; // list marker "1)" or code "67-B"
    const v = +m[2].replace(/,/g, "");
    if (!Number.isFinite(v)) continue;
    if (!m[1] && /^(19|20)\d{2}$/.test(m[2])) continue; // a bare year
    if (!m[1] && !/[,.]/.test(m[2]) && v > 0 && v < 100) continue; // too small to be money without a currency mark
    out.push({ v, cur: m[1] ? curOf(m[1]) : null });
  }
  return out;
}
function curOf(t) { t = t.toLowerCase(); return /usd|us\$|^\$$/.test(t) ? "USD" : t === "aed" ? "AED" : /eur|€/.test(t) ? "EUR" : "INR"; }
const findPct = (s) => { const m = s.match(/(\d{1,2}(?:\.\d{1,3})?)\s*%/); return m ? +m[1] : null; };
const findId = (s) => { const m = s.match(/[A-Z0-9][A-Z0-9\/\-.]{4,}[A-Z0-9]/i); if (!m || !/\d/.test(m[0])) return null; return m[0].replace(/^(\d{8,})[A-Za-z]{3,}$/, "$1"); };
const cleanText = (s) => s.replace(/`\s*(?=\d)/g, "₹ ").replace(/^[\s:\-–.]+/, "").replace(/\s{2,}/g, " ").trim().slice(0, 140);

// ---- field rules (order matters: specific labels before generic ones)
const RULES = [
  { key: "policyNo", kind: "id", label: /\b(policy|certificate|cover\s*note)\s*(no|number|num)\b\.?|\bcertificate\s*ref(erence)?\b|\breference\s*(no|number)\b/i, not: /previous|prev\b|old\b|expiring|proposal|endorsement|receipt|invoice|order/i },
  { key: "uin", kind: "id", label: /\bUIN\b/i },
  { key: "planName", kind: "text", label: /\b(product\s*name|plan\s*name|name\s*of\s*(the\s*)?product)\b/i },
  { key: "proposalDate", kind: "date", label: /proposal\s*(date|signed\s*on)|date\s*of\s*proposal/i },
  { key: "issueDate", kind: "date", label: /date\s*of\s*(issue|issuance)|issue\s*date|issued\s*on|date\s*issued|policy\s*issued/i },
  { key: "riskStart", kind: "date", label: /\b(policy\s*)?start\s*date|risk\s*(start|inception)|commencement\s*date|inception\s*date|valid\s*from|effective\s*from|cover\s*from/i, not: /endorsement/i },
  { key: "riskEnd", kind: "date", label: /\b(policy\s*)?end\s*date|expiry\s*date|date\s*of\s*expiry|risk\s*end|valid\s*(up\s*)?(to|till)|cover\s*(to|till)/i },
  { key: "sumInsured", kind: "amount", label: /total\s*sum\s*insured|sum\s*insured|sum\s*assured|insured\s*declared\s*value|\bIDV\b|agreed\s*value|limit\s*of\s*(liability|indemnity)|aggregate\s*limit/i, not: /used|balance/i },
  { key: "netPremium", kind: "amount", label: /net\s*premium|basic\s*premium|premium\s*(before|excl\.?|excluding)\s*(tax|gst)|taxable\s*(value|premium|amount)|total\s*premium\s*(before|excl)/i },
  { key: "grossPremium", kind: "amount", label: /gross\s*premium|total\s*premium(\s*payable)?|premium\s*payable|total\s*(amount\s*)?payable|final\s*premium|total\s*amount|\btotal\s*\(\s*(`|₹|rs\.?|inr)\s*\)/i, not: /before|excl|excluding|\bnet\b|without|in\s*words/i },
  // A bare "Premium" label is the premium before tax. Only as a label in its own cell or before a colon.
  { key: "netPremium", kind: "amount", label: /\bpremium\b/i, strict: true, not: /total|gross|\bnet\b|rate|payable|deposit|minimum|paid|refund|additional|due|cheque|tax|gst|words|details|head|share|basis|amount|annual|holiday/i },
  { key: "gst", kind: "amount", label: /\b(igst|gst|goods\s*(and|&)\s*services?\s*tax|service\s*tax)\b/i, not: /gstin|regist|\bno\.?\b|number|cgst|sgst|utgst|before|excl/i },
  { key: "stampDuty", kind: "amount", label: /stamp\s*duty/i, zeroOk: true },
  { key: "premiumRate", kind: "pct", label: /\b(premium\s*)?rate\b/i, not: /gst|tax|exchange|interest/i },
  { key: "excess", kind: "text", label: /compulsory\s*deductible|deductible|\bexcess\b/i, needDigit: true },
  { key: "location", kind: "text", label: /risk\s*location|location\s*of\s*risk|insured\s*location|risk\s*address|situation\s*of\s*risk|\bsituation\b|premises\s*address|location\s*address/i },
];
const LABELS = { policyNo: "Policy number", uin: "UIN", planName: "Plan name", proposalDate: "Proposal date", issueDate: "Policy issue date", riskStart: "Risk start date", riskEnd: "Risk end date", sumInsured: "Sum insured", netPremium: "Net premium", grossPremium: "Gross premium", gst: "GST amount", stampDuty: "Stamp duty", premiumRate: "Premium rate", excess: "Policy excess", location: "Insured location" };

function parseKind(kind, s, zeroOk, needDigit) {
  if (kind === "date") { const d = findDates(s); return d.length ? { v: d[0].iso, ambiguous: d[0].ambiguous } : null; }
  if (kind === "amount") { const a = findAmounts(s).filter((x) => x.v > 0 || (zeroOk && x.v === 0)); return a.length ? { v: a[0].v, cur: a[0].cur } : null; }
  if (kind === "pct") { const p = findPct(s); return p != null ? { v: p } : null; }
  if (kind === "id") { const v = findId(s); return v ? { v } : null; }
  if (kind === "text") { const v = cleanText(s); return v && /[A-Za-z0-9]{2}/.test(v) && (!needDigit || /\d/.test(v)) ? { v } : null; }
  return null;
}

// A cell under a header must be the value and nothing else, or it is not used.
const WHOLE = {
  amount: /^\s*(₹|rs\.?|inr|usd|us\$|\$|aed|eur|€)?\s*\d[\d,]*(\.\d{1,2})?\s*(\/-)?\s*$/i,
  pct: /^\s*\d{1,2}(\.\d+)?\s*%?\s*$/,
  id: /^\s*[A-Z0-9][A-Z0-9\/\-.]{4,}[A-Z0-9]\s*$/i,
};
const isPunct = (s) => /^[\s:;\-–=|.]*$/.test(s) || /^\s*:?\s*(rs\.?|inr|`|₹)\s*:?\s*$/i.test(s);

function candidates(lines, rule) {
  const out = [];
  lines.forEach((ln, i) => {
    if (ln.marker) return;
    ln.segs.forEach((seg, j) => {
      const m = seg.s.match(rule.label);
      if (!m || (rule.not && rule.not.test(seg.s))) return;
      const before = seg.s.slice(0, m.index).replace(/[^\x00-\x7F]+\/?\s*/g, "");
      const after = seg.s.slice(m.index + m[0].length);
      // Only labels that are set out as labels: at the start of a block (after an optional "1." or "a)"),
      // or directly followed by a colon. A label word inside a sentence of policy wording is ignored.
      // Up to two short words may come before a label ("Policy Issue Date", "Own Damage Cover To").
      const atStart = /^\s*((\d{1,2}|[a-z]|[ivx]{1,4})[.)]\s*)?([A-Za-z&]{1,12}\s+){0,2}$/i.test(before) || /[:|]\s*$/.test(before);
      const colonAfter = /^\s*(\([^)]{0,30}\))?\s*(no\.?|number)?\s*[:=–-]/i.test(after);
      // A header cell may carry a bracket or a rate after the label, e.g. "Sum Insured (Rs.)" or "IGST 18%".
      const ownCell = isPunct(after) || /^\s*\/\s*[A-Za-z ]{0,25}:?\s*$/.test(after) || /^\s*\([^)]{0,30}\)\s*$/.test(after) || /^\s*@?\s*\(?\d{1,2}(\.\d+)?\s*%\)?\s*$/.test(after);
      if (!atStart && !colonAfter) return;
      const idInline = rule.kind === "id" && /^\s+[A-Z0-9][A-Z0-9\/\-.]{3,}[A-Z0-9]\s*$/i.test(after) && /\d/.test(after);
      if ((rule.kind === "text" || rule.kind === "id" || rule.strict) && !colonAfter && !ownCell && !idInline) return;
      const tail = !ownCell && !colonAfter && rule.kind !== "text" && rule.kind !== "id" && /^[^\d:]{1,60}$/.test(after) && /[a-z]/i.test(after) && j < ln.segs.length - 1;
      // 1) after the label on the same line: rest of this cell, then the next cells
      const rest = [...(ownCell ? [] : [after]), ...ln.segs.slice(j + 1).map((x) => x.s)];
      for (const part of rest) {
        if (isPunct(part)) continue;
        const v = parseKind(rule.kind, part, rule.zeroOk, rule.needDigit);
        if (v) { out.push({ ...v, ref: i + 1, conf: "high" }); return; }
        if (rule.kind === "text" || rule.kind === "id") break;
        if (!ownCell && !tail) break; // "Label: words" with no value: stop rather than wander along the line
      }
      // 2) table layout: the label is a header cell and the value sits right under it
      const next = lines[i + 1];
      if (ownCell && next && !next.marker) {
        const alone = rule.kind === "text" && ln.segs.length === 1;
        const under = next.segs.find((x) => x.x < seg.x2 + 4 && x.x2 > seg.x - 4) || (alone ? next.segs.find((x) => x.x >= seg.x - 4) : null);
        if (!under) return;
        const whole = rule.kind === "date" ? (() => { const d = findDates(under.s); return d.length && d[0].end - d[0].index >= under.s.trim().length * 0.6; })()
          : rule.kind === "text" ? under.s.length < 120 : WHOLE[rule.kind].test(under.s);
        const v = whole && parseKind(rule.kind, under.s, rule.zeroOk, rule.needDigit);
        if (v) out.push({ ...v, ref: i + 2, conf: "high", note: "Read from the cell below the label" });
      }
    });
  });
  return out;
}

function pick(cands, key) {
  if (!cands.length) return null;
  const first = cands[0];
  const distinct = [...new Set(cands.map((c) => String(c.v)))];
  const res = { v: first.v, ref: first.ref, conf: first.conf, note: first.note };
  if (distinct.length > 1) {
    res.conf = "low";
    const other = cands.find((c) => String(c.v) !== String(first.v));
    res.note = `The document shows different values (lines ${first.ref} and ${other.ref}). The first one was used.`;
  }
  if (first.ambiguous) { res.note = (res.note ? res.note + " " : "") + "Read as day/month/year."; }
  return res;
}

export function parseFields(lines) {
  const fields = {};
  const found = {};
  for (const r of RULES) found[r.key] = (found[r.key] || []).concat(candidates(lines, r));
  for (const k of Object.keys(found)) { const p = pick(found[k], k); if (p) fields[k] = p; }

  // Period lines with two dates, e.g. "Period of insurance: 01/12/2026 to 30/11/2027"
  lines.forEach((ln, i) => {
    if (ln.marker || !/period|from\b.*\bto\b|\bfrom\b/i.test(ln.text)) return;
    const ds = findDates(ln.text);
    if (ds.length === 1 && /\bfrom\b/i.test(ln.text) && !fields.riskStart) { fields.riskStart = { v: ds[0].iso, ref: i + 1, conf: "low", note: "Only a start date is given on this line. Check the end date." }; return; }
    if (ds.length < 2 || !/period|from|to|till/i.test(ln.text)) return;
    const [a, b] = [ds[0].iso, ds[1].iso];
    if (b <= a) return;
    for (const [k, v] of [["riskStart", a], ["riskEnd", b]]) {
      if (!fields[k]) fields[k] = { v, ref: i + 1, conf: "high", note: ds[0].ambiguous || ds[1].ambiguous ? "Read as day/month/year." : undefined };
      else if (fields[k].v !== v && !fields[k].noteSet) { fields[k] = { ...fields[k], conf: "low", note: `Line ${i + 1} gives the period as a different date. Check which is right.`, noteSet: true }; }
    }
  });

  // GST split into CGST + SGST/UTGST when no single GST line exists
  if (!fields.gst) {
    const c = candidates(lines, { kind: "amount", label: /\bcgst\b/i }), s = candidates(lines, { kind: "amount", label: /\b(sgst|utgst)\b/i });
    if (c.length && s.length) fields.gst = { v: Math.round((c[0].v + s[0].v) * 100) / 100, ref: c[0].ref, conf: "low", note: `CGST (line ${c[0].ref}) and SGST (line ${s[0].ref}) added together` };
  }
  // GST %: only a % written right next to the tax name counts, e.g. "GST @ 18%", "IGST 18%", "CGST (9%)".
  const taxPct = (t, name) => { const m = t.match(new RegExp("\\b(" + name + ")\\b[^%\\d]{0,12}(\\d{1,2}(?:\\.\\d+)?)\\s*%", "i")); return m ? +m[2] : null; };
  const gstLine = lines.find((l) => !l.marker && !/gstin/i.test(l.text) && (taxPct(l.text, "igst|gst") != null || taxPct(l.text, "cgst") != null));
  if (gstLine) {
    const isSplit = taxPct(gstLine.text, "igst|gst") == null;
    let pct = isSplit ? taxPct(gstLine.text, "cgst") : taxPct(gstLine.text, "igst|gst");
    const sg = lines.map((l) => (l.marker ? null : taxPct(l.text, "sgst|utgst"))).find((x) => x != null);
    if (isSplit && sg != null) pct += sg;
    fields.gstPct = { v: pct, ref: lines.indexOf(gstLine) + 1, conf: isSplit ? "low" : "high", note: isSplit ? "CGST % and SGST % added together" : undefined };
  }

  // Currency: only when the document says so
  const curs = {};
  lines.forEach((l, i) => { if (l.marker) return; for (const a of findAmounts(l.text)) if (a.cur) { (curs[a.cur] ||= []).push(i + 1); } if (/\b(INR|Rupees)\b|₹|\bRs\b/i.test(l.text) && !curs.INR?.includes(i + 1)) (curs.INR ||= []).push(i + 1); });
  const curKeys = Object.keys(curs);
  if (curKeys.length) {
    curKeys.sort((a, b) => curs[b].length - curs[a].length);
    fields.currency = { v: curKeys[0], ref: curs[curKeys[0]][0], conf: curKeys.length === 1 ? "high" : "low", note: curKeys.length > 1 ? `The document mentions ${curKeys.join(" and ")}. Check the policy currency.` : undefined };
  }

  // Sanity checks that lower confidence, never change values
  const n = fields.netPremium, g = fields.grossPremium;
  if (n && g && n.v > g.v) { n.conf = g.conf = "low"; n.note = g.note = "Net premium is larger than gross premium on the document. Check both."; }
  else if (n && g && n.v === g.v) { g.conf = "low"; g.note = "Gross premium is the same as net premium. Check whether tax is included."; }
  if (fields.riskStart && fields.riskEnd && fields.riskEnd.v <= fields.riskStart.v) { fields.riskEnd.conf = "low"; fields.riskEnd.note = "End date is not after the start date. Check it."; }
  Object.values(fields).forEach((f) => { delete f.noteSet; if (!f.note) delete f.note; });

  // Information only, never written into fields
  const info = {};
  const ins = findInsured(lines);
  if (ins) info.insured = ins.v;
  const insurer = findInsurer(lines);
  if (insurer) info.insurer = insurer;
  return { fields, info };
}

// ---- who is insured, and by whom
// The insured's name: the value of a label set out as a label, cut at the next cell, and only if it
// looks like a name (not an amount, not a clause of wording).
const INSURED_RULE = { kind: "text", label: /\b(legal\s*name(\s*of\s*business)?|trade\s*name|customer\s*name|name\s*of\s*(the\s*)?(insured|assured|proposer|policy\s*holder)|(insured|assured|proposer|policy\s*holder)('s|s)?\s*name|original\s*insured|policy\s*holder|policyholder|insured|assured)\b/i,
  not: /sum\s*(insured|assured)|insured\s*(object|value|location|address|details|event|peril|property|person|member|employee)|persons?\s*insured|lives\s*insured|interests?\s*insured|subject.?matter|(?<!\bof\s)\bthe\s+(insured|assured)\b/i };
const NOT_A_NAME = /\d{3,}|\b(rs\.?|inr|usd|amt|amount|sum|where|which|shall|will|whose|each|policy|period|premium|said\s+to|contain|limit)\b|;\s*$|^[^A-Za-z]|^[^(]*\)|^(mailing|address|contact|details|place|gstin|pan|mobile|e-?mail|date|holder)\b/i;
function findInsured(lines) {
  for (const c of candidates(lines, INSURED_RULE)) {
    const v = c.v.split(/\s{3,}|\s+[|]\s+/)[0].replace(/\s+(e-?mail|intermediary|address|gstin|pan|mobile|phone)\b.*$/i, "").trim();
    if (v.length >= 3 && v.length <= 90 && /[A-Za-z]{3}/.test(v) && !NOT_A_NAME.test(v) && v.split(/\s+/).length <= 10) return { v, ref: c.ref };
  }
  return null;
}
// The insurer: the registered name that appears most often on the document. Intermediaries and other
// insurers are mentioned once or twice; the issuer's name is on every page.
const INSURERS = [
  ["The New India Assurance Co. Ltd.", /new\s*india\s*assurance/i], ["Tata AIG General Insurance", /tata\s*-?\s*aig/i], ["Zurich Kotak General Insurance", /zurich\s*kotak|kotak\s*mahindra\s*general/i],
  ["Bajaj General Insurance", /bajaj\s*(allianz\s*)?general/i], ["Generali Central Insurance", /generali\s*central|future\s*generali/i], ["National Insurance Co. Ltd.", /national\s*insurance\s*co|\bnic\.co\.in\b/i],
  ["ICICI Lombard General Insurance", /icici\s*lombard/i], ["HDFC ERGO General Insurance", /hdfc\s*ergo/i], ["United India Insurance", /united\s*india\s*insurance/i], ["The Oriental Insurance Co. Ltd.", /oriental\s*insurance/i],
  ["SBI General Insurance", /sbi\s*general/i], ["Reliance General Insurance", /reliance\s*general/i], ["Royal Sundaram General Insurance", /royal\s*sundaram/i], ["Cholamandalam MS General Insurance", /cholamandalam/i],
  ["IFFCO-Tokio General Insurance", /iffco[\s-]*tokio/i], ["Liberty General Insurance", /liberty\s*general/i], ["Go Digit General Insurance", /go\s*digit|digit\s*insurance/i], ["ACKO General Insurance", /\backo\b/i],
  ["Magma General Insurance", /magma\s*(hdi|general)/i], ["Raheja QBE General Insurance", /raheja\s*qbe/i], ["Shriram General Insurance", /shriram\s*general/i], ["Universal Sompo General Insurance", /universal\s*sompo/i],
  ["Navi General Insurance", /navi\s*general/i], ["Zuno General Insurance", /\bzuno\b|edelweiss\s*general/i], ["Star Health Insurance", /star\s*health/i], ["Care Health Insurance", /care\s*health/i],
  ["Niva Bupa Health Insurance", /niva\s*bupa|max\s*bupa/i], ["ManipalCigna Health Insurance", /manipal\s*cigna/i], ["Aditya Birla Health Insurance", /aditya\s*birla\s*health/i], ["ECGC", /\becgc\b/i],
];
function findInsurer(lines) {
  const text = lines.filter((l) => !l.marker).map((l) => l.text).join("\n");
  let best = null;
  for (const [name, re] of INSURERS) {
    const n = (text.match(new RegExp(re.source, "gi")) || []).length;
    if (n && (!best || n > best.n)) best = { name, n };
  }
  if (best) return best.name;
  const top = lines.filter((l) => !l.marker).slice(0, 40).map((l) => l.text.split(/\s{3,}/)[0].replace(/\s*\((fictional|sample)\)\s*/i, "").trim());
  // Ends like a registered insurer ("... Insurance Company Limited", "... Assurance Co. Ltd."); never a broker or a heading.
  const named = top.find((t) => t.length <= 80 && /^[A-Z][A-Za-z&.'\- ]{2,60}\b(insurance|assurance)\s+(company|co\.?)(\s+(limited|ltd\.?))?\.?$|^[A-Z][A-Za-z&.'\- ]{2,60}\b(insurance|assurance)\s+(limited|ltd\.?)\.?$/i.test(t)
    && !/\b(brok|agent|period|of\s+insurance|certificate|policy|schedule|we|you|your)\b/i.test(t));
  return named || null;
}

// ---- customer details printed on a policy or GST certificate
// Insurer contact details are common on schedules, so a value on an insurer/helpline line is never used,
// and a value not clearly tied to the insured is marked for checking.
const INSURER_LINE = /insurer|insurance\s*(company|co\b)|assurance|branch|toll\s*free|helpline|customer\s*care|call\s*centre|grievance|claims?\s*(dept|department|desk)|registered\s*office|irdai|corporate\s*office|www\.|website/i;
const INSURED_LINE = /insured|proposer|policy\s*holder|policyholder|customer|client|name\s*of\s*the\s*(firm|company)/i;
const GSTIN_RE = /\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]\b/;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,5}\)?[\s-]?)?\d{3,5}[\s-]?\d{4,5}/;
const ADDR_LABEL = /\b((insured|proposer|policy\s*holder)('s)?\s*address|address\s*of\s*(the\s*)?(insured|proposer)|correspondence\s*address|communication\s*address|mailing\s*address|principal\s*place\s*of\s*business|address)\b\s*[:\-]/i;

function contactPick(lines, re, labelRe, clean = (x) => x, valid = () => true) {
  const hits = [];
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  lines.forEach((l, i) => {
    if (l.marker || INSURER_LINE.test(l.text)) return;
    if (labelRe && !labelRe.test(l.text)) return;
    const m = [...l.text.matchAll(g)].map((x) => clean(x[0])).find(valid);
    if (m) hits.push({ v: m, ref: i + 1, tied: INSURED_LINE.test(l.text) || INSURED_LINE.test(lines[i - 1]?.text || "") });
  });
  if (!hits.length) return null;
  const best = hits.find((h) => h.tied) || hits[0];
  const distinct = [...new Set(hits.map((h) => h.v))];
  return { v: best.v, ref: best.ref, conf: best.tied && distinct.length === 1 ? "high" : "low", note: !best.tied ? "Not clearly labelled as the customer's. Check it is not the insurer's." : distinct.length > 1 ? `The document shows ${distinct.length} different values. The first one was used.` : undefined };
}

export function parseCustomer(lines) {
  const out = {};
  const ins = findInsured(lines);
  if (ins) out.name = { v: ins.v, ref: ins.ref, conf: "high" };
  const addrLine = lines.findIndex((l) => !l.marker && ADDR_LABEL.test(l.text) && !INSURER_LINE.test(l.text));
  if (addrLine >= 0) {
    const v = cleanText(lines[addrLine].text.replace(new RegExp(".*?" + ADDR_LABEL.source, "i"), "").replace(/^[\s:\-]+/, "").split(/\s{3,}/)[0]);
    const generic = !/insured|proposer|holder|correspondence|communication|mailing|principal/i.test(lines[addrLine].text);
    if (v && v.length > 4 && !EMAIL_RE.test(v) && /[A-Za-z]{3}/.test(v)) out.address = { v, ref: addrLine + 1, conf: generic ? "low" : "high", note: generic ? "Labelled only \"Address\". Check it is the customer's address." : undefined };
  }
  const cityLine = lines.findIndex((l) => !l.marker && /\bcity\s*[:\-]/i.test(l.text) && !INSURER_LINE.test(l.text));
  if (cityLine >= 0) { const v = cleanText(lines[cityLine].text.replace(/.*?\bcity\s*[:\-]/i, "").replace(/^[\s:\-]+/, "").split(/\s{3,}|,/)[0]); if (/^[A-Za-z][A-Za-z .'-]{1,39}$/.test(v)) out.city = { v, ref: cityLine + 1, conf: "high" }; }
  const gst = contactPick(lines, GSTIN_RE, null);
  if (gst) out.gst = gst;
  const email = contactPick(lines, EMAIL_RE, null, (x) => x.toLowerCase());
  if (email) out.email = email;
  // At least 10 digits, and never a toll-free or helpline series (1800 / 1860), which belong to insurers.
  const phone = contactPick(lines, PHONE_RE, /\b(mobile|mob\.?|phone|tel\.?|telephone|contact\s*(no|number)?)\b/i, (x) => x.trim(),
    (x) => { const d = x.replace(/\D/g, ""); return d.length >= 10 && !/^(91)?1[89]\d0/.test(d); });
  if (phone) out.phone = phone;
  return out;
}

export async function readPolicyPdf(file, onProgress) {
  const res = await pdfToLines(file, onProgress);
  const base = { id: `USER-${Date.now()}`, extracted: true, title: file.name, fileName: file.name, fileSize: file.size, pages: res.pages, readPages: res.readPages };
  if (res.textChars < 40) {
    return { ...base, noText: true, lines: ["This PDF has no readable text. It is probably a scan or a photo saved as PDF.", "Enter the values by hand, or attach the digital PDF from the insurer."], fields: {}, info: {}, customer: {} };
  }
  const { fields, info } = parseFields(res.lines);
  return { ...base, lines: res.lines.map((l) => l.text), fields, info, customer: parseCustomer(res.lines) };
}
export { LABELS as EXTRACT_LABELS };
